import { getBoxCenter, getBoxRotation, getRotatedBoxBounds, normalizeBounds, rotatePoint, type Bounds } from './geometry';
import { getAllDescendantNodes, getNodeById, isGroupNode, resolveNodeToWorld } from './hierarchy';
import type {
  AnchorId,
  AttachedConnectorEndpoint,
  BoardDoc,
  BoxNode,
  CanvasNode,
  ConnectorEndpoint,
  ConnectorPathMode,
  ConnectorNode,
  Point,
} from './model';

export interface AnchorTarget {
  nodeId: string;
  anchor: AnchorId;
  point: Point;
}

export function isBoxNode(node: CanvasNode): node is BoxNode {
  return node.type === 'rect' || node.type === 'text' || node.type === 'image' || node.type === 'video';
}

export function isConnectorNode(node: CanvasNode): node is ConnectorNode {
  return node.type === 'connector';
}

export function getConnectorPathMode(node: ConnectorNode): ConnectorPathMode {
  if (node.pathMode) {
    return node.pathMode;
  }
  if (node.curveControl || node.curveStartControl || node.curveEndControl) {
    return 'curve';
  }
  return node.waypoints && node.waypoints.length > 0 ? 'polyline' : 'straight';
}

export function getConnectorWaypointHandles(node: ConnectorNode): Point[] {
  return getConnectorPathMode(node) === 'polyline' ? [...(node.waypoints ?? [])] : [];
}

export function getDefaultConnectorCurveControl(start: Point, end: Point, startAnchor?: AnchorId): Point {
  const midpoint = {
    x: (start.x + end.x) / 2,
    y: (start.y + end.y) / 2,
  };
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy) || 1;
  const normal = { x: -dy / length, y: dx / length };
  const direction =
    startAnchor === 'north' || startAnchor === 'east'
      ? -1
      : 1;
  const offset = Math.min(Math.max(length * 0.24, 42), 96) * direction;

  return {
    x: midpoint.x + normal.x * offset,
    y: midpoint.y + normal.y * offset,
  };
}

function getDefaultCurveProfile(startAnchor?: AnchorId, endAnchor?: AnchorId): {
  bendScale: number;
  bendMin: number;
  bendMax: number;
  handleScale: number;
  handleMin: number;
  handleMax: number;
  bendWeight: number;
} {
  if (
    (startAnchor === 'east' && endAnchor === 'west') ||
    (startAnchor === 'west' && endAnchor === 'east')
  ) {
    return {
      bendScale: 0.28,
      bendMin: 48,
      bendMax: 108,
      handleScale: 0.38,
      handleMin: 64,
      handleMax: 208,
      bendWeight: 1.24,
    };
  }

  if (
    (startAnchor === 'north' && endAnchor === 'south') ||
    (startAnchor === 'south' && endAnchor === 'north')
  ) {
    return {
      bendScale: 0.26,
      bendMin: 44,
      bendMax: 102,
      handleScale: 0.36,
      handleMin: 60,
      handleMax: 198,
      bendWeight: 1.2,
    };
  }

  return {
    bendScale: 0.22,
    bendMin: 38,
    bendMax: 88,
    handleScale: 0.32,
    handleMin: 54,
    handleMax: 178,
    bendWeight: 1.12,
  };
}

export function getDefaultConnectorCurveControls(
  start: Point,
  end: Point,
  startAnchor?: AnchorId,
  endAnchor?: AnchorId,
): { startControl: Point; endControl: Point } {
  const distance = Math.hypot(end.x - start.x, end.y - start.y) || 1;
  const profile = getDefaultCurveProfile(startAnchor, endAnchor);
  const midpoint = {
    x: (start.x + end.x) / 2,
    y: (start.y + end.y) / 2,
  };
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy) || 1;
  const normal = { x: -dy / length, y: dx / length };
  const defaultDirection =
    startAnchor === 'north' || startAnchor === 'east'
      ? -1
      : 1;
  const bendMagnitude = Math.min(Math.max(distance * profile.bendScale, profile.bendMin), profile.bendMax);
  const defaultBend = {
    x: midpoint.x + normal.x * bendMagnitude * defaultDirection,
    y: midpoint.y + normal.y * bendMagnitude * defaultDirection,
  };
  const bendOffset = {
    x: defaultBend.x - midpoint.x,
    y: defaultBend.y - midpoint.y,
  };
  const handleLength = Math.min(Math.max(distance * profile.handleScale, profile.handleMin), profile.handleMax);
  const startDirection = startAnchor ? getAnchorDirection(startAnchor) : normalizeDirection({ x: end.x - start.x, y: end.y - start.y });
  const endDirection = endAnchor ? getAnchorDirection(endAnchor) : normalizeDirection({ x: start.x - end.x, y: start.y - end.y });

  return {
    startControl: {
      x: start.x + startDirection.x * handleLength + bendOffset.x * profile.bendWeight,
      y: start.y + startDirection.y * handleLength + bendOffset.y * profile.bendWeight,
    },
    endControl: {
      x: end.x + endDirection.x * handleLength + bendOffset.x * profile.bendWeight,
      y: end.y + endDirection.y * handleLength + bendOffset.y * profile.bendWeight,
    },
  };
}

