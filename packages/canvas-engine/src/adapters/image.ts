import { pointInBounds } from '../geometry';
import { canDrawLoadedImage, type CanvasRenderRuntime } from '../runtime';
import type { NodeAdapter } from '../contracts';
import type { BoardDoc, ImageNode } from '../model';
import { drawNormalizedRect, getBoxBounds, hitResizeHandle, resizeBoxNode, translateBoxNode } from './shared';

type ImageAssetRuntime = CanvasRenderRuntime<{ id: string; src: string }>;

export const imageNodeAdapter: NodeAdapter<ImageNode, BoardDoc, ImageAssetRuntime> = {
  type: 'image',
  draw(ctx, node, env) {
    const asset = env.runtime.assetMap.get(node.assetId);

    drawNormalizedRect(getBoxBounds(node), env.board.viewport, (x, y, w, h) => {
      ctx.save();
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(x, y, w, h);

      if (asset) {
        const image = env.runtime.getImage(asset.src, env.rerender);
        if (canDrawLoadedImage(image)) {
          ctx.drawImage(image, x, y, w, h);
        }
      }

      ctx.strokeStyle = 'rgba(15, 23, 42, 0.18)';
      ctx.lineWidth = 1;
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
