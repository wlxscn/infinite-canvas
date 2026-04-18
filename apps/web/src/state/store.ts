import type {
  AssetRecord,
  BoardDoc,
  CanvasNode,
  ContainerNode,
  CanvasProject,
  CanvasStoreState,
  GenerationJob,
  Tool,
} from '../types/canvas';
import {
  appendNodeToContainer,
  bringHierarchicalNodeForward,
  dissolveContainer,
  getContainerById,
  getHierarchicalNodeById,
  getNodeParentContainerId,
  isConnectorAttachedToNode,
  isConnectorNode,
  moveNodeOutOfContainer as moveNodeOutOfContainerInTree,
  moveNodeToContainer,
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
    activeContainerId: null,
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
  return { ...state, selectedId };
}

export function setActiveContainerId(state: CanvasStoreState, activeContainerId: string | null): CanvasStoreState {
  return { ...state, activeContainerId };
}

export function replaceProjectNoHistory(state: CanvasStoreState, project: CanvasProject): CanvasStoreState {
  return {
    ...state,
    project,
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
    activeContainerId: null,
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
    activeContainerId: null,
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

export function createContainerNode(x: number, y: number, w = 280, h = 180): ContainerNode {
  return {
    id: crypto.randomUUID ? `node_${crypto.randomUUID()}` : `node_${Date.now()}`,
    type: 'container',
    x,
    y,
    w,
    h,
    children: [],
    name: '容器',
  };
}

export function wrapNodeInNewContainer(nodes: CanvasNode[], nodeId: string): CanvasNode[] {
  const node = getHierarchicalNodeById(nodes, nodeId);
  const parentContainerId = getNodeParentContainerId(nodes, nodeId);
  if (!node || isConnectorNode(node) || node.type === 'container' || parentContainerId) {
    return nodes;
  }

  const padding = 24;
  const worldNode = node;
  let container: ContainerNode;
  if (worldNode.type === 'freehand') {
    const minX = Math.min(...worldNode.points.map((point) => point.x));
    const minY = Math.min(...worldNode.points.map((point) => point.y));
    const maxX = Math.max(...worldNode.points.map((point) => point.x));
    const maxY = Math.max(...worldNode.points.map((point) => point.y));
    container = createContainerNode(minX - padding, minY - padding, maxX - minX + padding * 2, maxY - minY + padding * 2);
    container.children = [
      {
        ...worldNode,
        points: worldNode.points.map((point) => ({
          x: point.x - container.x,
          y: point.y - container.y,
        })),
      },
    ];
  } else {
    container = createContainerNode(worldNode.x - padding, worldNode.y - padding, worldNode.w + padding * 2, worldNode.h + padding * 2);
    container.children = [
      {
        ...worldNode,
        x: worldNode.x - container.x,
        y: worldNode.y - container.y,
      },
    ];
  }

  const withoutNode = removeNodeById(nodes, nodeId);
  return [...withoutNode, container];
}

export function moveNodeOutOfContainer(nodes: CanvasNode[], nodeId: string): CanvasNode[] {
  return moveNodeOutOfContainerInTree(nodes, nodeId);
}

export function insertNodeIntoContainer(nodes: CanvasNode[], containerId: string, node: CanvasNode): CanvasNode[] {
  if (node.type === 'connector' || node.type === 'container') {
    return nodes;
  }
  return appendNodeToContainer(nodes, containerId, node);
}

export function dissolveContainerNode(nodes: CanvasNode[], containerId: string): CanvasNode[] {
  return dissolveContainer(nodes, containerId);
}

export function canExitActiveContainer(nodes: CanvasNode[], activeContainerId: string | null): boolean {
  return !!getContainerById(nodes, activeContainerId);
}

export { moveNodeToContainer };
export { getNodeParentContainerId };
