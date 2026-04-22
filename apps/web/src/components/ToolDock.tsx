import type { ConnectorPathMode, Tool } from '../types/canvas';

interface ToolDockProps {
  tools: Array<{ id: Tool; label: string; icon: string }>;
  activeTool: Tool;
  connectorPathMode: ConnectorPathMode;
  onCreateGroup: () => void;
  onSelectTool: (tool: Tool) => void;
  onSelectConnectorPathMode: (mode: ConnectorPathMode) => void;
}

export function ToolDock({
  tools,
  activeTool,
  connectorPathMode,
  onCreateGroup,
  onSelectTool,
  onSelectConnectorPathMode,
}: ToolDockProps) {
  return (
    <div className="tool-dock-wrap">
      {activeTool === 'connector' ? (
        <div className="connector-mode-switch" role="group" aria-label="连线路径模式">
          <button
            type="button"
            className={connectorPathMode === 'straight' ? 'connector-mode-btn active' : 'connector-mode-btn'}
            onClick={() => onSelectConnectorPathMode('straight')}
          >
            直线
          </button>
          <button
            type="button"
            className={connectorPathMode === 'polyline' ? 'connector-mode-btn active' : 'connector-mode-btn'}
            onClick={() => onSelectConnectorPathMode('polyline')}
          >
            折线
          </button>
          <button
            type="button"
            className={connectorPathMode === 'curve' ? 'connector-mode-btn active' : 'connector-mode-btn'}
            onClick={() => onSelectConnectorPathMode('curve')}
          >
            曲线
          </button>
        </div>
      ) : null}

      <nav className="tool-dock" aria-label="Primary tools">
        <button className="dock-btn" onClick={onCreateGroup} type="button" aria-label="新建成组" title="新建成组">
          <span className="dock-icon">▣</span>
          <span className="dock-label">成组</span>
        </button>
        {tools.map((item) => (
          <button
            key={item.id}
            className={activeTool === item.id ? 'dock-btn active' : 'dock-btn'}
            onClick={() => onSelectTool(item.id)}
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
  );
}
