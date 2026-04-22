import { boundsFromPoints, getBoxCenter, getBoxRotation, getRotatedBoxBounds, rotatePoint, normalizeBounds, type Bounds } from './geometry';
import type { BoardDoc, BoxNode, CanvasNode, GroupChildNode, GroupNode, Point } from './model';

export interface NodeLocation<TNode extends CanvasNode = CanvasNode> {
  node: TNode;
  parentGroupId: string | null;
  offset: Point;
}

export function isGroupNode(node: CanvasNode): node is GroupNode {
  return node.type === 'group';
}

function isBoxLikeNode(node: CanvasNode): node is BoxNode | GroupNode {
  return (
    node.type === 'rect' ||
    node.type === 'text' ||
    node.type === 'image' ||
    node.type === 'video' ||
    node.type === 'group'
  );
}

function getGroupCenter(group: GroupNode): Point {
  return getBoxCenter(group);
}

export function getNodeWorldOffset(board: BoardDoc, nodeId: string): Point {
  for (const node of board.nodes) {
    if (node.id === nodeId) {
      return { x: 0, y: 0 };
    }

    if (!isGroupNode(node)) {
      continue;
    }

    const child = node.children.find((candidate) => candidate.id === nodeId);
    if (child) {
      return { x: node.x, y: node.y };
    }
  }

  return { x: 0, y: 0 };
}

export function getNodeParentGroupId(nodes: CanvasNode[], nodeId: string): string | null {
  for (const node of nodes) {
    if (!isGroupNode(node)) {
      continue;
    }

    if (node.children.some((child) => child.id === nodeId)) {
      return node.id;
    }
  }

  return null;
}

export function getNodeById(nodes: CanvasNode[], id: string | null): CanvasNode | null {
  if (!id) {
    return null;
  }

  for (const node of nodes) {
    if (node.id === id) {
      return node;
    }

    if (!isGroupNode(node)) {
      continue;
    }

    const child = node.children.find((candidate) => candidate.id === id);
    if (child) {
      return child;
    }
  }

  return null;
}

export function getGroupById(nodes: CanvasNode[], id: string | null): GroupNode | null {
  const node = getNodeById(nodes, id);
  return node && isGroupNode(node) ? node : null;
}

export function getNodesInContext(board: BoardDoc, activeGroupId: string | null): CanvasNode[] {
  if (!activeGroupId) {
    return board.nodes;
  }

  const group = getGroupById(board.nodes, activeGroupId);
  return group ? group.children : board.nodes;
}

export function getAllDescendantNodes(nodes: CanvasNode[]): CanvasNode[] {
  const result: CanvasNode[] = [];

  for (const node of nodes) {
    result.push(node);
    if (isGroupNode(node)) {
      result.push(...node.children);
    }
  }

  return result;
}

function translateChildNodeToWorldWithGroupTransform(node: GroupChildNode, group: GroupNode): GroupChildNode {
  const groupCenter = getGroupCenter(group);
  const groupRotation = getBoxRotation(group);

  if (node.type === 'freehand') {
    return {
      ...node,
      points: node.points.map((point) =>
        rotatePoint(
          {
            x: point.x + group.x,
            y: point.y + group.y,
          },
          groupCenter,
          groupRotation,
        ),
      ),
    };
  }

  const localCenter = {
    x: group.x + node.x + node.w / 2,
    y: group.y + node.y + node.h / 2,
  };
  const worldCenter = rotatePoint(localCenter, groupCenter, groupRotation);
  return {
    ...node,
    x: worldCenter.x - node.w / 2,
    y: worldCenter.y - node.h / 2,
    rotation: getBoxRotation(node) + groupRotation,
  };
}

export function resolveNodeToWorld<TNode extends CanvasNode>(node: TNode, board?: BoardDoc): TNode {
  if (!board || isGroupNode(node)) {
    return node;
  }

  const parentGroupId = getNodeParentGroupId(board.nodes, node.id);
  if (!parentGroupId) {
    return node;
  }

  const parentGroup = getGroupById(board.nodes, parentGroupId);
  if (!parentGroup) {
    return node;
  }

  return translateChildNodeToWorldWithGroupTransform(node as GroupChildNode, parentGroup) as TNode;
}

