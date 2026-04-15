import { pointInBounds } from '../geometry';
import type { NodeAdapter } from '../contracts';
import type { BoardDoc, RectNode } from '../model';
import { drawNormalizedRect, getBoxBounds, hitResizeHandle, resizeBoxNode, translateBoxNode } from './shared';

export const rectNodeAdapter: NodeAdapter<RectNode, BoardDoc, unknown> = {
  type: 'rect',
  draw(ctx, node, env) {
    drawNormalizedRect(getBoxBounds(node), env.board.viewport, (x, y, w, h) => {
      ctx.save();
      ctx.fillStyle = node.fill ?? 'rgba(59, 130, 246, 0.18)';
      ctx.strokeStyle = node.stroke;
      ctx.lineWidth = 1.5;
      ctx.fillRect(x, y, w, h);
      ctx.strokeRect(x, y, w, h);
      ctx.restore();
    });
  },
  getBounds: getBoxBounds,
  hitTest(node, point, tolerance) {
    return pointInBounds(point, getBoxBounds(node), tolerance);
  },
  translate(node, delta) {
    return translateBoxNode(node, delta);
  },
  resize(node, pointer) {
    return resizeBoxNode(node, pointer);
  },
  hitResizeHandle(node, point, scale, handleSize) {
    return hitResizeHandle(getBoxBounds(node), point, scale, handleSize);
  },
};
