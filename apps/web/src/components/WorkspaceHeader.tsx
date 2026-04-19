interface WorkspaceHeaderProps {
  nodeCountText: string;
  scaleText: string;
  isAgentSidebarOpen: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onToggleSidebar: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onExport: () => void;
}

export function WorkspaceHeader({
  nodeCountText,
  scaleText,
  isAgentSidebarOpen,
  canUndo,
  canRedo,
  onToggleSidebar,
  onUndo,
  onRedo,
  onExport,
}: WorkspaceHeaderProps) {
  return (
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
        <span className="status-pill">{nodeCountText}</span>
        <span className="status-pill">{scaleText}</span>
        <button className="ghost-btn" type="button" onClick={onToggleSidebar} aria-expanded={isAgentSidebarOpen} aria-controls="agent-sidebar">
          {isAgentSidebarOpen ? '收起对话' : '展开对话'}
        </button>
        <button className="ghost-btn" type="button" disabled={!canUndo} onClick={onUndo}>
          撤销
        </button>
        <button className="ghost-btn" type="button" disabled={!canRedo} onClick={onRedo}>
          重做
        </button>
        <button className="ghost-btn" type="button" onClick={onExport}>
          导出
        </button>
      </div>
    </header>
  );
}
