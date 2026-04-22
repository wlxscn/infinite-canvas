import { getBoxCenter, getBoxRotation, getRotatedBoxBounds, pointInRotatedBox, rotatePoint, type Bounds } from '../geometry';
import { worldToScreen } from '../transform';
import { resolveNodeToWorld } from '../hierarchy';
import type { BoardDoc, GroupNode, Point, RectNode, TextNode, ImageNode, VideoNode, Viewport } from '../model';

type BoxNode = RectNode | TextNode | ImageNode | VideoNode | GroupNode;

export function getBoxBounds(node: BoxNode, board?: BoardDoc): Bounds {
  return getRotatedBoxBounds(resolveNodeToWorld(node, board));
}

export function getWorldBoxNode<TNode extends BoxNode>(node: TNode, board?: BoardDoc): TNode {
  return resolveNodeToWorld(node, board);
}

export function translateBoxNode<TNode extends BoxNode>(node: TNode, delta: Point): TNode {
  return {
    ...node,
    x: node.x + delta.x,
    y: node.y + delta.y,
  };
}

export function resizeBoxNode<TNode extends BoxNode>(node: TNode, pointer: Point): TNode {
  return {
    ...node,
    w: Math.max(pointer.x - node.x, 24),
    h: Math.max(pointer.y - node.y, 24),
  };
}

export function rotateBoxNode<TNode extends BoxNode>(node: TNode, rotation: number): TNode {
  return {
    ...node,
    rotation,
  };
}

export function getResizeHandlePoint<TNode extends BoxNode>(node: TNode, board: BoardDoc | undefined): Point {
  const worldNode = getWorldBoxNode(node, board);
  const center = getBoxCenter(worldNode);
  return rotatePoint(
    {
      x: worldNode.x + worldNode.w,
      y: worldNode.y + worldNode.h,
    },
    center,
    getBoxRotation(worldNode),
  );
}

export function getRotateHandlePoint<TNode extends BoxNode>(node: TNode, board: BoardDoc | undefined, offset = 24): Point {
  const worldNode = getWorldBoxNode(node, board);
  const center = getBoxCenter(worldNode);
  const topCenter = rotatePoint(
    {
      x: worldNode.x + worldNode.w / 2,
      y: worldNode.y,
    },
    center,
    getBoxRotation(worldNode),
  );
  const outward = rotatePoint(
    {
      x: topCenter.x,
      y: topCenter.y - offset,
    },
    topCenter,
    getBoxRotation(worldNode),
  );
  return outward;
}

export function hitResizeHandle<TNode extends BoxNode>(
  node: TNode,
  point: Point,
  scale: number,
  handleSize: number,
  board?: BoardDoc,
): boolean {
  const handle = getResizeHandlePoint(node, board);
  const half = handleSize / scale / 2;
  return (
    point.x >= handle.x - half - 2 / scale &&
    point.x <= handle.x + half + 2 / scale &&
    point.y >= handle.y - half - 2 / scale &&
    point.y <= handle.y + half + 2 / scale
  );
}

export function hitRotatedBox<TNode extends BoxNode>(node: TNode, point: Point, tolerance: number, board?: BoardDoc): boolean {
  return pointInRotatedBox(point, getWorldBoxNode(node, board), tolerance);
}

export function drawNormalizedRect(
  bounds: Bounds,
  viewport: Viewport,
  draw: (screenX: number, screenY: number, screenW: number, screenH: number) => void,
): void {
  const p = worldToScreen({ x: bounds.x, y: bounds.y }, viewport);
  draw(p.x, p.y, bounds.w * viewport.scale, bounds.h * viewport.scale);
}

export function drawRotatedBox<TNode extends BoxNode>(
  ctx: CanvasRenderingContext2D,
  node: TNode,
  board: BoardDoc,
  draw: (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) => void,
): void {
  const worldNode = getWorldBoxNode(node, board);
  const center = worldToScreen(getBoxCenter(worldNode), board.viewport);
  const angle = getBoxRotation(worldNode);
  const screenWidth = worldNode.w * board.viewport.scale;
  const screenHeight = worldNode.h * board.viewport.scale;

  ctx.save();
  ctx.translate(center.x, center.y);
  ctx.rotate(angle);
  draw(ctx, -screenWidth / 2, -screenHeight / 2, screenWidth, screenHeight);
  ctx.restore();
}
