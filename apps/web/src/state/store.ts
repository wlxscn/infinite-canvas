import type {
  AssetRecord,
  BoardDoc,
  CanvasNode,
  GroupNode,
  GroupChildNode,
  CanvasProject,
  CanvasStoreState,
  GenerationJob,
  Tool,
} from '../types/canvas';
import {
  appendNodeToGroup,
  bringHierarchicalNodeForward,
  dissolveGroup,
  getGroupById,
  getHierarchicalNodeById,
  getNodeParentGroupId,
  isConnectorAttachedToNode,
  isConnectorNode,
  moveNodeOutOfGroup as moveNodeOutOfGroupInTree,
  moveNodeToGroup,
  removeHierarchicalNodeById,
  sendHierarchicalNodeBackward,
  upsertHierarchicalNode,
} from '@infinite-canvas/canvas-engine';

const MAX_HISTORY = 100;

export function createEmptyBoard(): BoardDoc {
  return {
    version: 2,
    viewport: {
      tx: 0,
      ty: 0,
      scale: 1,
    },
    nodes: [],
  };
}

export function createEmptyProject(): CanvasProject {
  return {
    version: 2,
    board: createEmptyBoard(),
    assets: [],
    jobs: [],
    chat: {
      activeSessionId: null,
      sessions: [],
    },
  };
}

export function createInitialStore(project: CanvasProject): CanvasStoreState {
  return {
    project,
    tool: 'select',
    selectedId: null,
    selectedIds: [],
    activeGroupId: null,
    past: [],
    future: [],
  };
}

function projectsEqual(a: CanvasProject, b: CanvasProject): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function limitHistory(projects: CanvasProject[]): CanvasProject[] {
  if (projects.length <= MAX_HISTORY) {
    return projects;
  }
  return projects.slice(projects.length - MAX_HISTORY);
}

export function setTool(state: CanvasStoreState, tool: Tool): CanvasStoreState {
  return { ...state, tool };
}

export function setSelectedId(state: CanvasStoreState, selectedId: string | null): CanvasStoreState {
  return {
    ...state,
    selectedId,
    selectedIds: selectedId ? [selectedId] : [],
  };
}

export function setSelectedIds(
  state: CanvasStoreState,
  selectedIds: string[],
  selectedId: string | null = selectedIds[0] ?? null,
): CanvasStoreState {
  const nextIds = [...new Set(selectedIds)];
  const nextPrimary = selectedId && nextIds.includes(selectedId) ? selectedId : (nextIds[0] ?? null);
  return {
    ...state,
    selectedId: nextPrimary,
    selectedIds: nextIds,
  };
}

export function setActiveGroupId(state: CanvasStoreState, activeGroupId: string | null): CanvasStoreState {
  return { ...state, activeGroupId };
}

export function replaceProjectNoHistory(state: CanvasStoreState, project: CanvasProject): CanvasStoreState {
  return {
    ...state,
    project,
  };
}

export function switchProject(state: CanvasStoreState, project: CanvasProject): CanvasStoreState {
  return {
    ...state,
    project,
    selectedId: null,
    selectedIds: [],
    activeGroupId: null,
    past: [],
    future: [],
  };
}

export function commitProject(state: CanvasStoreState, nextProject: CanvasProject): CanvasStoreState {
  if (projectsEqual(state.project, nextProject)) {
    return state;
  }

  return {
    ...state,
    project: nextProject,
    past: limitHistory([...state.past, state.project]),
    future: [],
  };
}

export function finalizeMutation(
  state: CanvasStoreState,
  beforeProject: CanvasProject,
  afterProject: CanvasProject,
): CanvasStoreState {
  if (projectsEqual(beforeProject, afterProject)) {
    return {
      ...state,
      project: afterProject,
    };
  }

  return {
    ...state,
    project: afterProject,
    past: limitHistory([...state.past, beforeProject]),
    future: [],
  };
}

export function undo(state: CanvasStoreState): CanvasStoreState {
  if (state.past.length === 0) {
    return state;
  }

  const previous = state.past[state.past.length - 1];
  return {
    ...state,
    project: previous,
    selectedId: null,
    selectedIds: [],
    activeGroupId: null,
    past: state.past.slice(0, -1),
    future: [state.project, ...state.future],
  };
}

export function redo(state: CanvasStoreState): CanvasStoreState {
  if (state.future.length === 0) {
    return state;
  }

  const next = state.future[0];
  return {
    ...state,
    project: next,
    selectedId: null,
    selectedIds: [],
    activeGroupId: null,
    past: limitHistory([...state.past, state.project]),
    future: state.future.slice(1),
  };
}

export function upsertNode(nodes: CanvasNode[], node: CanvasNode): CanvasNode[] {
  const existing = getHierarchicalNodeById(nodes, node.id);
  if (!existing) {
    return [...nodes, node];
  }

  return upsertHierarchicalNode(nodes, node);
}

export function removeNodeById(nodes: CanvasNode[], id: string): CanvasNode[] {
  return removeHierarchicalNodeById(nodes, id).filter(
    (node) => !isConnectorNode(node) || !isConnectorAttachedToNode(node, id),
  );
}

export function getNodeById(nodes: CanvasNode[], id: string | null): CanvasNode | null {
  return getHierarchicalNodeById(nodes, id);
}

