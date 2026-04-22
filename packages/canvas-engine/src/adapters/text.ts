import type { NodeAdapter } from '../contracts';
import type { BoardDoc, TextNode } from '../model';
import { drawRotatedBox, getBoxBounds, hitResizeHandle, hitRotatedBox, resizeBoxNode, translateBoxNode } from './shared';

export const textNodeAdapter: NodeAdapter<TextNode, BoardDoc, unknown> = {
  type: 'text',
  draw(ctx, node, env) {
    drawRotatedBox(ctx, node, env.board, (drawCtx, x, y, w, h) => {
      const padding = 8 * env.board.viewport.scale;
      const fontSize = node.fontSize * env.board.viewport.scale;

      drawCtx.save();
      drawCtx.fillStyle = 'rgba(255,255,255,0.86)';
      drawCtx.strokeStyle = 'rgba(15, 23, 42, 0.15)';
      drawCtx.lineWidth = 1;
      drawCtx.fillRect(x, y, w, h);
      drawCtx.strokeRect(x, y, w, h);
      drawCtx.fillStyle = node.color;
      drawCtx.font = `${fontSize}px ${node.fontFamily}`;
      drawCtx.textBaseline = 'top';

      const lines = node.text.split('\n');
      lines.forEach((line, index) => {
        drawCtx.fillText(line || ' ', x + padding, y + padding + index * fontSize * 1.3);
      });
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
