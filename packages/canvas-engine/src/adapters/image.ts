import { canDrawLoadedImage, type CanvasRenderRuntime } from '../runtime';
import type { NodeAdapter } from '../contracts';
import type { BoardDoc, ImageNode } from '../model';
import { drawRotatedBox, getBoxBounds, hitResizeHandle, hitRotatedBox, resizeBoxNode, translateBoxNode } from './shared';

type ImageAssetRuntime = CanvasRenderRuntime<{ id: string; src: string }>;

export const imageNodeAdapter: NodeAdapter<ImageNode, BoardDoc, ImageAssetRuntime> = {
  type: 'image',
  draw(ctx, node, env) {
    const asset = env.runtime.assetMap.get(node.assetId);

    drawRotatedBox(ctx, node, env.board, (drawCtx, x, y, w, h) => {
      drawCtx.save();
      drawCtx.fillStyle = '#e2e8f0';
      drawCtx.fillRect(x, y, w, h);

      if (asset) {
        const image = env.runtime.getImage(asset.src, env.rerender);
        if (canDrawLoadedImage(image)) {
          drawCtx.drawImage(image, x, y, w, h);
        }
      }

      drawCtx.strokeStyle = 'rgba(15, 23, 42, 0.18)';
      drawCtx.lineWidth = 1;
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