function getAnchorDirection(anchor: AnchorId): Point {
  switch (anchor) {
    case 'north':
      return { x: 0, y: -1 };
    case 'east':
      return { x: 1, y: 0 };
    case 'south':
      return { x: 0, y: 1 };
    case 'west':
      return { x: -1, y: 0 };
  }
}

function normalizeDirection(point: Point): Point {
  const length = Math.hypot(point.x, point.y) || 1;
  return {
    x: point.x / length,
    y: point.y / length,
  };
}

function getEndpointCurveDirection(endpoint: ConnectorEndpoint, point: Point, oppositePoint: Point): Point {
  if (endpoint.kind === 'attached') {
    return getAnchorDirection(endpoint.anchor);
  }

  return normalizeDirection({
    x: oppositePoint.x - point.x,
    y: oppositePoint.y - point.y,
  });
}

function getOpposingAnchorOrientation(
  start: ConnectorEndpoint,
  end: ConnectorEndpoint,
): 'horizontal' | 'vertical' | null {
  if (start.kind !== 'attached' || end.kind !== 'attached') {
    return null;
  }

  if (
    (start.anchor === 'east' && end.anchor === 'west') ||
    (start.anchor === 'west' && end.anchor === 'east')
  ) {
    return 'horizontal';
  }

  if (
    (start.anchor === 'north' && end.anchor === 'south') ||
    (start.anchor === 'south' && end.anchor === 'north')
  ) {
    return 'vertical';
  }

  return null;
}

function getLegacyConnectorCurveControls(
  node: ConnectorNode,
  board: BoardDoc,
): { startControl: Point; endControl: Point } | null {
  if (getConnectorPathMode(node) !== 'curve') {
    return null;
  }

  if (node.curveStartControl && node.curveEndControl) {
    return {
      startControl: node.curveStartControl,
      endControl: node.curveEndControl,
    };
  }

  const points = resolveConnectorPoints(node, board);
  if (!points) {
    return null;
  }

  if (node.curveControl) {
    const midpoint = {
      x: (points.start.x + points.end.x) / 2,
      y: (points.start.y + points.end.y) / 2,
    };
    const bendOffset = {
      x: node.curveControl.x - midpoint.x,
      y: node.curveControl.y - midpoint.y,
    };
    const distance = Math.hypot(points.end.x - points.start.x, points.end.y - points.start.y) || 1;
    const handleLength = Math.min(Math.max(distance * 0.24, 40), 148);
    const startDirection = getEndpointCurveDirection(node.start, points.start, points.end);
    const endDirection = getEndpointCurveDirection(node.end, points.end, points.start);

    return {
      startControl: {
        x: points.start.x + startDirection.x * handleLength + bendOffset.x,
        y: points.start.y + startDirection.y * handleLength + bendOffset.y,
      },
      endControl: {
        x: points.end.x + endDirection.x * handleLength + bendOffset.x,
        y: points.end.y + endDirection.y * handleLength + bendOffset.y,
      },
    };
  }

  return getDefaultConnectorCurveControls(
    points.start,
    points.end,
    node.start.kind === 'attached' ? node.start.anchor : undefined,
    node.end.kind === 'attached' ? node.end.anchor : undefined,
  );
}

export function getConnectorCurveControlHandle(
  node: ConnectorNode,
  board: BoardDoc,
  control: 'start' | 'end',
): Point | null {
  const controls = getLegacyConnectorCurveControls(node, board);
  if (!controls) {
    return null;
  }

  return control === 'start' ? controls.startControl : controls.endControl;
}

function getCubicPoint(start: Point, control1: Point, control2: Point, end: Point, t: number): Point {
  const mt = 1 - t;

  return {
    x:
      mt * mt * mt * start.x +
      3 * mt * mt * t * control1.x +
      3 * mt * t * t * control2.x +
      t * t * t * end.x,
    y:
      mt * mt * mt * start.y +
      3 * mt * mt * t * control1.y +
      3 * mt * t * t * control2.y +
      t * t * t * end.y,
  };
}

