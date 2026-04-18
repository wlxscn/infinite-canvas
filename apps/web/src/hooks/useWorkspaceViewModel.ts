import { useMemo } from 'react';
import { getCanvasNodeBounds, normalizeBounds, worldToScreen } from '@infinite-canvas/canvas-engine';
import { getAssetById } from '../state/store';
import type { CanvasNode, CanvasStoreState } from '../types/canvas';

export function useWorkspaceViewModel(state: CanvasStoreState, selectedNode: CanvasNode | null) {
  const selectedAsset = useMemo(() => {
    if (!selectedNode || (selectedNode.type !== 'image' && selectedNode.type !== 'video')) {
      return null;
    }

    return getAssetById(state.project.assets, selectedNode.assetId);
  }, [selectedNode, state.project.assets]);

  const statsText = useMemo(
    () => ({
      nodeCount: `节点 ${state.project.board.nodes.length}`,
      scaleText: `${(state.project.board.viewport.scale * 100).toFixed(0)}%`,
      assetCount: `资产 ${state.project.assets.length}`,
    }),
    [state.project],
  );

  const selectionToolbarStyle = useMemo(() => {
    if (!selectedNode) {
      return null;
    }

    const bounds = normalizeBounds(getCanvasNodeBounds(selectedNode, state.project.board));
    const topLeft = worldToScreen({ x: bounds.x, y: bounds.y }, state.project.board.viewport);
    const width = bounds.w * state.project.board.viewport.scale;
    const top = Math.max(topLeft.y - 68, 84);

    return {
      left: `clamp(24px, ${topLeft.x + width / 2}px, calc(100% - 24px))`,
      top: `${top}px`,
    };
  }, [selectedNode, state.project.board]);

  return {
    selectedAsset,
    statsText,
    selectionToolbarStyle,
    hasCanvasContent: state.project.board.nodes.length > 0 || state.project.assets.length > 0,
    latestJob: state.project.jobs[0] ?? null,
  };
}
