import { getCanvasNodeBounds, translateCanvasNode } from './canvas-registry';
import { normalizeBounds, type Bounds } from './geometry';
import type { CanvasNode, Point, Viewport } from './model';

const DEFAULT_SNAP_THRESHOLD = 6;

type SnapTargetKind = 'start' | 'center' | 'end';

export interface SnapGuide {
  axis: 'x' | 'y';
  screenPosition: number;
  start: number;
  end: number;
  kind: 'edge' | 'center';
}

export interface SnapMatch {
  axis: 'x' | 'y';
  source: SnapTargetKind;
  target: SnapTargetKind;
  offset: number;
  distance: number;
  guide: SnapGuide;
}

export interface DragSnapResult {
  delta: Point;
  guides: SnapGuide[];
  matches: {
    x: SnapMatch | null;
    y: SnapMatch | null;
  };
}

interface ComputeDragSnapInput {
  node: CanvasNode;
  delta: Point;
  nodes: CanvasNode[];
  viewport: Viewport;
  threshold?: number;
}

interface AxisTarget {
  kind: SnapTargetKind;
  value: number;
  bounds: Bounds;
}

function getAxisTargets(bounds: Bounds, axis: 'x' | 'y'): AxisTarget[] {
  if (axis === 'x') {
    return [
      { kind: 'start', value: bounds.x, bounds },
      { kind: 'center', value: bounds.x + bounds.w / 2, bounds },
      { kind: 'end', value: bounds.x + bounds.w, bounds },
    ];
  }

  return [
    { kind: 'start', value: bounds.y, bounds },
    { kind: 'center', value: bounds.y + bounds.h / 2, bounds },
    { kind: 'end', value: bounds.y + bounds.h, bounds },
  ];
}

function createGuide(
  axis: 'x' | 'y',
  viewport: Viewport,
  draggedBounds: Bounds,
  target: AxisTarget,
  sourceKind: SnapTargetKind,
): SnapGuide {
  const isCenterGuide = sourceKind === 'center' && target.kind === 'center';
  if (axis === 'x') {
    const top = Math.min(draggedBounds.y, target.bounds.y);
    const bottom = Math.max(draggedBounds.y + draggedBounds.h, target.bounds.y + target.bounds.h);
    return {
      axis,
      screenPosition: target.value * viewport.scale + viewport.tx,
      start: top * viewport.scale + viewport.ty,
      end: bottom * viewport.scale + viewport.ty,
      kind: isCenterGuide ? 'center' : 'edge',
    };
  }

  const left = Math.min(draggedBounds.x, target.bounds.x);
  const right = Math.max(draggedBounds.x + draggedBounds.w, target.bounds.x + target.bounds.w);
  return {
    axis,
    screenPosition: target.value * viewport.scale + viewport.ty,
    start: left * viewport.scale + viewport.tx,
    end: right * viewport.scale + viewport.tx,
    kind: isCenterGuide ? 'center' : 'edge',
  };
}

function findBestAxisMatch(
  axis: 'x' | 'y',
  draggedBounds: Bounds,
  otherBounds: Bounds[],
  viewport: Viewport,
  threshold: number,
): SnapMatch | null {
  const sourceTargets = getAxisTargets(draggedBounds, axis);
  let bestMatch: SnapMatch | null = null;

  for (const bounds of otherBounds) {
    const targetPoints = getAxisTargets(bounds, axis);
    for (const source of sourceTargets) {
      for (const target of targetPoints) {
        const offset = target.value - source.value;
        const distance = Math.abs(offset * viewport.scale);
        if (distance > threshold) {
          continue;
        }

        if (!bestMatch || distance < bestMatch.distance) {
          bestMatch = {
            axis,
            source: source.kind,
            target: target.kind,
            offset,
            distance,
            guide: createGuide(axis, viewport, draggedBounds, target, source.kind),
          };
        }
      }
    }
  }

  return bestMatch;
}

export function computeDragSnap({
  node,
  delta,
  nodes,
  viewport,
  threshold = DEFAULT_SNAP_THRESHOLD,
}: ComputeDragSnapInput): DragSnapResult {
  const translatedNode = translateCanvasNode(node, delta);
  const translatedBounds = normalizeBounds(getCanvasNodeBounds(translatedNode));
  const otherBounds = nodes.filter((candidate) => candidate.id !== node.id).map((candidate) => normalizeBounds(getCanvasNodeBounds(candidate)));
  const xMatch = findBestAxisMatch('x', translatedBounds, otherBounds, viewport, threshold);
  const yMatch = findBestAxisMatch('y', translatedBounds, otherBounds, viewport, threshold);

  return {
    delta: {
      x: delta.x + (xMatch?.offset ?? 0),
      y: delta.y + (yMatch?.offset ?? 0),
    },
    guides: [xMatch?.guide, yMatch?.guide].filter((guide): guide is SnapGuide => guide !== null && guide !== undefined),
    matches: {
      x: xMatch,
      y: yMatch,
    },
  };
}
