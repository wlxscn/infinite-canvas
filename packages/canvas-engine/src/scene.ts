import { createCanvasRenderRuntime } from './runtime';
import { drawCanvasNode, getCanvasNodeBounds } from './canvas-registry';
import { normalizeBounds } from './geometry';
import { worldToScreen } from './transform';
import type { BoardDoc, CanvasNode, FreehandNode, Point, RectNode } from './model';
import type { CanvasAssetRecord } from './canvas-registry';

interface RenderOptions {
  canvas: HTMLCanvasElement;
  board: BoardDoc;
  assets: CanvasAssetRecord[];
  selectedId: string | null;
  draftRect: RectNode | null;
  draftFreehand: FreehandNode | null;
}

function drawSelectionOutline(ctx: CanvasRenderingContext2D, node: CanvasNode, board: BoardDoc): void {
  const bounds = normalizeBounds(getCanvasNodeBounds(node));
  const p = worldToScreen({ x: bounds.x, y: bounds.y }, board.viewport);
  const w = bounds.w * board.viewport.scale;
  const h = bounds.h * board.viewport.scale;
  const handle = 10;

  ctx.save();
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 1;
  ctx.setLineDash([8, 4]);
  ctx.strokeRect(p.x - 4, p.y - 4, w + 8, h + 8);
  ctx.setLineDash([]);
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#2563eb';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.rect(p.x + w - handle / 2, p.y + h - handle / 2, handle, handle);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

export function renderScene({ canvas, board, assets, selectedId, draftRect, draftFreehand }: RenderOptions): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return;
  }

  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  const ratio = window.devicePixelRatio || 1;

  if (canvas.width !== Math.floor(width * ratio) || canvas.height !== Math.floor(height * ratio)) {
    canvas.width = Math.floor(width * ratio);
    canvas.height = Math.floor(height * ratio);
  }

  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, width, height);

  const rerender = () => {
    renderScene({ canvas, board, assets, selectedId, draftRect, draftFreehand });
  };
  const runtime = createCanvasRenderRuntime(assets);

  for (const node of board.nodes) {
    drawCanvasNode(ctx, node, { board, runtime, rerender });
  }

  if (draftRect) {
    drawCanvasNode(ctx, draftRect, { board, runtime, rerender });
  }

  if (draftFreehand) {
    drawCanvasNode(ctx, draftFreehand, { board, runtime, rerender });
  }

  const selectedNode = board.nodes.find((node) => node.id === selectedId);
  if (selectedNode) {
    drawSelectionOutline(ctx, selectedNode, board);
  }
}

export function scaleTolerance(base: number, scale: number): number {
  return base / Math.max(scale, 0.0001);
}

export function maybeAppendPoint(points: Point[], next: Point, minDistance: number): Point[] {
  const last = points[points.length - 1];
  if (!last) {
    return [next];
  }

  const distance = Math.hypot(next.x - last.x, next.y - last.y);
  if (distance < minDistance) {
    return points;
  }

  return [...points, next];
}
