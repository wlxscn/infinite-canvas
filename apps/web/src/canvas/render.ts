import { getNodeBounds, normalizeBounds } from './bounds';
import type { AssetRecord, BoardDoc, FreehandNode, Point, RectNode, TextNode, CanvasNode } from '../types/canvas';
import { worldToScreen } from '../geometry/transform';

interface RenderOptions {
  canvas: HTMLCanvasElement;
  board: BoardDoc;
  assets: AssetRecord[];
  selectedId: string | null;
  draftRect: RectNode | null;
  draftFreehand: FreehandNode | null;
}

const imageCache = new Map<string, HTMLImageElement>();

function drawSelectionOutline(ctx: CanvasRenderingContext2D, node: CanvasNode, board: BoardDoc): void {
  const bounds = normalizeBounds(getNodeBounds(node));
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

function drawRect(ctx: CanvasRenderingContext2D, rect: RectNode, board: BoardDoc): void {
  const normalized = normalizeBounds(rect);
  const p = worldToScreen({ x: normalized.x, y: normalized.y }, board.viewport);
  const w = normalized.w * board.viewport.scale;
  const h = normalized.h * board.viewport.scale;

  ctx.save();
  ctx.fillStyle = rect.fill ?? 'rgba(59, 130, 246, 0.18)';
  ctx.strokeStyle = rect.stroke;
  ctx.lineWidth = 1.5;
  ctx.fillRect(p.x, p.y, w, h);
  ctx.strokeRect(p.x, p.y, w, h);
  ctx.restore();
}

function drawFreehand(ctx: CanvasRenderingContext2D, node: FreehandNode, board: BoardDoc): void {
  if (node.points.length < 2) {
    return;
  }

  ctx.save();
  ctx.strokeStyle = node.stroke;
  ctx.lineWidth = node.width * board.viewport.scale;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const first = worldToScreen(node.points[0], board.viewport);
  ctx.beginPath();
  ctx.moveTo(first.x, first.y);

  for (let index = 1; index < node.points.length; index += 1) {
    const point = worldToScreen(node.points[index], board.viewport);
    ctx.lineTo(point.x, point.y);
  }

  ctx.stroke();
  ctx.restore();
}

function drawText(ctx: CanvasRenderingContext2D, node: TextNode, board: BoardDoc): void {
  const normalized = normalizeBounds(node);
  const p = worldToScreen({ x: normalized.x, y: normalized.y }, board.viewport);
  const padding = 8 * board.viewport.scale;
  const fontSize = node.fontSize * board.viewport.scale;

  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.86)';
  ctx.strokeStyle = 'rgba(15, 23, 42, 0.15)';
  ctx.lineWidth = 1;
  ctx.fillRect(p.x, p.y, normalized.w * board.viewport.scale, normalized.h * board.viewport.scale);
  ctx.strokeRect(p.x, p.y, normalized.w * board.viewport.scale, normalized.h * board.viewport.scale);
  ctx.fillStyle = node.color;
  ctx.font = `${fontSize}px ${node.fontFamily}`;
  ctx.textBaseline = 'top';

  const lines = node.text.split('\n');
  lines.forEach((line, index) => {
    ctx.fillText(line || ' ', p.x + padding, p.y + padding + index * fontSize * 1.3);
  });
  ctx.restore();
}

function getCachedImage(asset: AssetRecord, rerender: () => void): HTMLImageElement {
  let image = imageCache.get(asset.id);
  if (!image) {
    image = new Image();
    image.src = asset.src;
    image.onload = rerender;
    imageCache.set(asset.id, image);
  }
  return image;
}

function drawImageNode(
  ctx: CanvasRenderingContext2D,
  node: Extract<CanvasNode, { type: 'image' }>,
  board: BoardDoc,
  assets: AssetRecord[],
  rerender: () => void,
): void {
  const asset = assets.find((item) => item.id === node.assetId);
  const normalized = normalizeBounds(node);
  const p = worldToScreen({ x: normalized.x, y: normalized.y }, board.viewport);
  const width = normalized.w * board.viewport.scale;
  const height = normalized.h * board.viewport.scale;

  ctx.save();
  ctx.fillStyle = '#e2e8f0';
  ctx.fillRect(p.x, p.y, width, height);

  if (asset) {
    const image = getCachedImage(asset, rerender);
    if (image.complete) {
      ctx.drawImage(image, p.x, p.y, width, height);
    }
  }

  ctx.strokeStyle = 'rgba(15, 23, 42, 0.18)';
  ctx.lineWidth = 1;
  ctx.strokeRect(p.x, p.y, width, height);
  ctx.restore();
}

function drawNode(
  ctx: CanvasRenderingContext2D,
  node: CanvasNode,
  board: BoardDoc,
  assets: AssetRecord[],
  rerender: () => void,
): void {
  if (node.type === 'rect') {
    drawRect(ctx, node, board);
    return;
  }

  if (node.type === 'freehand') {
    drawFreehand(ctx, node, board);
    return;
  }

  if (node.type === 'text') {
    drawText(ctx, node, board);
    return;
  }

  drawImageNode(ctx, node, board, assets, rerender);
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

  for (const node of board.nodes) {
    drawNode(ctx, node, board, assets, rerender);
  }

  if (draftRect) {
    drawRect(ctx, draftRect, board);
  }

  if (draftFreehand) {
    drawFreehand(ctx, draftFreehand, board);
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
