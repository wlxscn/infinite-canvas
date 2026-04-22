import { useEffect, useRef, useState } from 'react';
import type { ProjectSummary } from '@infinite-canvas/shared/api';

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
        <button className="ghost-btn" type="button" onClick={onCreateProject}>
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
              <button
                key={project.projectId}
                className={`project-switcher-item${project.projectId === activeProjectId ? ' project-switcher-item-active' : ''}`}
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
            ))}
          </div>
        </div>
      </div>

      <div className="header-cluster header-actions">
        <span className="status-pill">{nodeCountText}</span>
        <span className="status-pill">{scaleText}</span>
        <button className="ghost-btn" type="button" onClick={handleRenameProject}>
          重命名
        </button>
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
