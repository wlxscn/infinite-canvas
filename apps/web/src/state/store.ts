import type {
  AssetRecord,
  BoardDoc,
  CanvasNode,
  CanvasProject,
  CanvasStoreState,
  GenerationJob,
  Tool,
} from '../types/canvas';

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
    past: limitHistory([...state.past, state.project]),
    future: state.future.slice(1),
  };
}

export function upsertNode(nodes: CanvasNode[], node: CanvasNode): CanvasNode[] {
  const index = nodes.findIndex((item) => item.id === node.id);
  if (index === -1) {
    return [...nodes, node];
  }

  const next = nodes.slice();
  next[index] = node;
  return next;
}

export function removeNodeById(nodes: CanvasNode[], id: string): CanvasNode[] {
  return nodes.filter((node) => node.id !== id);
}

export function getNodeById(nodes: CanvasNode[], id: string | null): CanvasNode | null {
  if (!id) {
    return null;
  }
  return nodes.find((node) => node.id === id) ?? null;
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
  const index = nodes.findIndex((node) => node.id === id);
  if (index === -1 || index === nodes.length - 1) {
    return nodes;
  }

  const next = nodes.slice();
  [next[index], next[index + 1]] = [next[index + 1], next[index]];
  return next;
}

export function sendNodeBackward(nodes: CanvasNode[], id: string): CanvasNode[] {
  const index = nodes.findIndex((node) => node.id === id);
  if (index <= 0) {
    return nodes;
  }

  const next = nodes.slice();
  [next[index], next[index - 1]] = [next[index - 1], next[index]];
  return next;
}
