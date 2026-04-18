import { isConnectorNode, resolveConnectorPathPoints } from './anchors';
import { createCanvasRenderRuntime, type CanvasRenderRuntime } from './runtime';
import { drawCanvasNode, getCanvasNodeBounds } from './canvas-registry';
import { normalizeBounds } from './geometry';
import { getNodeById, isContainerNode, resolveNodeToWorld } from './hierarchy';
import { worldToScreen } from './transform';
import type { BoardDoc, CanvasNode, ConnectorNode, ContainerNode, FreehandNode, Point, RectNode } from './model';
import type { CanvasAssetRecord } from './canvas-registry';

interface RenderOptions {
  canvas: HTMLCanvasElement;
  board: BoardDoc;
  assets: CanvasAssetRecord[];
  selectedId: string | null;
  hoveredId: string | null;
  activeContainerId: string | null;
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

function drawNodeTree(
  ctx: CanvasRenderingContext2D,
  board: BoardDoc,
  node: CanvasNode,
  runtime: CanvasRenderRuntime<CanvasAssetRecord>,
  rerender: () => void,
): void {
  drawCanvasNode(ctx, node, { board, runtime, rerender });

  if (!isContainerNode(node)) {
    return;
  }

  for (const child of node.children) {
    drawCanvasNode(ctx, child, { board, runtime, rerender });
  }
}

function drawActiveContainerOverlay(
  ctx: CanvasRenderingContext2D,
  board: BoardDoc,
  activeContainer: ContainerNode,
  width: number,
  height: number,
): void {
  const bounds = normalizeBounds(resolveNodeToWorld(activeContainer, board));
  const topLeft = worldToScreen({ x: bounds.x, y: bounds.y }, board.viewport);
  const screenWidth = bounds.w * board.viewport.scale;
  const screenHeight = bounds.h * board.viewport.scale;

  ctx.save();
  ctx.fillStyle = 'rgba(15, 23, 42, 0.08)';
  ctx.fillRect(0, 0, width, height);
  ctx.clearRect(topLeft.x, topLeft.y, screenWidth, screenHeight);
  ctx.strokeStyle = 'rgba(196, 78, 28, 0.72)';
  ctx.lineWidth = 2;
  ctx.setLineDash([10, 6]);
  ctx.strokeRect(topLeft.x - 6, topLeft.y - 6, screenWidth + 12, screenHeight + 12);
  ctx.restore();
}

export function renderScene({ canvas, board, assets, selectedId, hoveredId, activeContainerId, draftRect, draftFreehand, draftConnector }: RenderOptions): void {
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
    renderScene({ canvas, board, assets, selectedId, hoveredId, activeContainerId, draftRect, draftFreehand, draftConnector });
  };
  const runtime = createCanvasRenderRuntime(assets);

  for (const node of board.nodes) {
    drawNodeTree(ctx, board, node, runtime, rerender);
  }

  if (draftRect) {
    drawNodeTree(ctx, board, draftRect, runtime, rerender);
  }

  if (draftFreehand) {
    drawNodeTree(ctx, board, draftFreehand, runtime, rerender);
  }

  if (draftConnector) {
    drawNodeTree(ctx, board, draftConnector, runtime, rerender);
  }

  const activeContainer = getNodeById(board.nodes, activeContainerId);
  if (activeContainer && isContainerNode(activeContainer)) {
    drawActiveContainerOverlay(ctx, board, activeContainer, width, height);
  }

  const hoveredNode = hoveredId && hoveredId !== selectedId ? getNodeById(board.nodes, hoveredId) : null;
  if (hoveredNode) {
    drawNodeChrome(ctx, hoveredNode, board, 'hovered');
  }

  const selectedNode = getNodeById(board.nodes, selectedId);
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
