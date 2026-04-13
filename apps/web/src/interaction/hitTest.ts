import { getNodeBounds, pointInBounds } from '../canvas/bounds';
import type { CanvasNode, Point } from '../types/canvas';

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

export function hitTestNode(node: CanvasNode, worldPoint: Point, tolerance: number): boolean {
  if (node.type === 'freehand') {
    if (node.points.length < 2) {
      return false;
    }

    for (let index = 0; index < node.points.length - 1; index += 1) {
      if (distanceToSegment(worldPoint, node.points[index], node.points[index + 1]) <= tolerance + node.width / 2) {
        return true;
      }
    }

    return false;
  }

  return pointInBounds(worldPoint, getNodeBounds(node), tolerance);
}

export function pickTopNode(nodes: CanvasNode[], worldPoint: Point, tolerance: number): string | null {
  for (let index = nodes.length - 1; index >= 0; index -= 1) {
    if (hitTestNode(nodes[index], worldPoint, tolerance)) {
      return nodes[index].id;
    }
  }
  return null;
}
