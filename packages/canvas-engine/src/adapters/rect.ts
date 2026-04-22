import type { NodeAdapter } from '../contracts';
import type { BoardDoc, RectNode } from '../model';
import { drawRotatedBox, getBoxBounds, hitResizeHandle, hitRotatedBox, resizeBoxNode, translateBoxNode } from './shared';

export const rectNodeAdapter: NodeAdapter<RectNode, BoardDoc, unknown> = {
  type: 'rect',
  draw(ctx, node, env) {
    drawRotatedBox(ctx, node, env.board, (drawCtx, x, y, w, h) => {
      drawCtx.save();
      drawCtx.fillStyle = node.fill ?? 'rgba(59, 130, 246, 0.18)';
      drawCtx.strokeStyle = node.stroke;
      drawCtx.lineWidth = 1.5;
      drawCtx.fillRect(x, y, w, h);
      drawCtx.strokeRect(x, y, w, h);
      drawCtx.restore();
    });
  },
  getBounds(node, board) {
    return getBoxBounds(node, board);
  },
  hitTest(node, point, tolerance, board) {
    return hitRotatedBox(node, point, tolerance, board);
  },
  translate(node, delta) {
    return translateBoxNode(node, delta);
  },
  resize(node, pointer) {
    return resizeBoxNode(node, pointer);
  },
  hitResizeHandle(node, point, scale, handleSize, board) {
    return hitResizeHandle(node, point, scale, handleSize, board);
  },
};
