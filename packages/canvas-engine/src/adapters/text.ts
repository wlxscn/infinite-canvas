import { pointInBounds } from '../geometry';
import type { NodeAdapter } from '../contracts';
import type { BoardDoc, TextNode } from '../model';
import { drawNormalizedRect, getBoxBounds, hitResizeHandle, resizeBoxNode, translateBoxNode } from './shared';

export const textNodeAdapter: NodeAdapter<TextNode, BoardDoc, unknown> = {
  type: 'text',
  draw(ctx, node, env) {
    const bounds = getBoxBounds(node);
    drawNormalizedRect(bounds, env.board.viewport, (x, y, w, h) => {
      const padding = 8 * env.board.viewport.scale;
      const fontSize = node.fontSize * env.board.viewport.scale;

      ctx.save();
      ctx.fillStyle = 'rgba(255,255,255,0.86)';
      ctx.strokeStyle = 'rgba(15, 23, 42, 0.15)';
      ctx.lineWidth = 1;
      ctx.fillRect(x, y, w, h);
      ctx.strokeRect(x, y, w, h);
      ctx.fillStyle = node.color;
      ctx.font = `${fontSize}px ${node.fontFamily}`;
      ctx.textBaseline = 'top';

      const lines = node.text.split('\n');
      lines.forEach((line, index) => {
        ctx.fillText(line || ' ', x + padding, y + padding + index * fontSize * 1.3);
      });
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
