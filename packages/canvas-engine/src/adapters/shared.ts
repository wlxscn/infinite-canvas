import { normalizeBounds, pointInBounds, type Bounds } from '../geometry';
import { worldToScreen } from '../transform';
import { resolveNodeToWorld } from '../hierarchy';
import type { BoardDoc, GroupNode, Point, RectNode, TextNode, ImageNode, VideoNode, Viewport } from '../model';

type BoxNode = RectNode | TextNode | ImageNode | VideoNode | GroupNode;

export function getBoxBounds(node: BoxNode, board?: BoardDoc): Bounds {
  return normalizeBounds(resolveNodeToWorld(node, board));
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

export function hitResizeHandle(bounds: Bounds, point: Point, scale: number, handleSize: number): boolean {
  const normalized = normalizeBounds(bounds);
  return pointInBounds(
    point,
    {
      x: normalized.x + normalized.w - handleSize / scale,
      y: normalized.y + normalized.h - handleSize / scale,
      w: handleSize / scale,
      h: handleSize / scale,
    },
    2 / scale,
  );
}

export function drawNormalizedRect(
  bounds: Bounds,
  viewport: Viewport,
  draw: (screenX: number, screenY: number, screenW: number, screenH: number) => void,
): void {
  const normalized = normalizeBounds(bounds);
  const p = worldToScreen({ x: normalized.x, y: normalized.y }, viewport);
  draw(p.x, p.y, normalized.w * viewport.scale, normalized.h * viewport.scale);
}
