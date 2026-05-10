import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import type { ProjectSummary } from '@infinite-canvas/shared/api';
import { CanvasStage } from './canvas/CanvasStage';
import { AssetsPanel } from './components/AssetsPanel';
import { FloatingFooter } from './components/FloatingFooter';
import { SelectionToolbar } from './components/SelectionToolbar';
import { SidebarPeekToggle } from './components/SidebarPeekToggle';
import { ToolDock } from './components/ToolDock';
import { WorkspaceHeader } from './components/WorkspaceHeader';
import type { AppIconName } from './components/AppIcon';
import { buildCanvasContext } from './features/chat/buildCanvasContext';
import { AgentSidebar } from './features/chat/components/AgentSidebar';
import { useChatSidebarController } from './features/chat/hooks/useChatSidebarController';
import { loadProject, saveProject } from './persistence/local';
import {
  createProjectSummary,
  DEFAULT_PROJECT_TITLE,
  loadRecentProjectSummaries,
  mergeProjectSummaries,
  normalizeProjectTitle,
  saveRecentProjectSummaries,
} from './persistence/project-management';
import { createProjectId, resolveProjectId, setProjectIdInUrl, storeProjectId } from './persistence/project-id';
import {
  createRemoteProject,
  loadRemoteProject,
  loadRemoteProjectSummaries,
  RemoteProjectNotFoundError,
  renameRemoteProject,
} from './persistence/remote';
import { createEmptyProject, createInitialStore, getNodeById, redo, replaceProjectNoHistory, setTool, switchProject, undo } from './state/store';
import { useCanvasGenerationController } from './hooks/useCanvasGenerationController';
import { usePreventBrowserZoom } from './hooks/usePreventBrowserZoom';
import { useCanvasWorkspaceController } from './hooks/useCanvasWorkspaceController';
import { useWorkspaceViewModel } from './hooks/useWorkspaceViewModel';
import type { CanvasStoreState, ConnectorPathMode, Tool } from './types/canvas';
import './index.css';

const TOOLS: Array<{ id: Tool; label: string; icon: AppIconName }> = [
  { id: 'select', label: '选择', icon: 'select' },
  { id: 'pan', label: '平移', icon: 'hand' },
  { id: 'rect', label: '矩形', icon: 'rect' },
  { id: 'freehand', label: '自由线', icon: 'pen' },
  { id: 'text', label: '文本', icon: 'text' },
  { id: 'connector', label: '连线', icon: 'connector' },
];

const ASSET_SIDEBAR_DEFAULT_WIDTH = 264;
const ASSET_SIDEBAR_MIN_WIDTH = 220;
const ASSET_SIDEBAR_MAX_WIDTH = 420;
const AGENT_SIDEBAR_DEFAULT_WIDTH = 380;
const AGENT_SIDEBAR_MIN_WIDTH = 320;
const AGENT_SIDEBAR_MAX_WIDTH = 560;
const SIDEBAR_RESIZE_STEP = 16;

type SidebarResizeSide = 'assets' | 'agent';

function getSelectedNode(state: CanvasStoreState) {
  return getNodeById(state.project.board.nodes, state.selectedId);
}

function clampSidebarWidth(width: number, min: number, max: number): number {
  return Math.min(Math.max(width, min), max);
}

