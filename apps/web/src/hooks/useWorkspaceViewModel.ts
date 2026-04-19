import { useMemo } from 'react';
import { getAllDescendantNodes, getCanvasNodeBounds, normalizeBounds, worldToScreen } from '@infinite-canvas/canvas-engine';
import { getAssetById } from '../state/store';
import type { CanvasNode, CanvasStoreState } from '../types/canvas';

export function useWorkspaceViewModel(state: CanvasStoreState, selectedNodes: CanvasNode[], selectedNode: CanvasNode | null) {
  const selectedAsset = useMemo(() => {
    if (selectedNodes.length !== 1 || !selectedNode || (selectedNode.type !== 'image' && selectedNode.type !== 'video')) {
      return null;
    }

    return getAssetById(state.project.assets, selectedNode.assetId);
  }, [selectedNode, selectedNodes.length, state.project.assets]);

  const statsText = useMemo(
    () => ({
      nodeCount: `节点 ${getAllDescendantNodes(state.project.board.nodes).length}`,
      scaleText: `${(state.project.board.viewport.scale * 100).toFixed(0)}%`,
      assetCount: `资产 ${state.project.assets.length}`,
    }),
    [state.project],
  );

  const selectionToolbarStyle = useMemo(() => {
    if (selectedNodes.length === 0) {
      return null;
    }

    const normalizedBounds = selectedNodes.map((node) => normalizeBounds(getCanvasNodeBounds(node, state.project.board)));
    const bounds = normalizedBounds.reduce(
      (current, next) => ({
        x: Math.min(current.x, next.x),
        y: Math.min(current.y, next.y),
        w: Math.max(current.x + current.w, next.x + next.w) - Math.min(current.x, next.x),
        h: Math.max(current.y + current.h, next.y + next.h) - Math.min(current.y, next.y),
      }),
      normalizedBounds[0],
    );
    const topLeft = worldToScreen({ x: bounds.x, y: bounds.y }, state.project.board.viewport);
    const width = bounds.w * state.project.board.viewport.scale;
    const top = Math.max(topLeft.y - 68, 84);

    return {
      left: `clamp(24px, ${topLeft.x + width / 2}px, calc(100% - 24px))`,
      top: `${top}px`,
    };
  }, [selectedNodes, state.project.board]);

  return {
    selectedAsset,
    statsText,
    selectionToolbarStyle,
    hasCanvasContent: getAllDescendantNodes(state.project.board.nodes).length > 0 || state.project.assets.length > 0,
    latestJob: state.project.jobs[0] ?? null,
  };
}
