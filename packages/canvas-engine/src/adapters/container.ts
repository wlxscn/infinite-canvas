import { pointInBounds } from '../geometry';
import type { NodeAdapter } from '../contracts';
import type { BoardDoc, ContainerNode } from '../model';
import { drawNormalizedRect, getBoxBounds, hitResizeHandle, resizeBoxNode, translateBoxNode } from './shared';

export const containerNodeAdapter: NodeAdapter<ContainerNode, BoardDoc, unknown> = {
  type: 'container',
  draw(ctx, node, env) {
    drawNormalizedRect(getBoxBounds(node, env.board), env.board.viewport, (x, y, w, h) => {
      ctx.save();
      ctx.fillStyle = 'rgba(255, 248, 237, 0.58)';
      ctx.strokeStyle = 'rgba(196, 78, 28, 0.72)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([10, 6]);
      ctx.fillRect(x, y, w, h);
      ctx.strokeRect(x, y, w, h);
      ctx.setLineDash([]);
      ctx.fillStyle = '#8a4b21';
      ctx.font = `${Math.max(11, 12 * env.board.viewport.scale)}px ui-sans-serif, system-ui, sans-serif`;
      ctx.fillText(node.name ?? '容器', x + 12, y + 20);
      ctx.restore();
    });
  },
  getBounds(node, board) {
    return getBoxBounds(node, board);
  },
  hitTest(node, point, tolerance, board) {
    return pointInBounds(point, getBoxBounds(node, board), tolerance);
  },
  translate(node, delta) {
    return translateBoxNode(node, delta);
  },
  resize(node, pointer) {
    return resizeBoxNode(node, pointer);
  },
  hitResizeHandle(node, point, scale, handleSize, board) {
    return hitResizeHandle(getBoxBounds(node, board), point, scale, handleSize);
  },
};