export function getConnectorCurveBendHandle(node: ConnectorNode, board: BoardDoc): Point | null {
  const points = resolveConnectorPoints(node, board);
  const controls = resolveConnectorCurveBezierControls(node, board);
  if (!points || !controls) {
    return null;
  }

  return getCubicPoint(points.start, controls.control1, controls.control2, points.end, 0.5);
}

function sampleCubicCurve(start: Point, control1: Point, control2: Point, end: Point, segments = 24): Point[] {
  const points: Point[] = [];
  for (let index = 0; index <= segments; index += 1) {
    const t = index / segments;
    points.push(getCubicPoint(start, control1, control2, end, t));
  }
  return points;
}

function getMinOpposingBend(distance: number): number {
  if (distance <= 180) {
    return Math.min(Math.max(distance * 0.22, 28), 58);
  }

  if (distance <= 360) {
    return Math.min(Math.max(distance * 0.18, 24), 52);
  }

  return Math.min(Math.max(distance * 0.1, 18), 34);
}

export function resolveConnectorCurveBezierControls(
  node: ConnectorNode,
  board: BoardDoc,
): { control1: Point; control2: Point } | null {
  const points = resolveConnectorPoints(node, board);
  const controls = getLegacyConnectorCurveControls(node, board);
  if (!points || !controls) {
    return null;
  }
  const distance = Math.hypot(points.end.x - points.start.x, points.end.y - points.start.y) || 1;
  const orientation = getOpposingAnchorOrientation(node.start, node.end);
  const midpoint = {
    x: (points.start.x + points.end.x) / 2,
    y: (points.start.y + points.end.y) / 2,
  };
  const currentMidpoint = {
    x: (controls.startControl.x + controls.endControl.x) / 2,
    y: (controls.startControl.y + controls.endControl.y) / 2,
  };
  const currentOffset = {
    x: currentMidpoint.x - midpoint.x,
    y: currentMidpoint.y - midpoint.y,
  };
  const minOpposingBend = getMinOpposingBend(distance);

  if (orientation === 'horizontal' && Math.abs(currentOffset.y) < minOpposingBend) {
    const direction = Math.sign(currentOffset.y || -1);
    return {
      control1: { ...controls.startControl, y: controls.startControl.y + direction * (minOpposingBend - Math.abs(currentOffset.y)) },
      control2: { ...controls.endControl, y: controls.endControl.y + direction * (minOpposingBend - Math.abs(currentOffset.y)) },
    };
  }

  if (orientation === 'vertical' && Math.abs(currentOffset.x) < minOpposingBend) {
    const direction = Math.sign(currentOffset.x || -1);
    return {
      control1: { ...controls.startControl, x: controls.startControl.x + direction * (minOpposingBend - Math.abs(currentOffset.x)) },
      control2: { ...controls.endControl, x: controls.endControl.x + direction * (minOpposingBend - Math.abs(currentOffset.x)) },
    };
  }

  return {
    control1: controls.startControl,
    control2: controls.endControl,
  };
}

export function isAttachedConnectorEndpoint(endpoint: ConnectorEndpoint): endpoint is AttachedConnectorEndpoint {
  return endpoint.kind === 'attached';
}

export function getAnchorPoint(node: BoxNode, anchor: AnchorId, board?: BoardDoc): Point {
  const worldNode = resolveNodeToWorld(node, board);
  const center = getBoxCenter(worldNode);
  const rotation = getBoxRotation(worldNode);
  const basePoint = (() => {
    switch (anchor) {
      case 'north':
        return { x: worldNode.x + worldNode.w / 2, y: worldNode.y };
      case 'east':
        return { x: worldNode.x + worldNode.w, y: worldNode.y + worldNode.h / 2 };
      case 'south':
        return { x: worldNode.x + worldNode.w / 2, y: worldNode.y + worldNode.h };
      case 'west':
        return { x: worldNode.x, y: worldNode.y + worldNode.h / 2 };
    }
  })();

  return rotatePoint(basePoint, center, rotation);
}

export function getNodeAnchors(node: CanvasNode, board?: BoardDoc): AnchorTarget[] {
  if (!isBoxNode(node)) {
    return [];
  }

  return (['north', 'east', 'south', 'west'] as const).map((anchor) => ({
    nodeId: node.id,
    anchor,
    point: getAnchorPoint(node, anchor, board),
  }));
}

