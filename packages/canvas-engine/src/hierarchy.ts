import { normalizeBounds, type Bounds } from './geometry';
import type { BoardDoc, CanvasNode, ContainerChildNode, ContainerNode, Point } from './model';

export interface NodeLocation<TNode extends CanvasNode = CanvasNode> {
  node: TNode;
  parentContainerId: string | null;
  offset: Point;
}

export function isContainerNode(node: CanvasNode): node is ContainerNode {
  return node.type === 'container';
}

export function getNodeWorldOffset(board: BoardDoc, nodeId: string): Point {
  for (const node of board.nodes) {
    if (node.id === nodeId) {
      return { x: 0, y: 0 };
    }

    if (!isContainerNode(node)) {
      continue;
    }

    const child = node.children.find((candidate) => candidate.id === nodeId);
    if (child) {
      return { x: node.x, y: node.y };
    }
  }

  return { x: 0, y: 0 };
}

export function getNodeParentContainerId(nodes: CanvasNode[], nodeId: string): string | null {
  for (const node of nodes) {
    if (!isContainerNode(node)) {
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

    if (!isContainerNode(node)) {
      continue;
    }

    const child = node.children.find((candidate) => candidate.id === id);
    if (child) {
      return child;
    }
  }

  return null;
}

export function getContainerById(nodes: CanvasNode[], id: string | null): ContainerNode | null {
  const node = getNodeById(nodes, id);
  return node && isContainerNode(node) ? node : null;
}

export function getNodesInContext(board: BoardDoc, activeContainerId: string | null): CanvasNode[] {
  if (!activeContainerId) {
    return board.nodes;
  }

  const container = getContainerById(board.nodes, activeContainerId);
  return container ? container.children : board.nodes;
}

export function getAllDescendantNodes(nodes: CanvasNode[]): CanvasNode[] {
  const result: CanvasNode[] = [];

  for (const node of nodes) {
    result.push(node);
    if (isContainerNode(node)) {
      result.push(...node.children);
    }
  }

  return result;
}

function translateChildNodeToWorld(node: ContainerChildNode, offset: Point): ContainerChildNode {
  if (node.type === 'freehand') {
    return {
      ...node,
      points: node.points.map((point) => ({
        x: point.x + offset.x,
        y: point.y + offset.y,
      })),
    };
  }

  return {
    ...node,
    x: node.x + offset.x,
    y: node.y + offset.y,
  };
}

export function resolveNodeToWorld<TNode extends CanvasNode>(node: TNode, board?: BoardDoc): TNode {
  if (!board || isContainerNode(node)) {
    return node;
  }

  const offset = getNodeWorldOffset(board, node.id);
  if (offset.x === 0 && offset.y === 0) {
    return node;
  }

  return translateChildNodeToWorld(node as ContainerChildNode, offset) as TNode;
}

export function getNodeWorldBounds(node: CanvasNode, board: BoardDoc): Bounds {
  const worldNode = resolveNodeToWorld(node, board);
  if (worldNode.type === 'freehand') {
    return normalizeBounds({
      x: Math.min(...worldNode.points.map((point) => point.x)),
      y: Math.min(...worldNode.points.map((point) => point.y)),
      w:
        Math.max(...worldNode.points.map((point) => point.x)) -
        Math.min(...worldNode.points.map((point) => point.x)),
      h:
        Math.max(...worldNode.points.map((point) => point.y)) -
        Math.min(...worldNode.points.map((point) => point.y)),
    });
  }

  if (isContainerNode(worldNode) || worldNode.type === 'connector') {
    return normalizeBounds(worldNode as Bounds);
  }

  return normalizeBounds(worldNode);
}

export function worldPointToContainerLocal(board: BoardDoc, containerId: string | null, point: Point): Point {
  if (!containerId) {
    return point;
  }

  const container = getContainerById(board.nodes, containerId);
  if (!container) {
    return point;
  }

  return {
    x: point.x - container.x,
    y: point.y - container.y,
  };
}

export function worldPointToNodeLocal(board: BoardDoc, nodeId: string, point: Point): Point {
  const parentContainerId = getNodeParentContainerId(board.nodes, nodeId);
  return worldPointToContainerLocal(board, parentContainerId, point);
}

export function upsertNode(nodes: CanvasNode[], node: CanvasNode): CanvasNode[] {
  const topLevelIndex = nodes.findIndex((item) => item.id === node.id);
  if (topLevelIndex !== -1) {
    const next = nodes.slice();
    next[topLevelIndex] = node;
    return next;
  }

  return nodes.map((current) => {
    if (!isContainerNode(current)) {
      return current;
    }

    const childIndex = current.children.findIndex((candidate) => candidate.id === node.id);
    if (childIndex === -1) {
      return current;
    }

    const nextChildren = current.children.slice();
    nextChildren[childIndex] = node as ContainerChildNode;
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
      if (!isContainerNode(node)) {
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
    if (!isContainerNode(node)) {
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
    if (!isContainerNode(node)) {
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

export function moveNodeToContainer(nodes: CanvasNode[], nodeId: string, containerId: string): CanvasNode[] {
  const targetNode = getNodeById(nodes, nodeId);
  const targetContainer = getContainerById(nodes, containerId);

  if (!targetNode || !targetContainer || isContainerNode(targetNode) || targetNode.type === 'connector') {
    return nodes;
  }

  const targetParent = getNodeParentContainerId(nodes, nodeId);
  if (targetParent === containerId) {
    return nodes;
  }

  const worldNode = resolveNodeToWorld(targetNode, {
    version: 2,
    viewport: { tx: 0, ty: 0, scale: 1 },
    nodes,
  });
  const localNode = translateChildNodeToWorld(worldNode as ContainerChildNode, {
    x: -targetContainer.x,
    y: -targetContainer.y,
  });

  const removedNodes = removeNodeById(nodes, nodeId);
  return removedNodes.map((node) =>
    node.id === containerId && isContainerNode(node)
      ? {
          ...node,
          children: [...node.children, localNode],
        }
      : node,
  );
}

export function appendNodeToContainer(nodes: CanvasNode[], containerId: string, node: ContainerChildNode): CanvasNode[] {
  return nodes.map((current) =>
    current.id === containerId && isContainerNode(current)
      ? {
          ...current,
          children: [...current.children, node],
        }
      : current,
  );
}

export function moveNodeOutOfContainer(nodes: CanvasNode[], nodeId: string): CanvasNode[] {
  const node = getNodeById(nodes, nodeId);
  const parentContainerId = getNodeParentContainerId(nodes, nodeId);
  const parentContainer = getContainerById(nodes, parentContainerId);

  if (!node || !parentContainer || isContainerNode(node) || node.type === 'connector') {
    return nodes;
  }

  const worldNode = translateChildNodeToWorld(node, { x: parentContainer.x, y: parentContainer.y });
  const removedNodes = removeNodeById(nodes, nodeId);
  const parentIndex = removedNodes.findIndex((candidate) => candidate.id === parentContainerId);
  const next = removedNodes.slice();
  next.splice(parentIndex + 1, 0, worldNode);
  return next;
}

export function dissolveContainer(nodes: CanvasNode[], containerId: string): CanvasNode[] {
  const containerIndex = nodes.findIndex((node) => node.id === containerId && isContainerNode(node));
  if (containerIndex === -1) {
    return nodes;
  }

  const container = nodes[containerIndex] as ContainerNode;
  const worldChildren = container.children.map((child) =>
    translateChildNodeToWorld(child, { x: container.x, y: container.y }),
  );
  const next = nodes.slice();
  next.splice(containerIndex, 1, ...worldChildren);
  return next;
}
