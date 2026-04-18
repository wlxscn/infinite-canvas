import { boundsFromPoints, distanceToSegment } from '../geometry';
import type { NodeAdapter } from '../contracts';
import type { BoardDoc, ConnectorNode } from '../model';
import { resolveConnectorPoints } from '../anchors';
import type { AssetRecordLike, CanvasRenderRuntime } from '../runtime';
import { worldToScreen } from '../transform';

export const connectorNodeAdapter: NodeAdapter<ConnectorNode, BoardDoc, CanvasRenderRuntime<AssetRecordLike>> = {
  type: 'connector',
  draw(ctx, node, env) {
    const points = resolveConnectorPoints(node, env.board);
    if (!points) {
      return;
    }

    const start = worldToScreen(points.start, env.board.viewport);
    const end = worldToScreen(points.end, env.board.viewport);

    ctx.save();
    ctx.strokeStyle = node.stroke;
    ctx.lineWidth = Math.max(node.width * env.board.viewport.scale, 1.5);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
    ctx.restore();
  },
  getBounds(node, board) {
    const points = board ? resolveConnectorPoints(node, board) : null;
    if (!points) {
      return { x: 0, y: 0, w: 0, h: 0 };
    }

    return boundsFromPoints([points.start, points.end]);
  },
  hitTest(node, point, tolerance, board) {
    const points = board ? resolveConnectorPoints(node, board) : null;
    if (!points) {
      return false;
    }

    return distanceToSegment(point, points.start, points.end) <= tolerance + node.width / 2;
  },
  translate(node, delta) {
    return {
      ...node,
      start:
        node.start.kind === 'free'
          ? {
              ...node.start,
              x: node.start.x + delta.x,
              y: node.start.y + delta.y,
            }
          : node.start,
      end:
        node.end.kind === 'free'
          ? {
              ...node.end,
              x: node.end.x + delta.x,
              y: node.end.y + delta.y,
            }
          : node.end,
    };
  },
};
