import { normalizeBounds, type Bounds } from './geometry';
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

function getBoxBounds(node: BoxNode): Bounds {
  return normalizeBounds(node);
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
  return node.waypoints && node.waypoints.length > 0 ? 'polyline' : 'straight';
}

export function getConnectorWaypointHandles(node: ConnectorNode): Point[] {
  return getConnectorPathMode(node) === 'polyline' ? [...(node.waypoints ?? [])] : [];
}

export function isAttachedConnectorEndpoint(endpoint: ConnectorEndpoint): endpoint is AttachedConnectorEndpoint {
  return endpoint.kind === 'attached';
}

export function getAnchorPoint(node: BoxNode, anchor: AnchorId, board?: BoardDoc): Point {
  const bounds = getBoxBounds(resolveNodeToWorld(node, board));
  const centerX = bounds.x + bounds.w / 2;
  const centerY = bounds.y + bounds.h / 2;

  switch (anchor) {
    case 'north':
      return { x: centerX, y: bounds.y };
    case 'east':
      return { x: bounds.x + bounds.w, y: centerY };
    case 'south':
      return { x: centerX, y: bounds.y + bounds.h };
    case 'west':
      return { x: bounds.x, y: centerY };
  }
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
  options: { excludeNodeId?: string; excludeConnectorId?: string } = {},
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
      nodes,
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