function App() {
  const [projectId, setProjectId] = useState(() => resolveProjectId());
  const [state, setState] = useState<CanvasStoreState>(() =>
    createInitialStore(loadProject(resolveProjectId(), { includeLegacyGlobal: true })),
  );
  const [projectSummaries, setProjectSummaries] = useState<ProjectSummary[]>(() =>
    mergeProjectSummaries(loadRecentProjectSummaries(), [createProjectSummary(resolveProjectId())]),
  );
  const [isRemoteProjectLoadSettled, setIsRemoteProjectLoadSettled] = useState(false);
  const [isAssetSidebarOpen, setIsAssetSidebarOpen] = useState(false);
  const [isAgentSidebarOpen, setIsAgentSidebarOpen] = useState(false);
  const [assetSidebarWidth, setAssetSidebarWidth] = useState(ASSET_SIDEBAR_DEFAULT_WIDTH);
  const [agentSidebarWidth, setAgentSidebarWidth] = useState(AGENT_SIDEBAR_DEFAULT_WIDTH);
  const [activeSidebarResize, setActiveSidebarResize] = useState<SidebarResizeSide | null>(null);
  const [isCanvasInteractionActive, setIsCanvasInteractionActive] = useState(false);
  const [connectorPathMode, setConnectorPathMode] = useState<ConnectorPathMode>('straight');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const chatThreadRef = useRef<HTMLDivElement | null>(null);
  const canvasStageWrapRef = useRef<HTMLDivElement | null>(null);
  const workspaceBodyRef = useRef<HTMLDivElement | null>(null);
  const latestProjectSummariesRef = useRef(projectSummaries);

  usePreventBrowserZoom();

  useEffect(() => {
    latestProjectSummariesRef.current = projectSummaries;
  }, [projectSummaries]);

  const activeProjectSummary = useMemo(
    () => projectSummaries.find((summary) => summary.projectId === projectId) ?? createProjectSummary(projectId),
    [projectId, projectSummaries],
  );

  function updateProjectSummaries(updater: (current: ProjectSummary[]) => ProjectSummary[]): void {
    setProjectSummaries((prev) => {
      const next = updater(prev);
      saveRecentProjectSummaries(next);
      return next;
    });
  }

  function rememberProjectSummary(nextProjectId: string, overrides: Partial<ProjectSummary> = {}): void {
    const existing = latestProjectSummariesRef.current.find((summary) => summary.projectId === nextProjectId);
    const summary = createProjectSummary(nextProjectId, {
      ...existing,
      ...overrides,
      lastOpenedAt: new Date().toISOString(),
    });

    updateProjectSummaries((prev) => mergeProjectSummaries(prev, [summary]));
  }

  function activateProject(nextProjectId: string, project = loadProject(nextProjectId), overrides: Partial<ProjectSummary> = {}): void {
    storeProjectId(nextProjectId);
    setProjectIdInUrl(nextProjectId);
    rememberProjectSummary(nextProjectId, overrides);
    setIsRemoteProjectLoadSettled(false);
    setProjectId(nextProjectId);
    setState((prev) => switchProject(prev, project));
  }

  const selectedNode = useMemo(() => getSelectedNode(state), [state]);
  const selectedNodes = useMemo(
    () => state.selectedIds.map((id) => getNodeById(state.project.board.nodes, id)).filter((node): node is NonNullable<typeof node> => !!node),
    [state.project.board.nodes, state.selectedIds],
  );
  const isSelectedGroup = selectedNode?.type === 'group';
  const { statsText, selectionToolbarStyle } = useWorkspaceViewModel(
    state,
    selectedNodes,
    selectedNode,
  );
  const {
    isSpacePressed,
    canUndo,
    canRedo,
    activeGroupId,
    canExitGroup,
    selectedParentGroupId,
    handleSelect,
    handleEnterGroup,
    handleExitGroup,
    handleCommitProject,
    handleReplaceProject,
    handleFinalizeMutation,
    nudgeLayer,
    createGroupAtViewportCenter,
    groupSelection,
    moveSelectionOutOfGroup,
    dissolveSelectedGroup,
    exportProjectJson,
  } = useCanvasWorkspaceController({
    projectId,
    remoteSaveEnabled: isRemoteProjectLoadSettled,
    onRemoteSaveSuccess: setProjectIdInUrl,
    state,
    setState,
  });

  useEffect(() => {
    let isActive = true;

    async function syncProjectSummaries() {
      try {
        const result = await loadRemoteProjectSummaries();
        if (!isActive) {
          return;
        }

        setProjectSummaries((prev) => {
          const next = mergeProjectSummaries(prev, result.projects);
          saveRecentProjectSummaries(next);
          return next;
        });
      } catch (error) {
        console.info('[web/project-management] remote project list unavailable; using local recent projects', {
          error,
        });
      }
    }

    void syncProjectSummaries();

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    let isActive = true;
    const abortController = new AbortController();

    async function hydrateRemoteProject() {
      try {
        const result = await loadRemoteProject(projectId, { signal: abortController.signal });
        if (!isActive) {
          return;
        }

        setState((prev) => replaceProjectNoHistory(prev, result.project as CanvasStoreState['project']));
        setProjectSummaries((prev) => {
          const next = mergeProjectSummaries(
            prev,
            [createProjectSummary(projectId, { ...result, lastOpenedAt: new Date().toISOString() })],
          );
          saveRecentProjectSummaries(next);
          return next;
        });
      } catch (error) {
        if (error instanceof RemoteProjectNotFoundError) {
          console.info('[web/project-persistence] remote project not found; local cache will seed on next save', {
            projectId,
          });
        } else {
          console.warn('[web/project-persistence] remote project load failed; using local cache', {
            projectId,
            error,
          });
        }
      } finally {
        if (isActive) {
          setIsRemoteProjectLoadSettled(true);
        }
      }
    }

    void hydrateRemoteProject();

    return () => {
      isActive = false;
      abortController.abort();
    };
  }, [projectId]);

  const { handleUpload, insertAsset, applyAgentEffects } = useCanvasGenerationController({
    selectedId: state.selectedId,
    setState,
    stageContainerRef: canvasStageWrapRef,
  });

  const {
    activeSession,
    chatInput,
    setChatInput,
    currentTask,
    streamingAssistantMessage,
    streamingEffects,
    sessionCount,
    sessionHistory,
    voiceComposer,
    composerStatusText,
    voiceButtonLabel,
    createAndActivateSession,
    activateSession,
    submitChatMessage,
    handleSuggestion,
  } = useChatSidebarController({
    projectId,
    project: state.project,
    selectedNode,
    setState,
    onApplyEffects: applyAgentEffects,
    buildCanvasContext,
  });

  useEffect(() => {
    if (!chatThreadRef.current) {
      return;
    }

    chatThreadRef.current.scrollTop = chatThreadRef.current.scrollHeight;
  }, [state.project.chat.activeSessionId, state.project.chat.sessions, streamingAssistantMessage?.text]);

  useEffect(() => {
    if (!activeSidebarResize) {
      return;
    }

    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    function handlePointerMove(event: PointerEvent): void {
      const workspaceRect = workspaceBodyRef.current?.getBoundingClientRect();
      if (!workspaceRect) {
        return;
      }

      if (activeSidebarResize === 'assets') {
        setAssetSidebarWidth(
          clampSidebarWidth(event.clientX - workspaceRect.left, ASSET_SIDEBAR_MIN_WIDTH, ASSET_SIDEBAR_MAX_WIDTH),
        );
        return;
      }

      setAgentSidebarWidth(
        clampSidebarWidth(workspaceRect.right - event.clientX, AGENT_SIDEBAR_MIN_WIDTH, AGENT_SIDEBAR_MAX_WIDTH),
      );
    }

    function handlePointerUp(): void {
      setActiveSidebarResize(null);
    }

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
    };
  }, [activeSidebarResize]);

  const workspaceBodyStyle = {
    '--asset-sidebar-width': `${assetSidebarWidth}px`,
    '--agent-sidebar-width': `${agentSidebarWidth}px`,
  } as CSSProperties;

  function handleSidebarResizeKeyDown(side: SidebarResizeSide, event: ReactKeyboardEvent<HTMLButtonElement>): void {
    const direction = event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : 0;
    if (direction === 0) {
      return;
    }

    event.preventDefault();

    if (side === 'assets') {
      setAssetSidebarWidth((current) =>
        clampSidebarWidth(
          current + direction * SIDEBAR_RESIZE_STEP,
          ASSET_SIDEBAR_MIN_WIDTH,
          ASSET_SIDEBAR_MAX_WIDTH,
        ),
      );
      return;
    }

    setAgentSidebarWidth((current) =>
      clampSidebarWidth(
        current - direction * SIDEBAR_RESIZE_STEP,
        AGENT_SIDEBAR_MIN_WIDTH,
        AGENT_SIDEBAR_MAX_WIDTH,
      ),
    );
  }

  function handleSidebarResizePointerDown(side: SidebarResizeSide, event: ReactPointerEvent<HTMLButtonElement>): void {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setActiveSidebarResize(side);
  }

  async function handleCreateProject(): Promise<void> {
    try {
      const created = await createRemoteProject(DEFAULT_PROJECT_TITLE);
      saveProject(created.project as CanvasStoreState['project'], created.projectId);
      activateProject(created.projectId, created.project as CanvasStoreState['project'], created);
    } catch (error) {
      const nextProjectId = createProjectId();
      const emptyProject = createEmptyProject();
      saveProject(emptyProject, nextProjectId);
      activateProject(nextProjectId, emptyProject, { title: DEFAULT_PROJECT_TITLE });
      console.warn('[web/project-management] remote project creation failed; continuing locally', {
        projectId: nextProjectId,
        error,
      });
    }
  }

  function handleSwitchProject(nextProjectId: string): void {
    if (nextProjectId === projectId) {
      rememberProjectSummary(nextProjectId, {
        title: activeProjectSummary.title,
      });
      return;
    }

    const nextSummary = latestProjectSummariesRef.current.find((summary) => summary.projectId === nextProjectId);
    activateProject(nextProjectId, loadProject(nextProjectId), nextSummary);
  }

  async function handleRenameProject(title: string): Promise<void> {
    const normalizedTitle = normalizeProjectTitle(title);
    rememberProjectSummary(projectId, { title: normalizedTitle });

    try {
      const summary = await renameRemoteProject(projectId, normalizedTitle);
      rememberProjectSummary(projectId, summary);
    } catch (error) {
      console.warn('[web/project-management] remote project rename failed; keeping local title', {
        projectId,
        error,
      });
    }
  }

  return (
    <div className="app-shell">
      <div className={`canvas-shell${isCanvasInteractionActive ? ' interaction-active' : ''}`}>
        <WorkspaceHeader
          projectTitle={activeProjectSummary.title}
          activeProjectId={projectId}
          projects={projectSummaries}
          nodeCountText={statsText.nodeCount}
          scaleText={statsText.scaleText}
          isAgentSidebarOpen={isAgentSidebarOpen}
          canUndo={canUndo}
          canRedo={canRedo}
          onCreateProject={() => {
            void handleCreateProject();
          }}
          onSwitchProject={handleSwitchProject}
          onRenameProject={(title) => {
            void handleRenameProject(title);
          }}
          onToggleSidebar={() => setIsAgentSidebarOpen((prev) => !prev)}
          onUndo={() => setState((prev) => undo(prev))}
          onRedo={() => setState((prev) => redo(prev))}
          onExport={exportProjectJson}
        />

        <div
          ref={workspaceBodyRef}
          className={`workspace-body${isAgentSidebarOpen ? '' : ' workspace-body-agent-collapsed'}${
            isAssetSidebarOpen ? '' : ' workspace-body-assets-collapsed'
          }`}
          style={workspaceBodyStyle}
        >
          <AssetsPanel
            assets={state.project.assets}
            isOpen={isAssetSidebarOpen}
            fileInputRef={fileInputRef}
            onToggle={() => setIsAssetSidebarOpen((prev) => !prev)}
            onUpload={(files) => {
              void handleUpload(files);
            }}
            onInsertAsset={insertAsset}
          />

          {isAssetSidebarOpen ? (
            <button
              type="button"
              className={`sidebar-resize-handle sidebar-resize-handle-assets${
                activeSidebarResize === 'assets' ? ' sidebar-resize-handle-active' : ''
              }`}
              aria-label="调整素材栏宽度"
              aria-orientation="vertical"
              aria-valuemin={ASSET_SIDEBAR_MIN_WIDTH}
              aria-valuemax={ASSET_SIDEBAR_MAX_WIDTH}
              aria-valuenow={assetSidebarWidth}
              role="separator"
              onPointerDown={(event) => handleSidebarResizePointerDown('assets', event)}
              onKeyDown={(event) => handleSidebarResizeKeyDown('assets', event)}
            />
          ) : null}

          <main className="canvas-workspace">
            {selectedNodes.length > 0 && selectionToolbarStyle && !isCanvasInteractionActive ? (
              <SelectionToolbar
                selectedNode={selectedNode}
                selectedCount={selectedNodes.length}
                board={state.project.board}
                style={selectionToolbarStyle}
                onMoveBackward={() => nudgeLayer('backward')}
                onMoveForward={() => nudgeLayer('forward')}
                onEnterGroup={selectedNode && isSelectedGroup ? () => handleEnterGroup(selectedNode.id) : undefined}
                onGroupSelection={
                  !activeGroupId &&
                  selectedNodes.length > 0 &&
                  selectedNodes.every((node) => node.type !== 'connector' && node.type !== 'group')
                    ? groupSelection
                    : undefined
                }
                onMoveOutOfGroup={
                  activeGroupId &&
                  selectedParentGroupId === activeGroupId &&
                  selectedNode?.type !== 'connector' &&
                  !isSelectedGroup
                    ? moveSelectionOutOfGroup
                    : undefined
                }
                onDissolveGroup={isSelectedGroup ? dissolveSelectedGroup : undefined}
              />
            ) : null}

            {activeGroupId && canExitGroup ? (
              <div className="group-context-bar">
                <span>正在编辑成组</span>
                <button type="button" className="toolbar-icon-btn" onClick={handleExitGroup}>
                  退出成组
                </button>
              </div>
            ) : null}

            <div ref={canvasStageWrapRef} className="canvas-stage-wrap">
              <CanvasStage
                project={state.project}
                tool={state.tool}
                connectorPathMode={connectorPathMode}
                selectedId={state.selectedId}
                selectedIds={state.selectedIds}
                activeGroupId={activeGroupId}
                isSpacePressed={isSpacePressed}
                onInteractionActiveChange={setIsCanvasInteractionActive}
                onSelect={handleSelect}
                onReplaceProject={handleReplaceProject}
                onCommitProject={handleCommitProject}
                onFinalizeMutation={handleFinalizeMutation}
              />
            </div>

            {state.project.board.nodes.length === 0 ? (
              <section className="canvas-start-card" aria-label="空白画布启动入口">
                <div className="canvas-start-visual" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </div>
                <div>
                  <p className="section-kicker">Start</p>
                  <h2>上传图片，或者直接与 AI 聊聊</h2>
                  <p>从导入参考图、打开设计对话或直接绘制开始，生成结果会进入素材栏再插入画布。</p>
                </div>
                <div className="canvas-start-actions">
                  <button type="button" className="ghost-btn ghost-btn-dark" onClick={() => setIsAgentSidebarOpen(true)}>
                    打开对话
                  </button>
                  <button type="button" className="ghost-btn" onClick={() => setIsAssetSidebarOpen(true)}>
                    素材栏
                  </button>
                  <button type="button" className="ghost-btn" onClick={() => setState((prev) => setTool(prev, 'freehand'))}>
                    直接绘制
                  </button>
                </div>
              </section>
            ) : null}

            <FloatingFooter assetCountText={statsText.assetCount} scaleText={statsText.scaleText} />
            <ToolDock
              tools={TOOLS}
              activeTool={state.tool}
              connectorPathMode={connectorPathMode}
              onCreateGroup={createGroupAtViewportCenter}
              onSelectTool={(tool) => setState((prev) => setTool(prev, tool))}
              onSelectConnectorPathMode={setConnectorPathMode}
            />
          </main>

          {isAgentSidebarOpen ? (
            <>
              <button
                type="button"
                className={`sidebar-resize-handle sidebar-resize-handle-agent${
                  activeSidebarResize === 'agent' ? ' sidebar-resize-handle-active' : ''
                }`}
                aria-label="调整对话栏宽度"
                aria-orientation="vertical"
                aria-valuemin={AGENT_SIDEBAR_MIN_WIDTH}
                aria-valuemax={AGENT_SIDEBAR_MAX_WIDTH}
                aria-valuenow={agentSidebarWidth}
                role="separator"
                onPointerDown={(event) => handleSidebarResizePointerDown('agent', event)}
                onKeyDown={(event) => handleSidebarResizeKeyDown('agent', event)}
              />
              <AgentSidebar
                isOpen={isAgentSidebarOpen}
                sessionCount={sessionCount}
                sessions={state.project.chat.sessions}
                sessionHistory={sessionHistory}
                activeSessionId={state.project.chat.activeSessionId}
                activeSession={activeSession}
                currentTask={currentTask}
                streamingAssistantMessage={streamingAssistantMessage}
                streamingEffects={streamingEffects}
                chatInput={chatInput}
                composerStatusText={composerStatusText}
                voiceButtonLabel={voiceButtonLabel}
                voiceComposer={voiceComposer}
                chatThreadRef={chatThreadRef}
                onCreateSession={() => createAndActivateSession()}
                onActivateSession={activateSession}
                onClose={() => setIsAgentSidebarOpen(false)}
                onChatInputChange={setChatInput}
                onSubmitChat={() => {
                  void submitChatMessage(chatInput);
                }}
                onSuggestion={handleSuggestion}
              />
            </>
          ) : (
            <div className="agent-sidebar-slot" aria-hidden="true" />
          )}
        </div>

        {!isAgentSidebarOpen ? <SidebarPeekToggle onOpen={() => setIsAgentSidebarOpen(true)} /> : null}
      </div>
    </div>
  );
}

export default App;