export function getAssetById(assets: AssetRecord[], id: string | undefined): AssetRecord | null {
  if (!id) {
    return null;
  }
  return assets.find((asset) => asset.id === id) ?? null;
}

export function upsertAsset(assets: AssetRecord[], asset: AssetRecord): AssetRecord[] {
  const index = assets.findIndex((item) => item.id === asset.id);
  if (index === -1) {
    return [asset, ...assets];
  }

  const next = assets.slice();
  next[index] = asset;
  return next;
}

export function upsertJob(jobs: GenerationJob[], job: GenerationJob): GenerationJob[] {
  const index = jobs.findIndex((item) => item.id === job.id);
  if (index === -1) {
    return [job, ...jobs];
  }

  const next = jobs.slice();
  next[index] = job;
  return next;
}

export function bringNodeForward(nodes: CanvasNode[], id: string): CanvasNode[] {
  return bringHierarchicalNodeForward(nodes, id);
}

export function sendNodeBackward(nodes: CanvasNode[], id: string): CanvasNode[] {
  return sendHierarchicalNodeBackward(nodes, id);
}

export function createGroupNode(x: number, y: number, w = 280, h = 180): GroupNode {
  return {
    id: crypto.randomUUID ? `node_${crypto.randomUUID()}` : `node_${Date.now()}`,
    type: 'group',
    x,
    y,
    w,
    h,
    children: [],
    name: '成组',
  };
}

export function wrapNodeInNewGroup(nodes: CanvasNode[], nodeId: string): CanvasNode[] {
  return wrapNodesInNewGroup(nodes, [nodeId]);
}

function isGroupableNode(node: CanvasNode): node is GroupChildNode {
  return !isConnectorNode(node) && node.type !== 'group';
}

function getNodeBounds(node: GroupChildNode): { x: number; y: number; w: number; h: number } {
  if (node.type === 'freehand') {
    const minX = Math.min(...node.points.map((point) => point.x));
    const minY = Math.min(...node.points.map((point) => point.y));
    const maxX = Math.max(...node.points.map((point) => point.x));
    const maxY = Math.max(...node.points.map((point) => point.y));
    return {
      x: minX,
      y: minY,
      w: maxX - minX,
      h: maxY - minY,
    };
  }

  return {
    x: node.x,
    y: node.y,
    w: node.w,
    h: node.h,
  };
}

function toGroupChild(node: GroupChildNode, group: GroupNode): GroupNode['children'][number] {
  if (node.type === 'freehand') {
    return {
      ...node,
      points: node.points.map((point) => ({
        x: point.x - group.x,
        y: point.y - group.y,
      })),
    };
  }

  return {
    ...node,
    x: node.x - group.x,
    y: node.y - group.y,
  };
}

export function wrapNodesInNewGroup(nodes: CanvasNode[], nodeIds: string[]): CanvasNode[] {
  const uniqueIds = [...new Set(nodeIds)];
  if (uniqueIds.length === 0) {
    return nodes;
  }

  const validIds = uniqueIds.filter((nodeId) => {
    const node = getHierarchicalNodeById(nodes, nodeId);
    return !!node && isGroupableNode(node) && !getNodeParentGroupId(nodes, nodeId);
  });

  if (validIds.length === 0) {
    return nodes;
  }

  const orderedNodes = nodes.filter((node): node is GroupChildNode => validIds.includes(node.id) && isGroupableNode(node));
  if (orderedNodes.length === 0) {
    return nodes;
  }

  const padding = 24;
  const bounds = orderedNodes.map(getNodeBounds);
  const minX = Math.min(...bounds.map((bound) => bound.x));
  const minY = Math.min(...bounds.map((bound) => bound.y));
  const maxX = Math.max(...bounds.map((bound) => bound.x + bound.w));
  const maxY = Math.max(...bounds.map((bound) => bound.y + bound.h));
  const group = createGroupNode(minX - padding, minY - padding, maxX - minX + padding * 2, maxY - minY + padding * 2);
  group.children = orderedNodes.map((currentNode) => toGroupChild(currentNode, group));

  const firstIndex = nodes.findIndex((candidate) => validIds.includes(candidate.id));
  const remainingNodes = nodes.filter((candidate) => !validIds.includes(candidate.id));
  const nextNodes = remainingNodes.slice();
  nextNodes.splice(firstIndex === -1 ? nextNodes.length : firstIndex, 0, group);
  return nextNodes;
}

export function moveNodeOutOfGroup(nodes: CanvasNode[], nodeId: string): CanvasNode[] {
  return moveNodeOutOfGroupInTree(nodes, nodeId);
}

export function insertNodeIntoGroup(nodes: CanvasNode[], groupId: string, node: CanvasNode): CanvasNode[] {
  if (node.type === 'connector' || node.type === 'group') {
    return nodes;
  }
  return appendNodeToGroup(nodes, groupId, node);
}

export function dissolveGroupNode(nodes: CanvasNode[], groupId: string): CanvasNode[] {
  return dissolveGroup(nodes, groupId);
}

export function canExitActiveGroup(nodes: CanvasNode[], activeGroupId: string | null): boolean {
  return !!getGroupById(nodes, activeGroupId);
}

export { moveNodeToGroup };
export { getNodeParentGroupId };
