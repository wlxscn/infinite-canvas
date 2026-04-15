import { useEffect, useMemo, useRef, useState } from 'react';
import type { AgentChatRequest } from '@infinite-canvas/shared/api';
import type { CanvasContextPayload } from '@infinite-canvas/shared/canvas-context';
import type { ChatMessage, ChatSuggestionAction } from '@infinite-canvas/shared/chat';
import type { AgentEffect } from '@infinite-canvas/shared/tool-effects';
import { getCanvasNodeBounds, normalizeBounds, screenToWorld, worldToScreen } from '@infinite-canvas/canvas-engine';
import { CanvasStage } from './canvas/CanvasStage';
import { generateImage, generateVideo } from './features/chat/api/chat-client';
import { useAgentChat } from './features/chat/hooks/useAgentChat';
import { mergeTranscriptIntoDraft, useVoiceComposer } from './features/chat/hooks/useVoiceComposer';
import { appendMessagesToSession, createChatSession, getActiveChatSession, updateActiveSession, updateSessionById } from './features/chat/session-state';
import { createDeferredProjectSaver, loadProject } from './persistence/local';
import {
  bringNodeForward,
  commitProject,
  createInitialStore,
  finalizeMutation,
  getAssetById,
  getNodeById,
  redo,
  removeNodeById,
  replaceProjectNoHistory,
  sendNodeBackward,
  setSelectedId,
  setTool,
  undo,
  upsertAsset,
  upsertJob,
} from './state/store';
import type {
  AssetRecord,
  CanvasProject,
  CanvasStoreState,
  CanvasNode,
  GenerationJob,
  TextNode,
  Tool,
} from './types/canvas';
import { createId } from './utils/id';
import './index.css';

function logAppChat(event: string, payload: Record<string, unknown> = {}) {
  console.log(`[web/App chat] ${event}`, payload);
}

const TOOLS: Array<{ id: Tool; label: string; icon: string }> = [
  { id: 'select', label: '选择', icon: '◢' },
  { id: 'pan', label: '平移', icon: '◎' },
  { id: 'rect', label: '矩形', icon: '▢' },
  { id: 'freehand', label: '自由线', icon: '✎' },
  { id: 'text', label: '文本', icon: 'T' },
];

