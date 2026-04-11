import type { CanvasDoc, CanvasStoreState, Shape, Tool } from '../types/canvas';

const MAX_HISTORY = 100;

export function createEmptyDoc(): CanvasDoc {
  return {
    version: 1,
    viewport: {
      tx: 0,
      ty: 0,
      scale: 1,
    },
    shapes: [],
  };
}

export function createInitialStore(doc: CanvasDoc): CanvasStoreState {
  return {
    doc,
    tool: 'select',
    selectedId: null,
    past: [],
    future: [],
  };
}

function docsEqual(a: CanvasDoc, b: CanvasDoc): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function limitHistory(docs: CanvasDoc[]): CanvasDoc[] {
  if (docs.length <= MAX_HISTORY) {
    return docs;
  }
  return docs.slice(docs.length - MAX_HISTORY);
}

export function setTool(state: CanvasStoreState, tool: Tool): CanvasStoreState {
  return { ...state, tool };
}

export function setSelectedId(state: CanvasStoreState, selectedId: string | null): CanvasStoreState {
  return { ...state, selectedId };
}

export function replaceDocNoHistory(state: CanvasStoreState, doc: CanvasDoc): CanvasStoreState {
  return {
    ...state,
    doc,
  };
}

export function commitDoc(state: CanvasStoreState, nextDoc: CanvasDoc): CanvasStoreState {
  if (docsEqual(state.doc, nextDoc)) {
    return state;
  }

  return {
    ...state,
    doc: nextDoc,
    past: limitHistory([...state.past, state.doc]),
    future: [],
  };
}

export function finalizeMutation(
  state: CanvasStoreState,
  beforeDoc: CanvasDoc,
  afterDoc: CanvasDoc,
): CanvasStoreState {
  if (docsEqual(beforeDoc, afterDoc)) {
    return {
      ...state,
      doc: afterDoc,
    };
  }

  return {
    ...state,
    doc: afterDoc,
    past: limitHistory([...state.past, beforeDoc]),
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
    doc: previous,
    selectedId: null,
    past: state.past.slice(0, -1),
    future: [state.doc, ...state.future],
  };
}

export function redo(state: CanvasStoreState): CanvasStoreState {
  if (state.future.length === 0) {
    return state;
  }

  const next = state.future[0];
  return {
    ...state,
    doc: next,
    selectedId: null,
    past: limitHistory([...state.past, state.doc]),
    future: state.future.slice(1),
  };
}

export function upsertShape(shapes: Shape[], shape: Shape): Shape[] {
  const index = shapes.findIndex((item) => item.id === shape.id);
  if (index === -1) {
    return [...shapes, shape];
  }

  const next = shapes.slice();
  next[index] = shape;
  return next;
}

export function removeShapeById(shapes: Shape[], id: string): Shape[] {
  return shapes.filter((shape) => shape.id !== id);
}
