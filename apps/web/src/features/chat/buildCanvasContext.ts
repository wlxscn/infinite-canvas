import { getAllDescendantNodes } from '@infinite-canvas/canvas-engine';
import type { CanvasContextPayload } from '@infinite-canvas/shared/canvas-context';
import type { CanvasNode, CanvasProject } from '../../types/canvas';

export function buildCanvasContext(project: CanvasProject, selectedNode: CanvasNode | null): CanvasContextPayload {
  return {
    selectedNode:
      selectedNode && selectedNode.type !== 'image'
        ? {
            id: selectedNode.id,
            type: selectedNode.type,
            text: selectedNode.type === 'text' ? selectedNode.text : undefined,
          }
        : selectedNode
          ? {
              id: selectedNode.id,
              type: selectedNode.type,
            }
          : null,
    latestPrompt: project.jobs[0]?.prompt ?? null,
    nodeCount: getAllDescendantNodes(project.board.nodes).length,
    assetCount: project.assets.length,
    recentAssets: project.assets.slice(0, 3).map((asset) => ({
      id: asset.id,
      name: asset.name,
      origin: asset.origin,
    })),
  };
}
