import type { Point, Shape } from '../types/canvas';

function distanceToSegment(point: Point, a: Point, b: Point): number {
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

export function hitTestShape(shape: Shape, worldPoint: Point, tolerance: number): boolean {
  if (shape.type === 'rect') {
    const minX = Math.min(shape.x, shape.x + shape.w) - tolerance;
    const maxX = Math.max(shape.x, shape.x + shape.w) + tolerance;
    const minY = Math.min(shape.y, shape.y + shape.h) - tolerance;
    const maxY = Math.max(shape.y, shape.y + shape.h) + tolerance;
    return worldPoint.x >= minX && worldPoint.x <= maxX && worldPoint.y >= minY && worldPoint.y <= maxY;
  }

  if (shape.points.length < 2) {
    return false;
  }

  for (let i = 0; i < shape.points.length - 1; i += 1) {
    const a = shape.points[i];
    const b = shape.points[i + 1];
    if (distanceToSegment(worldPoint, a, b) <= tolerance + shape.width / 2) {
      return true;
    }
  }

  return false;
}

export function pickTopShape(shapes: Shape[], worldPoint: Point, tolerance: number): string | null {
  for (let i = shapes.length - 1; i >= 0; i -= 1) {
    if (hitTestShape(shapes[i], worldPoint, tolerance)) {
      return shapes[i].id;
    }
  }
  return null;
}