export function findAnchorTarget(
  nodes: CanvasNode[],
  point: Point,
  tolerance: number,
  options: { excludeNodeId?: string; excludeConnectorId?: string; boardNodes?: CanvasNode[] } = {},
): AnchorTarget | null {
  let closest: AnchorTarget | null = null;
  let closestDistance = Number.POSITIVE_INFINITY;
  const allNodes = getAllDescendantNodes(nodes);

  for (let index = allNodes.length - 1; index >= 0; index -= 1) {
    const node = allNodes[index];
    if (
      !isBoxNode(node) ||
      isGroupNode(node) ||
      node.id === options.excludeNodeId ||
      node.id === options.excludeConnectorId
    ) {
      continue;
    }

    for (const anchor of getNodeAnchors(node, {
      version: 2,
      viewport: { tx: 0, ty: 0, scale: 1 },
      nodes: options.boardNodes ?? nodes,
    })) {
      const distance = Math.hypot(anchor.point.x - point.x, anchor.point.y - point.y);
      if (distance <= tolerance && distance < closestDistance) {
        closest = anchor;
        closestDistance = distance;
      }
    }
  }

  return closest;
}

export function findProximateConnectorNode(
  nodes: CanvasNode[],
  point: Point,
  tolerance: number,
  board?: BoardDoc,
  options: { excludeNodeId?: string; excludeConnectorId?: string } = {},
): BoxNode | null {
  const allNodes = getAllDescendantNodes(nodes);

  for (let index = allNodes.length - 1; index >= 0; index -= 1) {
    const node = allNodes[index];
    if (
      !isBoxNode(node) ||
      isGroupNode(node) ||
      node.id === options.excludeNodeId ||
      node.id === options.excludeConnectorId
    ) {
      continue;
    }

    const worldNode = resolveNodeToWorld(node, board);
    if (
      point.x >= worldNode.x - tolerance &&
      point.x <= worldNode.x + worldNode.w + tolerance &&
      point.y >= worldNode.y - tolerance &&
      point.y <= worldNode.y + worldNode.h + tolerance
    ) {
      return node;
    }
  }

  return null;
}

export function resolveConnectorEndpoint(endpoint: ConnectorEndpoint, board: BoardDoc): Point | null {
  if (endpoint.kind === 'free') {
    return { x: endpoint.x, y: endpoint.y };
  }

  const targetNode = getNodeById(board.nodes, endpoint.nodeId);
  if (!targetNode || !isBoxNode(targetNode)) {
    return null;
  }

  return getAnchorPoint(targetNode, endpoint.anchor, board);
}

export function resolveConnectorPoints(node: ConnectorNode, board: BoardDoc): { start: Point; end: Point } | null {
  const start = resolveConnectorEndpoint(node.start, board);
  const end = resolveConnectorEndpoint(node.end, board);

  if (!start || !end) {
    return null;
  }

  return { start, end };
}

export function resolveConnectorPathPoints(node: ConnectorNode, board: BoardDoc): Point[] | null {
  const points = resolveConnectorPoints(node, board);
  if (!points) {
    return null;
  }

  if (getConnectorPathMode(node) === 'straight') {
    return [points.start, points.end];
  }

  if (getConnectorPathMode(node) === 'curve') {
    const controls = resolveConnectorCurveBezierControls(node, board);
    if (!controls) {
      return [points.start, points.end];
    }
    return sampleCubicCurve(points.start, controls.control1, controls.control2, points.end);
  }

  return [points.start, ...getConnectorWaypointHandles(node), points.end];
}

interface ConnectorWaypointOptions {
  board?: BoardDoc;
  contextNodes?: CanvasNode[];
  excludeNodeIds?: string[];
}

function expandBounds(bounds: Bounds, padding: number): Bounds {
  const normalized = normalizeBounds(bounds);
  return {
    x: normalized.x - padding,
    y: normalized.y - padding,
    w: normalized.w + padding * 2,
    h: normalized.h + padding * 2,
  };
}

function rangesOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  const minA = Math.min(aStart, aEnd);
  const maxA = Math.max(aStart, aEnd);
  const minB = Math.min(bStart, bEnd);
  const maxB = Math.max(bStart, bEnd);
  return maxA >= minB && maxB >= minA;
}

