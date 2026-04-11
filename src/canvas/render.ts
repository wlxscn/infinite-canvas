import type { CanvasDoc, FreehandShape, Point, RectShape, Shape } from '../types/canvas';
import { worldToScreen } from '../geometry/transform';

interface RenderOptions {
  canvas: HTMLCanvasElement;
  doc: CanvasDoc;
  selectedId: string | null;
  draftRect: RectShape | null;
  draftFreehand: FreehandShape | null;
}

function drawGrid(ctx: CanvasRenderingContext2D, width: number, height: number, doc: CanvasDoc): void {
  const stepWorld = 40;
  const step = stepWorld * doc.viewport.scale;

  if (step < 8) {
    return;
  }

  const offsetX = ((doc.viewport.tx % step) + step) % step;
  const offsetY = ((doc.viewport.ty % step) + step) % step;

  ctx.save();
  ctx.strokeStyle = '#dbe2ea';
  ctx.lineWidth = 1;

  for (let x = offsetX; x < width; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }

  for (let y = offsetY; y < height; y += step) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  ctx.restore();
}

function drawRect(ctx: CanvasRenderingContext2D, rect: RectShape, doc: CanvasDoc, isSelected: boolean): void {
  const p = worldToScreen({ x: rect.x, y: rect.y }, doc.viewport);
  const w = rect.w * doc.viewport.scale;
  const h = rect.h * doc.viewport.scale;

  ctx.save();
  ctx.fillStyle = rect.fill ?? 'rgba(49, 132, 253, 0.14)';
  ctx.strokeStyle = rect.stroke;
  ctx.lineWidth = isSelected ? 2.5 : 1.5;
  ctx.fillRect(p.x, p.y, w, h);
  ctx.strokeRect(p.x, p.y, w, h);

  if (isSelected) {
    ctx.setLineDash([8, 4]);
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 1;
    ctx.strokeRect(p.x - 4, p.y - 4, w + 8, h + 8);
  }

  ctx.restore();
}

function drawFreehand(ctx: CanvasRenderingContext2D, shape: FreehandShape, doc: CanvasDoc, isSelected: boolean): void {
  if (shape.points.length < 2) {
    return;
  }

  ctx.save();
  ctx.strokeStyle = shape.stroke;
  ctx.lineWidth = shape.width * doc.viewport.scale;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const first = worldToScreen(shape.points[0], doc.viewport);
  ctx.beginPath();
  ctx.moveTo(first.x, first.y);

  for (let i = 1; i < shape.points.length; i += 1) {
    const point = worldToScreen(shape.points[i], doc.viewport);
    ctx.lineTo(point.x, point.y);
  }

  ctx.stroke();

  if (isSelected) {
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 4]);
    ctx.stroke();
  }

  ctx.restore();
}

function drawShape(ctx: CanvasRenderingContext2D, shape: Shape, doc: CanvasDoc, isSelected: boolean): void {
  if (shape.type === 'rect') {
    drawRect(ctx, shape, doc, isSelected);
    return;
  }

  drawFreehand(ctx, shape, doc, isSelected);
}

export function renderScene({ canvas, doc, selectedId, draftRect, draftFreehand }: RenderOptions): void {
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

  drawGrid(ctx, width, height, doc);

  for (const shape of doc.shapes) {
    drawShape(ctx, shape, doc, shape.id === selectedId);
  }

  if (draftRect) {
    drawRect(ctx, draftRect, doc, false);
  }

  if (draftFreehand) {
    drawFreehand(ctx, draftFreehand, doc, false);
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
