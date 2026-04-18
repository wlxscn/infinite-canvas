import type { CSSProperties } from 'react';
import { getCanvasNodeBounds, normalizeBounds } from '@infinite-canvas/canvas-engine';
import type { CanvasNode } from '../types/canvas';

interface SelectionToolbarProps {
  selectedNode: CanvasNode;
  board: import('../types/canvas').BoardDoc;
  style: CSSProperties;
  onMoveBackward: () => void;
  onMoveForward: () => void;
}

export function SelectionToolbar({ selectedNode, board, style, onMoveBackward, onMoveForward }: SelectionToolbarProps) {
  const bounds = normalizeBounds(getCanvasNodeBounds(selectedNode, board));

  return (
    <section
      className="selection-toolbar"
      style={style}
      aria-label="选中对象工具栏"
      data-node-type={selectedNode.type}
    >
      <div className="selection-pill">
        <span>{selectedNode.type}</span>
      </div>
      <div className="selection-pill">
        <span>
          W {Math.round(bounds.w)} H {Math.round(bounds.h)}
        </span>
      </div>
      <button className="toolbar-icon-btn" type="button" onClick={onMoveBackward}>
        下移
      </button>
      <button className="toolbar-icon-btn" type="button" onClick={onMoveForward}>
        上移
      </button>
    </section>
  );
}