function segmentIntersectsBounds(a: Point, b: Point, bounds: Bounds): boolean {
  if (a.x === b.x) {
    return a.x >= bounds.x && a.x <= bounds.x + bounds.w && rangesOverlap(a.y, b.y, bounds.y, bounds.y + bounds.h);
  }

  if (a.y === b.y) {
    return a.y >= bounds.y && a.y <= bounds.y + bounds.h && rangesOverlap(a.x, b.x, bounds.x, bounds.x + bounds.w);
  }

  return false;
}

function pathIntersectsObstacles(points: Point[], obstacles: Bounds[]): boolean {
  for (let index = 0; index < points.length - 1; index += 1) {
    for (const obstacle of obstacles) {
      if (segmentIntersectsBounds(points[index], points[index + 1], obstacle)) {
        return true;
      }
    }
  }

  return false;
}

function compressOrthogonalPoints(points: Point[]): Point[] {
  const deduped: Point[] = [];
  for (const point of points) {
    const previous = deduped[deduped.length - 1];
    if (!previous || previous.x !== point.x || previous.y !== point.y) {
      deduped.push(point);
    }
  }

  const compressed: Point[] = [];
  for (const point of deduped) {
    const prev = compressed[compressed.length - 1];
    const prevPrev = compressed[compressed.length - 2];
    if (
      prev &&
      prevPrev &&
      ((prevPrev.x === prev.x && prev.x === point.x) || (prevPrev.y === prev.y && prev.y === point.y))
    ) {
      compressed[compressed.length - 1] = point;
      continue;
    }
    compressed.push(point);
  }

  return compressed;
}

function scoreWaypointRoute(points: Point[]): number {
  let length = 0;
  for (let index = 0; index < points.length - 1; index += 1) {
    length += Math.abs(points[index + 1].x - points[index].x) + Math.abs(points[index + 1].y - points[index].y);
  }

  return points.length * 10000 + length;
}

function resolvePolylineObstacleBounds(options: ConnectorWaypointOptions): Bounds[] {
  if (!options.board) {
    return [];
  }

  const nodes = options.contextNodes ?? options.board.nodes;
  const allNodes = getAllDescendantNodes(nodes);
  const excludedIds = new Set(options.excludeNodeIds ?? []);

  return allNodes
    .filter((node) => isBoxNode(node) && !isGroupNode(node) && !excludedIds.has(node.id))
    .map((node) => expandBounds(getRotatedBoxBounds(resolveNodeToWorld(node, options.board)), 16));
}

function resolvePolylineCandidateRoutes(
  start: Point,
  end: Point,
  obstacles: Bounds[],
): Point[][] {
  const candidates: Point[][] = [
    [{ x: end.x, y: start.y }],
    [{ x: start.x, y: end.y }],
  ];

  const laneXs = new Set<number>([start.x, end.x]);
  const laneYs = new Set<number>([start.y, end.y]);
  for (const obstacle of obstacles) {
    laneXs.add(obstacle.x - 16);
    laneXs.add(obstacle.x + obstacle.w + 16);
    laneYs.add(obstacle.y - 16);
    laneYs.add(obstacle.y + obstacle.h + 16);
  }

  for (const laneX of laneXs) {
    candidates.push([
      { x: laneX, y: start.y },
      { x: laneX, y: end.y },
    ]);
  }

  for (const laneY of laneYs) {
    candidates.push([
      { x: start.x, y: laneY },
      { x: end.x, y: laneY },
    ]);
  }

  return candidates;
}

export function getDefaultConnectorWaypoints(
  start: Point,
  end: Point,
  startAnchor?: AnchorId,
  _endAnchor?: AnchorId,
  options: ConnectorWaypointOptions = {},
): Point[] {
  const fallback =
    startAnchor === 'north' || startAnchor === 'south'
      ? [{ x: start.x, y: end.y }]
      : [{ x: end.x, y: start.y }];

  const obstacles = resolvePolylineObstacleBounds(options);
  if (obstacles.length === 0) {
    return fallback;
  }

  const candidates = resolvePolylineCandidateRoutes(start, end, obstacles)
    .map((waypoints) => compressOrthogonalPoints([start, ...waypoints, end]))
    .filter((points) => !pathIntersectsObstacles(points, obstacles))
    .sort((a, b) => scoreWaypointRoute(a) - scoreWaypointRoute(b));

  const bestRoute = candidates[0];
  if (!bestRoute) {
    return fallback;
  }

  return bestRoute.slice(1, -1);
}

export function isConnectorAttachedToNode(node: ConnectorNode, nodeId: string): boolean {
  return (
    (node.start.kind === 'attached' && node.start.nodeId === nodeId) ||
    (node.end.kind === 'attached' && node.end.nodeId === nodeId)
  );
}
