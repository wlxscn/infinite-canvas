interface SidebarPeekToggleProps {
  onOpen: () => void;
}

export function SidebarPeekToggle({ onOpen }: SidebarPeekToggleProps) {
  return (
    <button
      className="sidebar-peek-toggle"
      type="button"
      onClick={onOpen}
      aria-label="展开设计对话"
      aria-expanded="false"
      aria-controls="agent-sidebar"
    >
      <span className="sidebar-peek-icon" aria-hidden="true">
        ◐
      </span>
      <span className="sidebar-peek-label" aria-hidden="true">
        Chat
      </span>
    </button>
  );
}
