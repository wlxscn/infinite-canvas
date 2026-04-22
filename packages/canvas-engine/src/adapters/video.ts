import type { NodeAdapter } from '../contracts';
import { canDrawLoadedImage, type CanvasRenderRuntime } from '../runtime';
import type { BoardDoc, VideoNode } from '../model';
import { drawRotatedBox, getBoxBounds, hitResizeHandle, hitRotatedBox, resizeBoxNode, translateBoxNode } from './shared';

type VideoAssetRuntime = CanvasRenderRuntime<{ id: string; name: string; frameSrc?: string | null }>;

function drawImageCover(ctx: CanvasRenderingContext2D, image: HTMLImageElement, x: number, y: number, w: number, h: number): void {
  const sourceRatio = image.naturalWidth / image.naturalHeight;
  const targetRatio = w / h;
  let sx = 0;
  let sy = 0;
  let sw = image.naturalWidth;
  let sh = image.naturalHeight;

  if (sourceRatio > targetRatio) {
    sw = image.naturalHeight * targetRatio;
    sx = (image.naturalWidth - sw) / 2;
  } else if (sourceRatio < targetRatio) {
    sh = image.naturalWidth / targetRatio;
    sy = (image.naturalHeight - sh) / 2;
  }

  ctx.drawImage(image, sx, sy, sw, sh, x, y, w, h);
}

export const videoNodeAdapter: NodeAdapter<VideoNode, BoardDoc, VideoAssetRuntime> = {
  type: 'video',
  draw(ctx, node, env) {
    const asset = env.runtime.assetMap.get(node.assetId);

    drawRotatedBox(ctx, node, env.board, (drawCtx, x, y, w, h) => {
      drawCtx.save();
      if (asset?.frameSrc) {
        const frame = env.runtime.getImage(asset.frameSrc, env.rerender);
        if (canDrawLoadedImage(frame)) {
          drawImageCover(drawCtx, frame, x, y, w, h);
        } else {
          const gradient = drawCtx.createLinearGradient(x, y, x + w, y + h);
          gradient.addColorStop(0, '#111827');
          gradient.addColorStop(0.55, '#1f2937');
          gradient.addColorStop(1, '#0f172a');
          drawCtx.fillStyle = gradient;
          drawCtx.fillRect(x, y, w, h);
        }
      } else {
        const gradient = drawCtx.createLinearGradient(x, y, x + w, y + h);
        gradient.addColorStop(0, '#111827');
        gradient.addColorStop(0.55, '#1f2937');
        gradient.addColorStop(1, '#0f172a');
        drawCtx.fillStyle = gradient;
        drawCtx.fillRect(x, y, w, h);
      }

      drawCtx.fillStyle = asset?.frameSrc ? 'rgba(15, 23, 42, 0.18)' : 'rgba(15, 23, 42, 0.28)';
      drawCtx.fillRect(x, y, w, h);

      const badgeSize = Math.min(w, h) * 0.28;
      const centerX = x + w / 2;
      const centerY = y + h / 2;

      drawCtx.beginPath();
      drawCtx.fillStyle = 'rgba(255,255,255,0.92)';
      drawCtx.arc(centerX, centerY, badgeSize / 2.1, 0, Math.PI * 2);
      drawCtx.fill();
      drawCtx.fillStyle = '#111827';
      drawCtx.beginPath();
      drawCtx.moveTo(centerX - badgeSize / 6, centerY - badgeSize / 5);
      drawCtx.lineTo(centerX - badgeSize / 6, centerY + badgeSize / 5);
      drawCtx.lineTo(centerX + badgeSize / 5, centerY);
      drawCtx.closePath();
      drawCtx.fill();

      drawCtx.fillStyle = 'rgba(255,255,255,0.18)';
      drawCtx.fillRect(x + 10, y + h - 22, Math.max(36, w * 0.34), 4);

      drawCtx.fillStyle = '#ffffff';
      drawCtx.font = `${Math.max(10, 12 * env.board.viewport.scale)}px ui-sans-serif, system-ui, sans-serif`;
      drawCtx.textAlign = 'left';
      drawCtx.fillText(asset?.name ?? 'Video asset', x + 12, y + 12);
      drawCtx.fillText('Video preview', x + 12, y + h - 16);

      drawCtx.strokeStyle = 'rgba(255,255,255,0.24)';
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
