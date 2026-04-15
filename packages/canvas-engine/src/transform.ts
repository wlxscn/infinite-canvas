import type { Point, Viewport } from './model';

export const MIN_SCALE = 0.1;
export const MAX_SCALE = 8;

export function clampScale(scale: number): number {
  if (scale < MIN_SCALE) return MIN_SCALE;
  if (scale > MAX_SCALE) return MAX_SCALE;
  return scale;
}

export function worldToScreen(point: Point, viewport: Viewport): Point {
  return {
    x: point.x * viewport.scale + viewport.tx,
    y: point.y * viewport.scale + viewport.ty,
  };
}

export function screenToWorld(point: Point, viewport: Viewport): Point {
  return {
    x: (point.x - viewport.tx) / viewport.scale,
    y: (point.y - viewport.ty) / viewport.scale,
  };
}

export function zoomAtScreenPoint(viewport: Viewport, screenPoint: Point, zoomFactor: number): Viewport {
  const nextScale = clampScale(viewport.scale * zoomFactor);
  if (nextScale === viewport.scale) {
    return viewport;
  }

  const worldPoint = screenToWorld(screenPoint, viewport);
  return {
    tx: screenPoint.x - worldPoint.x * nextScale,
    ty: screenPoint.y - worldPoint.y * nextScale,
    scale: nextScale,
  };
}
