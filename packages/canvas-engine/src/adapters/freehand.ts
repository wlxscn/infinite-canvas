import { boundsFromPoints, distanceToSegment } from '../geometry';
import { resolveNodeToWorld } from '../hierarchy';
import { worldToScreen } from '../transform';
import type { NodeAdapter } from '../contracts';
import type { BoardDoc, FreehandNode } from '../model';

export const freehandNodeAdapter: NodeAdapter<FreehandNode, BoardDoc, unknown> = {
  type: 'freehand',
  draw(ctx, node, env) {
    const worldNode = resolveNodeToWorld(node, env.board);
    if (worldNode.points.length < 2) {
      return;
    }

    ctx.save();
    ctx.strokeStyle = node.stroke;
    ctx.lineWidth = node.width * env.board.viewport.scale;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const first = worldToScreen(worldNode.points[0], env.board.viewport);
    ctx.beginPath();
    ctx.moveTo(first.x, first.y);

    for (let index = 1; index < worldNode.points.length; index += 1) {
      const point = worldToScreen(worldNode.points[index], env.board.viewport);
      ctx.lineTo(point.x, point.y);
    }

    ctx.stroke();
    ctx.restore();
  },
  getBounds(node, board) {
    return boundsFromPoints(resolveNodeToWorld(node, board).points);
  },
  hitTest(node, point, tolerance, board) {
    const worldNode = resolveNodeToWorld(node, board);
    if (worldNode.points.length < 2) {
      return false;
    }

    for (let index = 0; index < worldNode.points.length - 1; index += 1) {
      if (distanceToSegment(point, worldNode.points[index], worldNode.points[index + 1]) <= tolerance + worldNode.width / 2) {
        return true;
      }
    }

    return false;
  },
  translate(node, delta) {
    return {
      ...node,
      points: node.points.map((point) => ({
        x: point.x + delta.x,
        y: point.y + delta.y,
      })),
    };
  },
};