function getSelectedNode(state: CanvasStoreState) {
  return getNodeById(state.project.board.nodes, state.selectedId);
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

function triggerDownload(filename: string, href: string): void {
  const anchor = document.createElement('a');
  anchor.href = href;
  anchor.download = filename;
  anchor.click();
}

function makeUserMessage(text: string): ChatMessage {
  return {
    id: createId('message'),
    role: 'user',
    text,
    createdAt: Date.now(),
    suggestions: [],
  };
}

function createPendingJob(prompt: string, mediaType: GenerationJob['mediaType'] = 'image'): GenerationJob {
  const now = Date.now();
  return {
    id: createId('job'),
    prompt,
    mediaType,
    status: 'pending',
    createdAt: now,
    updatedAt: now,
  };
}

function createGeneratedAsset({
  mediaType,
  sourceJobId,
  response,
}: {
  mediaType: AssetRecord['type'];
  sourceJobId: string;
  response:
    | Awaited<ReturnType<typeof generateImage>>
    | Awaited<ReturnType<typeof generateVideo>>;
}): AssetRecord {
  const now = Date.now();

  if (mediaType === 'video') {
    const videoResponse = response as Awaited<ReturnType<typeof generateVideo>>;
    return {
      id: createId('asset'),
      type: 'video',
      name: `Generated video ${new Date().toLocaleTimeString()}`,
      mimeType: videoResponse.mimeType ?? 'video/mp4',
      src: videoResponse.videoUrl,
      posterSrc: videoResponse.posterUrl ?? undefined,
      width: videoResponse.width,
      height: videoResponse.height,
      durationSeconds: videoResponse.durationSeconds,
      origin: 'generated',
      createdAt: now,
      sourceJobId,
    };
  }

  const imageResponse = response as Awaited<ReturnType<typeof generateImage>>;
  return {
    id: createId('asset'),
    type: 'image',
    name: `Generated image ${new Date().toLocaleTimeString()}`,
    mimeType: 'image/jpeg',
    src: imageResponse.imageUrl,
    width: imageResponse.width,
    height: imageResponse.height,
    origin: 'generated',
    createdAt: now,
    sourceJobId,
  };
}

function createGeneratedNode(asset: AssetRecord, center: { x: number; y: number }): CanvasNode {
  const width = Math.min(asset.width, 360);
  const height = Math.min(asset.height, 240);

  return {
    id: createId('node'),
    type: asset.type,
    assetId: asset.id,
    x: center.x - width / 2,
    y: center.y - height / 2,
    w: width,
    h: height,
  };
}

function buildCanvasContext(project: CanvasProject, selectedNode: ReturnType<typeof getNodeById>): CanvasContextPayload {
  return {
    selectedNode:
      selectedNode && selectedNode.type !== 'image'
        ? {
            id: selectedNode.id,
            type: selectedNode.type,
            text: selectedNode.type === 'text' ? selectedNode.text : undefined,
          }
        : selectedNode
          ? {
              id: selectedNode.id,
              type: selectedNode.type,
            }
          : null,
    latestPrompt: project.jobs[0]?.prompt ?? null,
    nodeCount: project.board.nodes.length,
    assetCount: project.assets.length,
    recentAssets: project.assets.slice(0, 3).map((asset) => ({
      id: asset.id,
      name: asset.name,
      origin: asset.origin,
    })),
  };
}

function App() {
  const [state, setState] = useState<CanvasStoreState>(() => createInitialStore(loadProject()));
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [isAgentSidebarOpen, setIsAgentSidebarOpen] = useState(true);
  const [isCanvasInteractionActive, setIsCanvasInteractionActive] = useState(false);
  const [prompt, setPrompt] = useState('editorial poster about infinite canvas creativity');
  const [generationMediaType, setGenerationMediaType] = useState<AssetRecord['type']>('image');
  const [chatInput, setChatInput] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const chatThreadRef = useRef<HTMLDivElement | null>(null);
  const latestProjectRef = useRef(state.project);
  const latestSelectedIdRef = useRef(state.selectedId);
  const deferredSaveRef = useRef(createDeferredProjectSaver());

  useEffect(() => {
    latestProjectRef.current = state.project;
  }, [state.project]);

  useEffect(() => {
    latestSelectedIdRef.current = state.selectedId;
  }, [state.selectedId]);

  useEffect(() => {
    deferredSaveRef.current.schedule(state.project);
  }, [state.project]);

  useEffect(() => () => deferredSaveRef.current.cancel(), []);

  useEffect(() => {
    if (!chatThreadRef.current) {
      return;
    }

    chatThreadRef.current.scrollTop = chatThreadRef.current.scrollHeight;
  }, [state.project.chat.activeSessionId, state.project.chat.sessions]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      const isMac = navigator.platform.toUpperCase().includes('MAC');
      const cmdOrCtrl = isMac ? event.metaKey : event.ctrlKey;

      if (event.code === 'Space') {
        setIsSpacePressed(true);
      }

      if (cmdOrCtrl && event.key.toLowerCase() === 's') {
        event.preventDefault();
        deferredSaveRef.current.flush(latestProjectRef.current);
        return;
      }

      if (cmdOrCtrl && event.key === '0') {
        event.preventDefault();
        setState((prev) =>
          replaceProjectNoHistory(prev, {
            ...prev.project,
            board: {
              ...prev.project.board,
              viewport: { tx: 0, ty: 0, scale: 1 },
            },
          }),
        );
        return;
      }

      if (cmdOrCtrl && event.key.toLowerCase() === 'z' && !event.shiftKey) {
        event.preventDefault();
        setState((prev) => undo(prev));
        return;
      }

      if ((cmdOrCtrl && event.shiftKey && event.key.toLowerCase() === 'z') || (cmdOrCtrl && event.key.toLowerCase() === 'y')) {
        event.preventDefault();
        setState((prev) => redo(prev));
        return;
      }

      if ((event.key === 'Delete' || event.key === 'Backspace') && latestSelectedIdRef.current) {
        const activeElement = document.activeElement;
        if (activeElement instanceof HTMLInputElement || activeElement instanceof HTMLTextAreaElement) {
          return;
        }

        event.preventDefault();
        setState((prev) => {
          if (!prev.selectedId) {
            return prev;
          }

          const nextProject: CanvasProject = {
            ...prev.project,
            board: {
              ...prev.project.board,
              nodes: removeNodeById(prev.project.board.nodes, prev.selectedId),
            },
          };
          const nextState = commitProject(prev, nextProject);
          return setSelectedId(nextState, null);
        });
      }
    }

    function handleKeyUp(event: KeyboardEvent): void {
      if (event.code === 'Space') {
        setIsSpacePressed(false);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  useEffect(() => {
    function preventBrowserZoomWithWheel(event: WheelEvent): void {
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault();
      }
    }

    function preventBrowserZoomHotkeys(event: KeyboardEvent): void {
      const isMac = navigator.platform.toUpperCase().includes('MAC');
      const cmdOrCtrl = isMac ? event.metaKey : event.ctrlKey;
      if (!cmdOrCtrl) {
        return;
      }

      if (event.key === '+' || event.key === '-' || event.key === '=' || event.key === '0') {
        event.preventDefault();
      }
    }

    function preventSafariGestureZoom(event: Event): void {
      event.preventDefault();
    }

    window.addEventListener('wheel', preventBrowserZoomWithWheel, { passive: false });
    window.addEventListener('keydown', preventBrowserZoomHotkeys);
    window.addEventListener('gesturestart', preventSafariGestureZoom, { passive: false });
    window.addEventListener('gesturechange', preventSafariGestureZoom, { passive: false });
    window.addEventListener('gestureend', preventSafariGestureZoom, { passive: false });

    return () => {
      window.removeEventListener('wheel', preventBrowserZoomWithWheel);
      window.removeEventListener('keydown', preventBrowserZoomHotkeys);
      window.removeEventListener('gesturestart', preventSafariGestureZoom);
      window.removeEventListener('gesturechange', preventSafariGestureZoom);
      window.removeEventListener('gestureend', preventSafariGestureZoom);
    };
  }, []);

  const selectedNode = useMemo(() => getSelectedNode(state), [state]);
  const activeSession = useMemo(() => getActiveChatSession(state.project), [state.project]);
  const selectedAsset = useMemo(() => {
    if (!selectedNode || (selectedNode.type !== 'image' && selectedNode.type !== 'video')) {
      return null;
    }
    return getAssetById(state.project.assets, selectedNode.assetId);
  }, [selectedNode, state.project.assets]);

  const statsText = useMemo(
    () => ({
      nodeCount: `节点 ${state.project.board.nodes.length}`,
      scaleText: `${(state.project.board.viewport.scale * 100).toFixed(0)}%`,
      assetCount: `资产 ${state.project.assets.length}`,
    }),
    [state.project],
  );

  const selectionToolbarStyle = useMemo(() => {
    if (!selectedNode) {
      return null;
    }

    const bounds = normalizeBounds(getCanvasNodeBounds(selectedNode));
    const topLeft = worldToScreen({ x: bounds.x, y: bounds.y }, state.project.board.viewport);
    const width = bounds.w * state.project.board.viewport.scale;
    const top = Math.max(topLeft.y - 64, 84);

    return {
      left: `clamp(20px, ${topLeft.x + width / 2}px, calc(100% - 380px))`,
      top: `${top}px`,
    };
  }, [selectedNode, state.project.board.viewport]);

  function handleSelect(id: string | null): void {
    setState((prev) => setSelectedId(prev, id));
  }

  function handleCommitProject(project: CanvasProject): void {
    setState((prev) => commitProject(prev, project));
  }

  function handleReplaceProject(project: CanvasProject): void {
    setState((prev) => replaceProjectNoHistory(prev, project));
  }

  function handleFinalizeMutation(beforeProject: CanvasProject, afterProject: CanvasProject): void {
    setState((prev) => finalizeMutation(prev, beforeProject, afterProject));
  }

  function createAndActivateSession(title = '新会话') {
    const session = createChatSession(title);
    setState((prev) =>
      replaceProjectNoHistory(prev, {
        ...prev.project,
        chat: {
          ...prev.project.chat,
          activeSessionId: session.id,
          sessions: [...prev.project.chat.sessions, session],
        },
      }),
    );
    return session;
  }

  function activateSession(sessionId: string): void {
    setState((prev) =>
      replaceProjectNoHistory(prev, {
        ...prev.project,
        chat: {
          ...prev.project.chat,
          activeSessionId: sessionId,
        },
      }),
    );
  }

  async function handleUpload(files: FileList | null): Promise<void> {
    const file = files?.[0];
    if (!file) {
      return;
    }

    const src = await readFileAsDataUrl(file);
    const asset: AssetRecord = {
      id: createId('asset'),
      type: 'image',
      name: file.name,
      mimeType: file.type || 'image/png',
      src,
      width: 1200,
      height: 800,
      origin: 'upload',
      createdAt: Date.now(),
    };

    setState((prev) =>
      commitProject(prev, {
        ...prev.project,
        assets: upsertAsset(prev.project.assets, asset),
      }),
    );
  }

  function insertAsset(asset: AssetRecord): void {
    setState((prev) => {
      const viewport = prev.project.board.viewport;
      const container = chatThreadRef.current?.closest('.app-shell') as HTMLElement | null;
      const screenCenter = {
        x: container ? container.clientWidth / 2 : 640,
        y: container ? container.clientHeight / 2 : 360,
      };
      const worldCenter = screenToWorld(screenCenter, viewport);
      const node = createGeneratedNode(asset, worldCenter);

      const nextProject: CanvasProject = {
        ...prev.project,
        assets: upsertAsset(prev.project.assets, asset),
        board: {
          ...prev.project.board,
          nodes: [...prev.project.board.nodes, node],
        },
      };
      const nextState = commitProject(prev, nextProject);
      return setSelectedId(nextState, node.id);
    });
  }

  async function startMockGeneration(promptOverride?: string, mediaType: AssetRecord['type'] = 'image'): Promise<void> {
    const trimmedPrompt = (promptOverride ?? prompt).trim();
    if (!trimmedPrompt) {
      return;
    }

    const job = createPendingJob(trimmedPrompt, mediaType);

    setState((prev) =>
      replaceProjectNoHistory(prev, {
        ...prev.project,
        jobs: upsertJob(prev.project.jobs, job),
      }),
    );
    try {
      const generated =
        mediaType === 'video'
          ? await generateVideo({ prompt: trimmedPrompt })
          : await generateImage({ prompt: trimmedPrompt });
      const asset = createGeneratedAsset({
        mediaType,
        sourceJobId: job.id,
        response: generated,
      });

      setState((prev) =>
        replaceProjectNoHistory(prev, {
          ...prev.project,
          assets: upsertAsset(prev.project.assets, asset),
          jobs: upsertJob(prev.project.jobs, {
            ...job,
            status: 'success',
            updatedAt: Date.now(),
            assetId: asset.id,
          }),
        }),
      );
    } catch (error) {
      setState((prev) =>
        replaceProjectNoHistory(prev, {
          ...prev.project,
          jobs: upsertJob(prev.project.jobs, {
            ...job,
            status: 'failed',
            updatedAt: Date.now(),
            error: error instanceof Error ? error.message : `${mediaType === 'video' ? 'Video' : 'Image'} generation failed.`,
          }),
        }),
      );
    }
  }

  function nudgeLayer(direction: 'forward' | 'backward'): void {
    if (!state.selectedId) {
      return;
    }

    setState((prev) =>
      commitProject(prev, {
        ...prev.project,
        board: {
          ...prev.project.board,
          nodes:
            direction === 'forward'
              ? bringNodeForward(prev.project.board.nodes, prev.selectedId!)
              : sendNodeBackward(prev.project.board.nodes, prev.selectedId!),
        },
      }),
    );
  }

  function insertTextNode(text: string): void {
    setState((prev) => {
      const selected = getNodeById(prev.project.board.nodes, prev.selectedId);
      const bounds = selected ? normalizeBounds(getCanvasNodeBounds(selected)) : { x: -120, y: -40, w: 0, h: 0 };

      const textNode: TextNode = {
        id: createId('node'),
        type: 'text',
        x: bounds.x,
        y: bounds.y - 80,
        w: 260,
        h: 84,
        text,
        color: '#0f172a',
        fontSize: 22,
        fontFamily: 'Space Grotesk, Avenir Next, Segoe UI, sans-serif',
      };

      const nextProject: CanvasProject = {
        ...prev.project,
        board: {
          ...prev.project.board,
          nodes: [...prev.project.board.nodes, textNode],
        },
      };
      const nextState = commitProject(prev, nextProject);
      const selectedState = setSelectedId(nextState, textNode.id);
      return setTool(selectedState, 'select');
    });
  }

  function applyAgentEffects(effects: AgentEffect[]): void {
    effects.forEach((effect) => {
      logAppChat('effects:apply', effect);

      if (effect.type === 'insert-text') {
        insertTextNode(effect.text);
        return;
      }

      if (effect.type === 'insert-image') {
        setPrompt(effect.prompt);
        insertAsset({
          id: createId('asset'),
          type: 'image',
          name: `Generated ${new Date().toLocaleTimeString()}`,
          mimeType: effect.mimeType ?? 'image/jpeg',
          src: effect.imageUrl,
          width: effect.width,
          height: effect.height,
          origin: 'generated',
          createdAt: Date.now(),
        });
        return;
      }

      if (effect.type === 'insert-video') {
        setPrompt(effect.prompt);
        insertAsset({
          id: createId('asset'),
          type: 'video',
          name: `Generated video ${new Date().toLocaleTimeString()}`,
          mimeType: effect.mimeType ?? 'video/mp4',
          src: effect.videoUrl,
          posterSrc: effect.posterUrl ?? undefined,
          width: effect.width,
          height: effect.height,
          durationSeconds: effect.durationSeconds,
          origin: 'generated',
          createdAt: Date.now(),
        });
        return;
      }

      if (effect.type === 'style-variation') {
        setPrompt(effect.prompt);
        void startMockGeneration(effect.prompt, effect.mediaType ?? 'image');
        return;
      }

      if (effect.type === 'start-generation') {
        setPrompt(effect.prompt);
        void startMockGeneration(effect.prompt, effect.mediaType ?? 'image');
      }
    });
  }

  const agentChat = useAgentChat({
    initialMessages: activeSession?.messages ?? [],
    onResponseData({ responseData }) {
      logAppChat('assistant:data', {
        suggestionCount: responseData?.suggestions.length ?? 0,
        effectCount: responseData?.effects.length ?? 0,
        conversationId: responseData?.conversationId,
        previousResponseId: responseData?.previousResponseId,
      });

      if (responseData?.effects?.length) {
        applyAgentEffects(responseData.effects);
      }
    },
    onAssistantFinish({ message, responseData, targetSessionId }) {
      logAppChat('assistant:finish', {
        messageId: message.id,
        textLength: message.text.length,
        suggestionCount: responseData?.suggestions.length ?? message.suggestions.length,
        effectCount: responseData?.effects.length ?? 0,
        conversationId: responseData?.conversationId,
        previousResponseId: responseData?.previousResponseId,
      });

      setState((prev) =>
        replaceProjectNoHistory(
          prev,
          targetSessionId
            ? updateSessionById(prev.project, targetSessionId, (session) => ({
                ...appendMessagesToSession(session, {
                  ...message,
                  suggestions: responseData?.suggestions ?? message.suggestions,
                }),
                title:
                  session.title === '新会话' && session.messages.length === 0 && message.text.trim().length > 0
                    ? message.text.trim().slice(0, 16)
                    : session.title,
                conversationId: responseData?.conversationId ?? session.conversationId,
                previousResponseId: responseData?.previousResponseId ?? session.previousResponseId,
              }))
            : prev.project,
        ),
      );
    },
    onError(error) {
      logAppChat('assistant:error', {
        message: error.message,
      });
    },
  });

  const voiceComposer = useVoiceComposer({
    onTranscript(transcript) {
      setChatInput((currentDraft) => mergeTranscriptIntoDraft(currentDraft, transcript));
    },
  });

  const composerStatusText =
    voiceComposer.status === 'recording'
      ? '录音中，再次点按可停止并开始转写'
      : voiceComposer.status === 'transcribing'
        ? '正在转写语音，完成后会回填到输入框供你编辑'
        : '录音转写后可编辑再发送，消息会结合当前画布和最近操作';

  const voiceButtonLabel =
    voiceComposer.status === 'recording' ? '停止' : voiceComposer.status === 'transcribing' ? '转写中' : '录音';

  async function submitChatMessage(message: string): Promise<void> {
    const trimmed = message.trim();
    if (!trimmed) {
      return;
    }

    const userMessage = makeUserMessage(trimmed);
    const session = activeSession ?? createChatSession();
    const isNewSession = !activeSession;
    const existingMessages = session.messages;
    const request: AgentChatRequest = {
      projectId: 'local-project',
      conversationId: session.conversationId,
      previousResponseId: session.previousResponseId ?? undefined,
      message: trimmed,
      history: [...existingMessages, userMessage],
      canvasContext: buildCanvasContext(state.project, selectedNode),
    };

    logAppChat('submit', {
      message: trimmed,
      conversationId: request.conversationId,
      previousResponseId: request.previousResponseId,
      historyCount: request.history?.length ?? 0,
      selectedNodeType: request.canvasContext.selectedNode?.type ?? null,
      latestPrompt: request.canvasContext.latestPrompt,
    });

    setChatInput('');
    setState((prev) =>
      replaceProjectNoHistory(
        prev,
        isNewSession
          ? {
              ...prev.project,
              chat: {
                ...prev.project.chat,
                activeSessionId: session.id,
                sessions: [
                  ...prev.project.chat.sessions,
                  appendMessagesToSession(
                    {
                      ...session,
                      title: trimmed.slice(0, 16) || session.title,
                    },
                    userMessage,
                  ),
                ],
              },
            }
          : updateActiveSession(prev.project, (currentSession) =>
              appendMessagesToSession(
                {
                  ...currentSession,
                  title:
                    currentSession.title === '新会话' && currentSession.messages.length === 0
                      ? trimmed.slice(0, 16) || currentSession.title
                      : currentSession.title,
                },
                userMessage,
              ),
            ),
      ),
    );

    await agentChat.sendAgentMessage(trimmed, request, session.id);

    logAppChat('submit:completed', {
      message: trimmed,
    });
  }

  function handleSuggestion(action: ChatSuggestionAction): void {
    const suggestionMessage =
      action === 'add-text'
        ? '请帮我添加宣传文字'
        : action === 'change-style'
          ? '请帮我更换当前海报风格'
          : '请继续生成当前设计的系列变体';

    void submitChatMessage(suggestionMessage);
  }

  function exportProjectJson(): void {
    const href = URL.createObjectURL(
      new Blob([JSON.stringify(state.project, null, 2)], {
        type: 'application/json',
      }),
    );
    triggerDownload('canvas-project.json', href);
    window.setTimeout(() => URL.revokeObjectURL(href), 0);
  }

  const canUndo = state.past.length > 0;
  const canRedo = state.future.length > 0;
  const hasCanvasContent = state.project.board.nodes.length > 0 || state.project.assets.length > 0;
  const latestJob = state.project.jobs[0] ?? null;
  const sessionCount = state.project.chat.sessions.length;
  const generationButtonLabel = generationMediaType === 'video' ? '生成首版视频' : '生成首版画面';

  return (
    <div className="app-shell">
      <div
        className={
          `${isAgentSidebarOpen ? 'canvas-shell with-agent-sidebar' : 'canvas-shell sidebar-collapsed'}${isCanvasInteractionActive ? ' interaction-active' : ''}`
        }
      >
        <header className="floating-header">
          <div className="header-cluster">
            <button className="brand-dot" type="button" aria-label="Workspace home">
              IC
            </button>
            <div className="header-title">
              <strong>Infinite Canvas</strong>
              <span>生成画面，然后在右侧持续迭代</span>
            </div>
          </div>

          <div className="header-cluster header-actions">
            <span className="status-pill">{statsText.nodeCount}</span>
            <span className="status-pill">{statsText.scaleText}</span>
            <button
              className="ghost-btn"
              type="button"
              onClick={() => setIsAgentSidebarOpen((prev) => !prev)}
              aria-expanded={isAgentSidebarOpen}
              aria-controls="agent-sidebar"
            >
              {isAgentSidebarOpen ? '收起对话' : '展开对话'}
            </button>
            <button className="ghost-btn" type="button" disabled={!canUndo} onClick={() => setState((prev) => undo(prev))}>
              撤销
            </button>
            <button className="ghost-btn" type="button" disabled={!canRedo} onClick={() => setState((prev) => redo(prev))}>
              重做
            </button>
            <button className="ghost-btn" type="button" onClick={exportProjectJson}>
              导出
            </button>
          </div>
        </header>

        <section className="floating-card prompt-panel">
          <p className="section-kicker">Start Here</p>
          <div className="prompt-heading">
            <strong>先定一张主画面</strong>
            <span>用一句描述开启当前画板的第一版视觉方向</span>
          </div>
          <div className="generation-mode-toggle" role="group" aria-label="生成类型">
            <button
              className={generationMediaType === 'image' ? 'mode-chip active' : 'mode-chip'}
              type="button"
              onClick={() => setGenerationMediaType('image')}
            >
              图片
            </button>
            <button
              className={generationMediaType === 'video' ? 'mode-chip active' : 'mode-chip'}
              type="button"
              onClick={() => setGenerationMediaType('video')}
            >
              视频
            </button>
          </div>
          <textarea
            id="prompt"
            className="text-input prompt-input"
            placeholder="例如：环保主题海报，黑白摄影 + 粗体标题"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
          />
          <div className="compact-actions">
            <button className="ghost-btn ghost-btn-dark" type="button" onClick={() => void startMockGeneration(undefined, generationMediaType)}>
              {generationButtonLabel}
            </button>
            <button className="ghost-btn" type="button" onClick={() => fileInputRef.current?.click()}>
              导入参考图
            </button>
          </div>
          <input
            ref={fileInputRef}
            hidden
            accept="image/*"
            type="file"
            onChange={(event) => {
              void handleUpload(event.target.files);
              event.currentTarget.value = '';
            }}
          />
          {state.project.jobs.length > 0 ? (
            <div className="job-strip">
              {state.project.jobs.slice(0, 2).map((job) => (
                <div key={job.id} className={`mini-pill mini-pill-${job.status}`}>
                  <strong>{job.status === 'success' ? '已生成' : job.status === 'failed' ? '失败' : '处理中'}</strong>
                  <span>
                    {job.mediaType === 'video' ? '视频' : '图片'} · {job.prompt.slice(0, 16)}
                  </span>
                </div>
              ))}
            </div>
          ) : null}
        </section>

        <section className="floating-card assets-panel">
          <div className="panel-row">
            <strong>素材托盘</strong>
            <span>{state.project.assets.length}</span>
          </div>
          <div className="assets-strip">
            {state.project.assets.length === 0 ? <p className="empty-state">生成结果和导入素材会先停在这里，点一下即可放入画板。</p> : null}
            {state.project.assets.map((asset) => (
              <button key={asset.id} className="asset-chip" type="button" onClick={() => insertAsset(asset)}>
                <div className={asset.type === 'video' ? 'asset-chip-preview asset-chip-preview-video' : 'asset-chip-preview'}>
                  {asset.type === 'video' ? (
                    <>
                      <video aria-hidden="true" muted playsInline preload="metadata" src={asset.src} poster={asset.posterSrc ?? undefined} />
                      <span className="asset-chip-badge">视频</span>
                    </>
                  ) : (
                    <img alt={asset.name} src={asset.src} />
                  )}
                </div>
                <span>{asset.name}</span>
              </button>
            ))}
          </div>
        </section>

        {!hasCanvasContent ? (
          <section className="canvas-hero">
            <p className="section-kicker">Canvas</p>
            <h1>先生成一张画面，再让右侧助手继续推进。</h1>
            <p>
              当前界面分成三步：左侧输入方向，中间摆放内容，右侧继续对话式修改。这样第一眼就知道该从哪里开始。
            </p>
            <div className="canvas-hero-points">
              <span>1. 输入 prompt</span>
              <span>2. 放入画板</span>
              <span>3. 用对话继续迭代</span>
            </div>
          </section>
        ) : null}

        {selectedNode && selectionToolbarStyle && !isCanvasInteractionActive ? (
          <section className="selection-toolbar" style={selectionToolbarStyle}>
            <div className="selection-pill">
              <span>{selectedNode.type}</span>
            </div>
            <div className="selection-pill">
              <span>
                W {Math.round(normalizeBounds(getCanvasNodeBounds(selectedNode)).w)} H {Math.round(normalizeBounds(getCanvasNodeBounds(selectedNode)).h)}
              </span>
            </div>
            <button className="toolbar-icon-btn" type="button" onClick={() => nudgeLayer('backward')}>
              下移
            </button>
            <button className="toolbar-icon-btn" type="button" onClick={() => nudgeLayer('forward')}>
              上移
            </button>
          </section>
        ) : null}

        <div className={isAgentSidebarOpen ? 'canvas-stage-wrap with-sidebar-offset' : 'canvas-stage-wrap'}>
          <CanvasStage
            project={state.project}
            tool={state.tool}
            selectedId={state.selectedId}
            isSpacePressed={isSpacePressed}
            onInteractionActiveChange={setIsCanvasInteractionActive}
            onSelect={handleSelect}
            onReplaceProject={handleReplaceProject}
            onCommitProject={handleCommitProject}
            onFinalizeMutation={handleFinalizeMutation}
          />
        </div>

        {!isAgentSidebarOpen ? (
          <button
            className="sidebar-peek-toggle"
            type="button"
            onClick={() => setIsAgentSidebarOpen(true)}
            aria-expanded="false"
            aria-controls="agent-sidebar"
          >
            <span>展开</span>
            <strong>设计对话</strong>
          </button>
        ) : null}

        <aside
          id="agent-sidebar"
          className={isAgentSidebarOpen ? 'agent-sidebar' : 'agent-sidebar agent-sidebar-hidden'}
          aria-label="Agent chat sidebar"
          aria-hidden={!isAgentSidebarOpen}
        >
          <div className="agent-sidebar-header">
            <div>
              <p className="section-kicker">Assistant</p>
              <strong>设计对话</strong>
              <p>这里负责跟进当前画板，而不是替代画布本身。</p>
            </div>
            <div className="agent-sidebar-actions">
              <span className="status-pill">{sessionCount} 个会话</span>
              <button className="ghost-btn" type="button" onClick={() => createAndActivateSession()}>
                新建会话
              </button>
              <button
                className="ghost-btn"
                type="button"
                onClick={() => setIsAgentSidebarOpen(false)}
                aria-label="收起聊天面板"
              >
                收起
              </button>
            </div>
          </div>

          {sessionCount > 0 ? (
            <section className="agent-session-list">
              {state.project.chat.sessions.map((session) => (
                <button
                  key={session.id}
                  className={session.id === state.project.chat.activeSessionId ? 'agent-session-item active' : 'agent-session-item'}
                  type="button"
                  onClick={() => activateSession(session.id)}
                >
                  <strong>{session.title}</strong>
                  <span>{session.messages.length} 条消息</span>
                </button>
              ))}
            </section>
          ) : null}

          {selectedNode || selectedAsset || latestJob ? (
            <section className="agent-context-card">
              <div className="panel-row">
                <strong>当前上下文</strong>
                <span>{selectedNode?.type ?? latestJob?.mediaType ?? latestJob?.status ?? 'idle'}</span>
              </div>
              {selectedNode ? <p>已选中 {selectedNode.type} 节点，可继续补文字、改风格或生成变体。</p> : null}
              {selectedAsset ? <p>当前关联资产：{selectedAsset.name} ({selectedAsset.type === 'video' ? '视频' : '图片'})</p> : null}
              {!selectedNode && !selectedAsset && latestJob ? <p>最近一次生成主题：{latestJob.prompt}</p> : null}
            </section>
          ) : null}

          {activeSession ? (
            <div className="chat-thread" ref={chatThreadRef}>
              {activeSession.messages.map((message) => (
                <article
                  key={message.id}
                  className={message.role === 'assistant' ? 'chat-message chat-message-assistant' : 'chat-message chat-message-user'}
                >
                  <div className="chat-meta">
                    <strong>{message.role === 'assistant' ? '设计助理' : '你'}</strong>
                    <span>{new Date(message.createdAt).toLocaleTimeString()}</span>
                  </div>
                  <p>{message.text}</p>
                  {message.suggestions.length > 0 ? (
                    <div className="chat-suggestions">
                      {message.suggestions.map((suggestion) => (
                        <button
                          key={suggestion.id}
                          className="chat-suggestion-btn"
                          type="button"
                          onClick={() => handleSuggestion(suggestion.action)}
                        >
                          {suggestion.label}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          ) : (
            <div className="chat-empty-state">
              <strong>暂无会话</strong>
              <p>新建一个会话，围绕当前画布开始一轮新的设计讨论。你也可以直接输入消息，系统会自动创建会话。</p>
              <button className="ghost-btn ghost-btn-dark" type="button" onClick={() => createAndActivateSession()}>
                新建会话
              </button>
            </div>
          )}

          <form
            className="agent-composer"
            onSubmit={(event) => {
              event.preventDefault();
              if (voiceComposer.status !== 'idle') {
                return;
              }
              submitChatMessage(chatInput);
            }}
          >
            <textarea
              className="text-input chat-input"
              aria-label="发送给设计助理"
              placeholder="继续描述你想补的标题、想换的风格或想生成的下一版"
              value={chatInput}
              onChange={(event) => setChatInput(event.target.value)}
            />
            <div className="agent-composer-footer">
              <span
                className={voiceComposer.errorMessage ? 'agent-composer-status agent-composer-status-error' : 'agent-composer-status'}
                role={voiceComposer.errorMessage ? 'alert' : 'status'}
              >
                {voiceComposer.errorMessage ?? composerStatusText}
              </span>
              <div className="agent-composer-actions">
                <button
                  className={
                    voiceComposer.status === 'recording'
                      ? 'ghost-btn ghost-btn-dark agent-voice-btn agent-voice-btn-recording'
                      : voiceComposer.status === 'transcribing'
                        ? 'ghost-btn ghost-btn-dark agent-voice-btn agent-voice-btn-transcribing'
                        : 'ghost-btn ghost-btn-dark agent-voice-btn'
                  }
                  type="button"
                  onClick={() => {
                    void voiceComposer.toggleRecording();
                  }}
                  aria-label={voiceComposer.status === 'recording' ? '停止录音' : voiceComposer.status === 'transcribing' ? '正在转写' : '开始录音'}
                  aria-pressed={voiceComposer.status === 'recording'}
                  disabled={voiceComposer.status === 'transcribing'}
                >
                  {voiceButtonLabel}
                </button>
                <button className="ghost-btn ghost-btn-dark" type="submit" disabled={voiceComposer.status !== 'idle' || !chatInput.trim()}>
                  发送
                </button>
              </div>
            </div>
          </form>
        </aside>

        <footer className="floating-footer">
          <div className="footer-status">
            <span className="mini-dot" />
            <span>{statsText.assetCount}</span>
            <span>{statsText.scaleText}</span>
          </div>
        </footer>

        <nav className="tool-dock" aria-label="Primary tools">
          {TOOLS.map((item) => (
            <button
              key={item.id}
              className={state.tool === item.id ? 'dock-btn active' : 'dock-btn'}
              onClick={() => setState((prev) => setTool(prev, item.id))}
              type="button"
              aria-label={item.label}
              title={item.label}
            >
              <span className="dock-icon">{item.icon}</span>
              <span className="dock-label">{item.label}</span>
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}

export default App;
