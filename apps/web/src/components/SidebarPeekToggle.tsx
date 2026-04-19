interface SidebarPeekToggleProps {
  onOpen: () => void;
}

export function SidebarPeekToggle({ onOpen }: SidebarPeekToggleProps) {
  return (
    <button className="sidebar-peek-toggle" type="button" onClick={onOpen} aria-expanded="false" aria-controls="agent-sidebar">
      <span>展开</span>
      <strong>设计对话</strong>
    </button>
  );
}
