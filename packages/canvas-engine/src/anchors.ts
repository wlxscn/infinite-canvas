import { getBoxCenter, getBoxRotation, rotatePoint } from './geometry';
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
  const offset = Math.min(Math.max(length * 0.18, 32), 72) * direction;

  return {
    x: midpoint.x + normal.x * offset,
    y: midpoint.y + normal.y * offset,
  };
}

export function getDefaultConnectorCurveControls(
  start: Point,
  end: Point,
  startAnchor?: AnchorId,
  endAnchor?: AnchorId,
): { startControl: Point; endControl: Point } {
  const distance = Math.hypot(end.x - start.x, end.y - start.y) || 1;
  const defaultBend = getDefaultConnectorCurveControl(start, end, startAnchor);
  const midpoint = {
    x: (start.x + end.x) / 2,
    y: (start.y + end.y) / 2,
  };
  const bendOffset = {
    x: defaultBend.x - midpoint.x,
    y: defaultBend.y - midpoint.y,
  };
  const handleLength = Math.min(Math.max(distance * 0.24, 40), 148);
  const startDirection = startAnchor ? getAnchorDirection(startAnchor) : normalizeDirection({ x: end.x - start.x, y: end.y - start.y });
  const endDirection = endAnchor ? getAnchorDirection(endAnchor) : normalizeDirection({ x: start.x - end.x, y: start.y - end.y });

  return {
    startControl: {
      x: start.x + startDirection.x * handleLength + bendOffset.x,
      y: start.y + startDirection.y * handleLength + bendOffset.y,
    },
    endControl: {
      x: end.x + endDirection.x * handleLength + bendOffset.x,
      y: end.y + endDirection.y * handleLength + bendOffset.y,
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

function sampleCubicCurve(start: Point, control1: Point, control2: Point, end: Point, segments = 24): Point[] {
  const points: Point[] = [];
  for (let index = 0; index <= segments; index += 1) {
    const t = index / segments;
    const mt = 1 - t;
    points.push({
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
    });
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

export function getDefaultConnectorWaypoints(
  start: Point,
  end: Point,
  startAnchor?: AnchorId,
  _endAnchor?: AnchorId,
): Point[] {
  if (startAnchor === 'north' || startAnchor === 'south') {
    return [{ x: start.x, y: end.y }];
  }

  return [{ x: end.x, y: start.y }];
}

export function isConnectorAttachedToNode(node: ConnectorNode, nodeId: string): boolean {
  return (
    (node.start.kind === 'attached' && node.start.nodeId === nodeId) ||
    (node.end.kind === 'attached' && node.end.nodeId === nodeId)
  );
}
