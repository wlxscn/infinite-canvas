import { useEffect, useRef, useState } from 'react';
import type { ProjectSummary } from '@infinite-canvas/shared/api';
import { AppIcon } from './AppIcon';

interface WorkspaceHeaderProps {
  projectTitle: string;
  activeProjectId: string;
  projects: ProjectSummary[];
  nodeCountText: string;
  scaleText: string;
  isAgentSidebarOpen: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onCreateProject: () => void;
  onSwitchProject: (projectId: string) => void;
  onDeleteProject: (projectId: string) => void;
  onRenameProject: (title: string) => void;
  onToggleSidebar: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onExport: () => void;
}

export function WorkspaceHeader({
  projectTitle,
  activeProjectId,
  projects,
  nodeCountText,
  scaleText,
  isAgentSidebarOpen,
  canUndo,
  canRedo,
  onCreateProject,
  onSwitchProject,
  onDeleteProject,
  onRenameProject,
  onToggleSidebar,
  onUndo,
  onRedo,
  onExport,
}: WorkspaceHeaderProps) {
  const [isProjectSwitcherOpen, setIsProjectSwitcherOpen] = useState(false);
  const projectSwitcherRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isProjectSwitcherOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent): void {
      if (!projectSwitcherRef.current?.contains(event.target as Node)) {
        setIsProjectSwitcherOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        setIsProjectSwitcherOpen(false);
      }
    }

    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleEscape);

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isProjectSwitcherOpen]);

  function handleRenameProject(): void {
    const nextTitle = window.prompt('输入新的画布标题', projectTitle);
    if (typeof nextTitle !== 'string') {
      return;
    }

    onRenameProject(nextTitle);
  }

  return (
    <header className="floating-header">
      <div className="header-cluster">
        <button className="brand-dot" type="button" aria-label="Workspace home">
          IC
        </button>
        <div className="header-title">
          <strong>{projectTitle}</strong>
          <span>管理多张画布，并在右侧持续迭代</span>
        </div>
        <button className="ghost-btn create-project-btn" type="button" onClick={onCreateProject}>
          新建画布
        </button>
        <div className="project-switcher" ref={projectSwitcherRef}>
          <button
            className={`ghost-btn${isProjectSwitcherOpen ? ' ghost-btn-active' : ''}`}
            type="button"
            aria-expanded={isProjectSwitcherOpen}
            aria-haspopup="menu"
            onClick={() => setIsProjectSwitcherOpen((prev) => !prev)}
          >
            最近画布
          </button>
          <div
            className={`project-switcher-menu${isProjectSwitcherOpen ? ' project-switcher-menu-open' : ''}`}
            role="menu"
            aria-hidden={!isProjectSwitcherOpen}
          >
            {projects.map((project) => (
              <div
                key={project.projectId}
                className={`project-switcher-item${project.projectId === activeProjectId ? ' project-switcher-item-active' : ''}`}
              >
                <button
                  className="project-switcher-item-main"
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    onSwitchProject(project.projectId);
                    setIsProjectSwitcherOpen(false);
                  }}
                >
                  <strong>{project.title}</strong>
                  <span>{project.projectId === activeProjectId ? '当前画布' : '切换到此画布'}</span>
                </button>
                <button
                  className="project-switcher-item-delete"
                  type="button"
                  aria-label={`删除画布${project.title}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    if (window.confirm(`确定删除画布「${project.title}」吗？此操作不可撤销。`)) {
                      onDeleteProject(project.projectId);
                    }
                  }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="header-cluster header-actions">
        <span className="status-pill">{nodeCountText}</span>
        <span className="status-pill">{scaleText}</span>
        <button className="icon-btn header-icon-btn" type="button" onClick={handleRenameProject} aria-label="重命名" title="重命名">
          <AppIcon name="pen" />
        </button>
        <button
          className="icon-btn header-icon-btn mobile-priority-action"
          type="button"
          onClick={onToggleSidebar}
          aria-label={isAgentSidebarOpen ? '收起对话' : '展开对话'}
          title={isAgentSidebarOpen ? '收起对话' : '展开对话'}
          aria-expanded={isAgentSidebarOpen}
          aria-controls="agent-sidebar"
        >
          <AppIcon name="chat" />
        </button>
        <button className="icon-btn header-icon-btn" type="button" disabled={!canUndo} onClick={onUndo} aria-label="撤销" title="撤销">
          <AppIcon name="undo" />
        </button>
        <button className="icon-btn header-icon-btn" type="button" disabled={!canRedo} onClick={onRedo} aria-label="重做" title="重做">
          <AppIcon name="redo" />
        </button>
        <button className="icon-btn header-icon-btn mobile-priority-action" type="button" onClick={onExport} aria-label="导出" title="导出">
          <AppIcon name="download" />
        </button>
      </div>
    </header>
  );
}
