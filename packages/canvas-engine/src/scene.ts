import { isConnectorNode, resolveConnectorPathPoints } from './anchors';
import { createCanvasRenderRuntime } from './runtime';
import { drawCanvasNode, getCanvasNodeBounds } from './canvas-registry';
import { normalizeBounds } from './geometry';
import { worldToScreen } from './transform';
import type { BoardDoc, CanvasNode, ConnectorNode, FreehandNode, Point, RectNode } from './model';
import type { CanvasAssetRecord } from './canvas-registry';

interface RenderOptions {
  canvas: HTMLCanvasElement;
  board: BoardDoc;
  assets: CanvasAssetRecord[];
  selectedId: string | null;
  hoveredId: string | null;
  draftRect: RectNode | null;
  draftFreehand: FreehandNode | null;
  draftConnector: ConnectorNode | null;
}

function drawNodeChrome(
  ctx: CanvasRenderingContext2D,
  node: CanvasNode,
  board: BoardDoc,
  state: 'hovered' | 'selected',
): void {
  const strokeStyle = state === 'selected' ? '#2563eb' : 'rgba(196, 78, 28, 0.72)';
  const connectorLineWidth = state === 'selected' ? 2 : 1.5;
  const rectLineWidth = state === 'selected' ? 1.5 : 1.25;

  if (isConnectorNode(node)) {
    const points = resolveConnectorPathPoints(node, board);
    if (!points) {
      return;
    }

    ctx.save();
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = connectorLineWidth;
    ctx.beginPath();
    const screenPoints = points.map((point) => worldToScreen(point, board.viewport));
    ctx.moveTo(screenPoints[0].x, screenPoints[0].y);
    for (const point of screenPoints.slice(1)) {
      ctx.lineTo(point.x, point.y);
    }
    ctx.stroke();
    ctx.restore();
    return;
  }

  const bounds = normalizeBounds(getCanvasNodeBounds(node, board));
  const p = worldToScreen({ x: bounds.x, y: bounds.y }, board.viewport);
  const w = bounds.w * board.viewport.scale;
  const h = bounds.h * board.viewport.scale;
  const handle = 10;

  ctx.save();
  ctx.strokeStyle = strokeStyle;
  ctx.lineWidth = rectLineWidth;
  ctx.strokeRect(p.x - 4, p.y - 4, w + 8, h + 8);
  if (state === 'selected') {
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.rect(p.x + w - handle / 2, p.y + h - handle / 2, handle, handle);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

export function renderScene({ canvas, board, assets, selectedId, hoveredId, draftRect, draftFreehand, draftConnector }: RenderOptions): void {
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
    renderScene({ canvas, board, assets, selectedId, hoveredId, draftRect, draftFreehand, draftConnector });
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

  if (draftConnector) {
    drawCanvasNode(ctx, draftConnector, { board, runtime, rerender });
  }

  const hoveredNode = board.nodes.find((node) => node.id === hoveredId && node.id !== selectedId);
  if (hoveredNode) {
    drawNodeChrome(ctx, hoveredNode, board, 'hovered');
  }

  const selectedNode = board.nodes.find((node) => node.id === selectedId);
  if (selectedNode) {
    drawNodeChrome(ctx, selectedNode, board, 'selected');
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
