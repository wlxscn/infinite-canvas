import type { NodeAdapter } from '../contracts';
import type { BoardDoc, GroupNode } from '../model';
import { drawRotatedBox, getBoxBounds, hitResizeHandle, hitRotatedBox, resizeBoxNode, translateBoxNode } from './shared';

function drawGroupLikeNode(ctx: CanvasRenderingContext2D, node: GroupNode, env: { board: BoardDoc }) {
  drawRotatedBox(ctx, node, env.board, (drawCtx, x, y, w, h) => {
    drawCtx.save();
    drawCtx.fillStyle = 'rgba(255, 248, 237, 0.58)';
    drawCtx.strokeStyle = 'rgba(196, 78, 28, 0.72)';
    drawCtx.lineWidth = 1.5;
    drawCtx.setLineDash([10, 6]);
    drawCtx.fillRect(x, y, w, h);
    drawCtx.strokeRect(x, y, w, h);
    drawCtx.setLineDash([]);
    drawCtx.fillStyle = '#8a4b21';
    drawCtx.font = `${Math.max(11, 12 * env.board.viewport.scale)}px ui-sans-serif, system-ui, sans-serif`;
    drawCtx.fillText(node.name ?? '成组', x + 12, y + 20);
    drawCtx.restore();
  });
}

export const groupNodeAdapter: NodeAdapter<GroupNode, BoardDoc, unknown> = {
  type: 'group',
  draw(ctx, node, env) {
    drawGroupLikeNode(ctx, node, env);
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
