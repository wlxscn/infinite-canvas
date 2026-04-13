import type { CanvasNode, Point } from '../types/canvas';

export interface Bounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function normalizeBounds(bounds: Bounds): Bounds {
  const x = bounds.w >= 0 ? bounds.x : bounds.x + bounds.w;
  const y = bounds.h >= 0 ? bounds.y : bounds.y + bounds.h;
  return {
    x,
    y,
    w: Math.abs(bounds.w),
    h: Math.abs(bounds.h),
  };
}

export function getNodeBounds(node: CanvasNode): Bounds {
  if (node.type === 'rect' || node.type === 'image' || node.type === 'text') {
    return normalizeBounds(node);
  }

  const xs = node.points.map((point) => point.x);
  const ys = node.points.map((point) => point.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);
  return {
    x: minX,
    y: minY,
    w: maxX - minX,
    h: maxY - minY,
  };
}

export function pointInBounds(point: Point, bounds: Bounds, tolerance = 0): boolean {
  const normalized = normalizeBounds(bounds);
  return (
    point.x >= normalized.x - tolerance &&
    point.x <= normalized.x + normalized.w + tolerance &&
    point.y >= normalized.y - tolerance &&
    point.y <= normalized.y + normalized.h + tolerance
  );
}