export function getNodeWorldBounds(node: CanvasNode, board: BoardDoc): Bounds {
  const worldNode = resolveNodeToWorld(node, board);
  if (worldNode.type === 'freehand') {
    return normalizeBounds(boundsFromPoints(worldNode.points));
  }

  if (worldNode.type === 'connector') {
    return normalizeBounds(boundsFromPoints(resolveConnectorBoundsPoints(worldNode)));
  }

  if (isBoxLikeNode(worldNode)) {
    return getRotatedBoxBounds(worldNode);
  }

  return normalizeBounds(worldNode);
}

function resolveConnectorBoundsPoints(node: Extract<CanvasNode, { type: 'connector' }>): Point[] {
  const points: Point[] = [];
  if (node.start.kind === 'free') {
    points.push({ x: node.start.x, y: node.start.y });
  }
  if (node.end.kind === 'free') {
    points.push({ x: node.end.x, y: node.end.y });
  }
  if (node.waypoints) {
    points.push(...node.waypoints);
  }
  if (node.curveControl) {
    points.push(node.curveControl);
  }
  if (node.curveStartControl) {
    points.push(node.curveStartControl);
  }
  if (node.curveEndControl) {
    points.push(node.curveEndControl);
  }
  return points.length > 0 ? points : [{ x: 0, y: 0 }];
}

export function worldPointToGroupLocal(board: BoardDoc, groupId: string | null, point: Point): Point {
  if (!groupId) {
    return point;
  }

  const group = getGroupById(board.nodes, groupId);
  if (!group) {
    return point;
  }

  const unrotated = rotatePoint(point, getGroupCenter(group), -getBoxRotation(group));
  return {
    x: unrotated.x - group.x,
    y: unrotated.y - group.y,
  };
}

export function worldPointToNodeLocal(board: BoardDoc, nodeId: string, point: Point): Point {
  const node = getNodeById(board.nodes, nodeId);
  if (!node) {
    return point;
  }

  const parentGroupId = getNodeParentGroupId(board.nodes, nodeId);
  const groupLocalPoint = worldPointToGroupLocal(board, parentGroupId, point);

  if (!isBoxLikeNode(node)) {
    return groupLocalPoint;
  }

  return rotatePoint(groupLocalPoint, getBoxCenter(node), -getBoxRotation(node));
}

export function worldDeltaToGroupLocal(board: BoardDoc, groupId: string | null, delta: Point): Point {
  if (!groupId) {
    return delta;
  }

  const group = getGroupById(board.nodes, groupId);
  if (!group) {
    return delta;
  }

  return rotatePoint(delta, { x: 0, y: 0 }, -getBoxRotation(group));
}

export function upsertNode(nodes: CanvasNode[], node: CanvasNode): CanvasNode[] {
  const topLevelIndex = nodes.findIndex((item) => item.id === node.id);
  if (topLevelIndex !== -1) {
    const next = nodes.slice();
    next[topLevelIndex] = node;
    return next;
  }

  return nodes.map((current) => {
    if (!isGroupNode(current)) {
      return current;
    }

    const childIndex = current.children.findIndex((candidate) => candidate.id === node.id);
    if (childIndex === -1) {
      return current;
    }

    const nextChildren = current.children.slice();
    nextChildren[childIndex] = node as GroupChildNode;
    return {
      ...current,
      children: nextChildren,
    };
  });
}

export function removeNodeById(nodes: CanvasNode[], id: string): CanvasNode[] {
  return nodes
    .filter((node) => node.id !== id)
    .map((node) => {
      if (!isGroupNode(node)) {
        return node;
      }

      return {
        ...node,
        children: node.children.filter((child) => child.id !== id),
      };
    });
}

export function bringNodeForward(nodes: CanvasNode[], id: string): CanvasNode[] {
  const index = nodes.findIndex((node) => node.id === id);
  if (index !== -1) {
    if (index === nodes.length - 1) {
      return nodes;
    }
    const next = nodes.slice();
    [next[index], next[index + 1]] = [next[index + 1], next[index]];
    return next;
  }

  return nodes.map((node) => {
      if (!isGroupNode(node)) {
      return node;
    }

    const childIndex = node.children.findIndex((child) => child.id === id);
    if (childIndex === -1 || childIndex === node.children.length - 1) {
      return node;
    }

    const nextChildren = node.children.slice();
    [nextChildren[childIndex], nextChildren[childIndex + 1]] = [nextChildren[childIndex + 1], nextChildren[childIndex]];
    return {
      ...node,
      children: nextChildren,
    };
  });
}

