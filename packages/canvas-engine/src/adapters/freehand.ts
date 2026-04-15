import { boundsFromPoints, distanceToSegment } from '../geometry';
import { worldToScreen } from '../transform';
import type { NodeAdapter } from '../contracts';
import type { BoardDoc, FreehandNode } from '../model';

export const freehandNodeAdapter: NodeAdapter<FreehandNode, BoardDoc, unknown> = {
  type: 'freehand',
  draw(ctx, node, env) {
    if (node.points.length < 2) {
      return;
    }

    ctx.save();
    ctx.strokeStyle = node.stroke;
    ctx.lineWidth = node.width * env.board.viewport.scale;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const first = worldToScreen(node.points[0], env.board.viewport);
    ctx.beginPath();
    ctx.moveTo(first.x, first.y);

    for (let index = 1; index < node.points.length; index += 1) {
      const point = worldToScreen(node.points[index], env.board.viewport);
      ctx.lineTo(point.x, point.y);
    }

    ctx.stroke();
    ctx.restore();
  },
  getBounds(node) {
    return boundsFromPoints(node.points);
  },
  hitTest(node, point, tolerance) {
    if (node.points.length < 2) {
      return false;
    }

    for (let index = 0; index < node.points.length - 1; index += 1) {
      if (distanceToSegment(point, node.points[index], node.points[index + 1]) <= tolerance + node.width / 2) {
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
