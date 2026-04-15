import type { EnginePoint } from './contracts';

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

export function pointInBounds(point: EnginePoint, bounds: Bounds, tolerance = 0): boolean {
  const normalized = normalizeBounds(bounds);
  return (
    point.x >= normalized.x - tolerance &&
    point.x <= normalized.x + normalized.w + tolerance &&
    point.y >= normalized.y - tolerance &&
    point.y <= normalized.y + normalized.h + tolerance
  );
}

export function boundsFromPoints<TPoint extends EnginePoint>(points: TPoint[]): Bounds {
  const [firstPoint, ...restPoints] = points;
  if (!firstPoint) {
    return {
      x: 0,
      y: 0,
      w: 0,
      h: 0,
    };
  }

  let minX = firstPoint.x;
  let minY = firstPoint.y;
  let maxX = firstPoint.x;
  let maxY = firstPoint.y;

  for (const point of restPoints) {
    if (point.x < minX) {
      minX = point.x;
    }
    if (point.y < minY) {
      minY = point.y;
    }
    if (point.x > maxX) {
      maxX = point.x;
    }
    if (point.y > maxY) {
      maxY = point.y;
    }
  }

  return {
    x: minX,
    y: minY,
    w: maxX - minX,
    h: maxY - minY,
  };
}

export function distanceToSegment<TPoint extends EnginePoint>(point: TPoint, a: TPoint, b: TPoint): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;

  if (dx === 0 && dy === 0) {
    return Math.hypot(point.x - a.x, point.y - a.y);
  }

  const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / (dx * dx + dy * dy)));
  const px = a.x + t * dx;
  const py = a.y + t * dy;
  return Math.hypot(point.x - px, point.y - py);
}