export function sendNodeBackward(nodes: CanvasNode[], id: string): CanvasNode[] {
  const index = nodes.findIndex((node) => node.id === id);
  if (index !== -1) {
    if (index <= 0) {
      return nodes;
    }
    const next = nodes.slice();
    [next[index], next[index - 1]] = [next[index - 1], next[index]];
    return next;
  }

  return nodes.map((node) => {
      if (!isGroupNode(node)) {
      return node;
    }

    const childIndex = node.children.findIndex((child) => child.id === id);
    if (childIndex <= 0) {
      return node;
    }

    const nextChildren = node.children.slice();
    [nextChildren[childIndex], nextChildren[childIndex - 1]] = [nextChildren[childIndex - 1], nextChildren[childIndex]];
    return {
      ...node,
      children: nextChildren,
    };
  });
}

export function moveNodeToGroup(nodes: CanvasNode[], nodeId: string, groupId: string): CanvasNode[] {
  const targetNode = getNodeById(nodes, nodeId);
  const targetGroup = getGroupById(nodes, groupId);

  if (!targetNode || !targetGroup || isGroupNode(targetNode) || targetNode.type === 'connector') {
    return nodes;
  }

  const targetParent = getNodeParentGroupId(nodes, nodeId);
  if (targetParent === groupId) {
    return nodes;
  }

  const worldNode = resolveNodeToWorld(targetNode, {
    version: 2,
    viewport: { tx: 0, ty: 0, scale: 1 },
    nodes,
  });
  const targetGroupCenter = getGroupCenter(targetGroup);
  const targetGroupRotation = getBoxRotation(targetGroup);
  const localNode =
    worldNode.type === 'freehand'
      ? ({
          ...worldNode,
          points: worldNode.points.map((point) => {
            const localPoint = rotatePoint(point, targetGroupCenter, -targetGroupRotation);
            return {
              x: localPoint.x - targetGroup.x,
              y: localPoint.y - targetGroup.y,
            };
          }),
        } as GroupChildNode)
      : ({
          ...worldNode,
          x: rotatePoint(getBoxCenter(worldNode), targetGroupCenter, -targetGroupRotation).x - targetGroup.x - worldNode.w / 2,
          y: rotatePoint(getBoxCenter(worldNode), targetGroupCenter, -targetGroupRotation).y - targetGroup.y - worldNode.h / 2,
          rotation: getBoxRotation(worldNode) - targetGroupRotation,
        } as GroupChildNode);

  const removedNodes = removeNodeById(nodes, nodeId);
  return removedNodes.map((node) =>
    node.id === groupId && isGroupNode(node)
      ? {
          ...node,
          children: [...node.children, localNode],
        }
      : node,
  );
}

export function appendNodeToGroup(nodes: CanvasNode[], groupId: string, node: GroupChildNode): CanvasNode[] {
  return nodes.map((current) =>
    current.id === groupId && isGroupNode(current)
      ? {
          ...current,
          children: [...current.children, node],
        }
      : current,
  );
}

export function moveNodeOutOfGroup(nodes: CanvasNode[], nodeId: string): CanvasNode[] {
  const node = getNodeById(nodes, nodeId);
  const parentGroupId = getNodeParentGroupId(nodes, nodeId);
  const parentGroup = getGroupById(nodes, parentGroupId);

  if (!node || !parentGroup || isGroupNode(node) || node.type === 'connector') {
    return nodes;
  }

  const worldNode = translateChildNodeToWorldWithGroupTransform(node, parentGroup);
  const removedNodes = removeNodeById(nodes, nodeId);
  const parentIndex = removedNodes.findIndex((candidate) => candidate.id === parentGroupId);
  const next = removedNodes.slice();
  next.splice(parentIndex + 1, 0, worldNode);
  return next;
}

export function dissolveGroup(nodes: CanvasNode[], groupId: string): CanvasNode[] {
  const groupIndex = nodes.findIndex((node) => node.id === groupId && isGroupNode(node));
  if (groupIndex === -1) {
    return nodes;
  }

  const group = nodes[groupIndex] as GroupNode;
  const worldChildren = group.children.map((child) => translateChildNodeToWorldWithGroupTransform(child, group));
  const next = nodes.slice();
  next.splice(groupIndex, 1, ...worldChildren);
  return next;
}
