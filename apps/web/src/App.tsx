import { useEffect, useMemo, useRef, useState } from 'react';
import { CanvasStage } from './canvas/CanvasStage';
import { AssetsPanel } from './components/AssetsPanel';
import { CanvasHero } from './components/CanvasHero';
import { FloatingFooter } from './components/FloatingFooter';
import { SelectionToolbar } from './components/SelectionToolbar';
import { SidebarPeekToggle } from './components/SidebarPeekToggle';
import { ToolDock } from './components/ToolDock';
import { WorkspaceHeader } from './components/WorkspaceHeader';
import { buildCanvasContext } from './features/chat/buildCanvasContext';
import { AgentSidebar } from './features/chat/components/AgentSidebar';
import { useChatSidebarController } from './features/chat/hooks/useChatSidebarController';
import { loadProject } from './persistence/local';
import { createInitialStore, getNodeById, redo, setTool, undo } from './state/store';
import { useCanvasGenerationController } from './hooks/useCanvasGenerationController';
import { usePreventBrowserZoom } from './hooks/usePreventBrowserZoom';
import { useCanvasWorkspaceController } from './hooks/useCanvasWorkspaceController';
import { useWorkspaceViewModel } from './hooks/useWorkspaceViewModel';
import type { CanvasStoreState, ConnectorPathMode, Tool } from './types/canvas';
import './index.css';

const TOOLS: Array<{ id: Tool; label: string; icon: string }> = [
  { id: 'select', label: '选择', icon: '◢' },
  { id: 'pan', label: '平移', icon: '◎' },
  { id: 'rect', label: '矩形', icon: '▢' },
  { id: 'freehand', label: '自由线', icon: '✎' },
  { id: 'text', label: '文本', icon: 'T' },
  { id: 'connector', label: '连线', icon: '↗' },
];

function getSelectedNode(state: CanvasStoreState) {
  return getNodeById(state.project.board.nodes, state.selectedId);
}

function App() {
  const [state, setState] = useState<CanvasStoreState>(() => createInitialStore(loadProject()));
  const [isAssetSidebarOpen, setIsAssetSidebarOpen] = useState(true);
  const [isAgentSidebarOpen, setIsAgentSidebarOpen] = useState(true);
  const [isCanvasInteractionActive, setIsCanvasInteractionActive] = useState(false);
  const [connectorPathMode, setConnectorPathMode] = useState<ConnectorPathMode>('straight');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const chatThreadRef = useRef<HTMLDivElement | null>(null);
  const canvasStageWrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!chatThreadRef.current) {
      return;
    }

    chatThreadRef.current.scrollTop = chatThreadRef.current.scrollHeight;
  }, [state.project.chat.activeSessionId, state.project.chat.sessions]);

  usePreventBrowserZoom();

  const selectedNode = useMemo(() => getSelectedNode(state), [state]);
  const isSelectedGroup = selectedNode?.type === 'group';
  const { selectedAsset, statsText, selectionToolbarStyle, hasCanvasContent, latestJob } = useWorkspaceViewModel(state, selectedNode);
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
    state,
    setState,
  });

  const { handleUpload, insertAsset, applyAgentEffects } = useCanvasGenerationController({
    selectedId: state.selectedId,
    setState,
    stageContainerRef: canvasStageWrapRef,
  });

  const {
    activeSession,
    chatInput,
    setChatInput,
    sessionCount,
    voiceComposer,
    composerStatusText,
    voiceButtonLabel,
    createAndActivateSession,
    activateSession,
    submitChatMessage,
    handleSuggestion,
  } = useChatSidebarController({
    project: state.project,
    selectedNode,
    setState,
    onApplyEffects: applyAgentEffects,
    buildCanvasContext,
  });

  return (
    <div className="app-shell">
      <div className={`canvas-shell${isCanvasInteractionActive ? ' interaction-active' : ''}`}>
        <WorkspaceHeader
          nodeCountText={statsText.nodeCount}
          scaleText={statsText.scaleText}
          isAgentSidebarOpen={isAgentSidebarOpen}
          canUndo={canUndo}
          canRedo={canRedo}
          onToggleSidebar={() => setIsAgentSidebarOpen((prev) => !prev)}
          onUndo={() => setState((prev) => undo(prev))}
          onRedo={() => setState((prev) => redo(prev))}
          onExport={exportProjectJson}
        />

        <div
          className={`workspace-body${isAgentSidebarOpen ? '' : ' workspace-body-agent-collapsed'}${
            isAssetSidebarOpen ? '' : ' workspace-body-assets-collapsed'
          }`}
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

          <main className="canvas-workspace">
            {!hasCanvasContent ? <CanvasHero /> : null}

            {selectedNode && selectionToolbarStyle && !isCanvasInteractionActive ? (
              <SelectionToolbar
                selectedNode={selectedNode}
                board={state.project.board}
                style={selectionToolbarStyle}
                onMoveBackward={() => nudgeLayer('backward')}
                onMoveForward={() => nudgeLayer('forward')}
                onEnterGroup={isSelectedGroup ? () => handleEnterGroup(selectedNode.id) : undefined}
                onGroupSelection={
                  !activeGroupId && !isSelectedGroup && selectedNode.type !== 'connector'
                    ? groupSelection
                    : undefined
                }
                onMoveOutOfGroup={
                  activeGroupId &&
                  selectedParentGroupId === activeGroupId &&
                  selectedNode.type !== 'connector' &&
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
                activeGroupId={activeGroupId}
                isSpacePressed={isSpacePressed}
                onInteractionActiveChange={setIsCanvasInteractionActive}
                onSelect={handleSelect}
                onReplaceProject={handleReplaceProject}
                onCommitProject={handleCommitProject}
                onFinalizeMutation={handleFinalizeMutation}
              />
            </div>

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
            <AgentSidebar
              isOpen={isAgentSidebarOpen}
              sessionCount={sessionCount}
              sessions={state.project.chat.sessions}
              activeSessionId={state.project.chat.activeSessionId}
              activeSession={activeSession}
              selectedNode={selectedNode}
              selectedAsset={selectedAsset}
              latestJob={latestJob}
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
