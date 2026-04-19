import type { CSSProperties } from 'react';
import { getCanvasNodeBounds, normalizeBounds } from '@infinite-canvas/canvas-engine';
import type { CanvasNode } from '../types/canvas';

interface SelectionToolbarProps {
  selectedNode: CanvasNode | null;
  selectedCount: number;
  board: import('../types/canvas').BoardDoc;
  style: CSSProperties;
  onMoveBackward: () => void;
  onMoveForward: () => void;
  onEnterGroup?: () => void;
  onGroupSelection?: () => void;
  onMoveOutOfGroup?: () => void;
  onDissolveGroup?: () => void;
}

export function SelectionToolbar({
  selectedNode,
  selectedCount,
  board,
  style,
  onMoveBackward,
  onMoveForward,
  onEnterGroup,
  onGroupSelection,
  onMoveOutOfGroup,
  onDissolveGroup,
}: SelectionToolbarProps) {
  if (!selectedNode && selectedCount <= 1) {
    return null;
  }

  const bounds =
    selectedNode && selectedCount === 1 ? normalizeBounds(getCanvasNodeBounds(selectedNode, board)) : { w: 0, h: 0 };
  const isGroupNode = selectedNode?.type === 'group';
  const isMultiSelection = selectedCount > 1;

  return (
    <section
      className="selection-toolbar"
      style={style}
      aria-label="选中对象工具栏"
      data-node-type={selectedNode?.type ?? 'multi'}
    >
      <div className="selection-pill">
        <span>{isMultiSelection ? `已选 ${selectedCount} 项` : selectedNode?.type}</span>
      </div>
      {!isMultiSelection ? (
        <div className="selection-pill">
          <span>
            W {Math.round(bounds.w)} H {Math.round(bounds.h)}
          </span>
        </div>
      ) : null}
      {!isMultiSelection ? (
        <button className="toolbar-icon-btn" type="button" onClick={onMoveBackward}>
          下移
        </button>
      ) : null}
      {!isMultiSelection ? (
        <button className="toolbar-icon-btn" type="button" onClick={onMoveForward}>
          上移
        </button>
      ) : null}
      {!isMultiSelection && isGroupNode && onEnterGroup ? (
        <button className="toolbar-icon-btn" type="button" onClick={onEnterGroup}>
          进入
        </button>
      ) : null}
      {(!isGroupNode || isMultiSelection) && onGroupSelection ? (
        <button className="toolbar-icon-btn" type="button" onClick={onGroupSelection}>
          成组
        </button>
      ) : null}
      {!isMultiSelection && !isGroupNode && selectedNode?.type !== 'connector' && onMoveOutOfGroup ? (
        <button className="toolbar-icon-btn" type="button" onClick={onMoveOutOfGroup}>
          移出成组
        </button>
      ) : null}
      {!isMultiSelection && isGroupNode && onDissolveGroup ? (
        <button className="toolbar-icon-btn" type="button" onClick={onDissolveGroup}>
          拆分组
        </button>
      ) : null}
    </section>
  );
}
