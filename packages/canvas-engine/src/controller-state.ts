import type { FreehandNode, RectNode } from './model';

export type PointerMode =
  | 'idle'
  | 'panning'
  | 'dragging-node'
  | 'drawing-rect'
  | 'drawing-freehand'
  | 'resizing-node'
  | 'pinch';

export interface DraftState {
  draftRect: RectNode | null;
  draftFreehand: FreehandNode | null;
}

export interface CanvasInteractionState extends DraftState {
  pointerMode: PointerMode;
  isWheelInteractionActive: boolean;
}

export function createInitialInteractionState(): CanvasInteractionState {
  return {
    pointerMode: 'idle',
    isWheelInteractionActive: false,
    draftRect: null,
    draftFreehand: null,
  };
}

export function isActiveInteractionMode(mode: PointerMode): boolean {
  return mode === 'panning' || mode === 'dragging-node' || mode === 'resizing-node' || mode === 'pinch';
}

export function isInteractionActive(state: CanvasInteractionState): boolean {
  return isActiveInteractionMode(state.pointerMode) || state.isWheelInteractionActive;
}

export function getCanvasCursor(
  state: CanvasInteractionState,
  tool: 'select' | 'rect' | 'freehand' | 'text' | 'pan',
  isSpacePressed: boolean,
): string {
  if (state.pointerMode === 'panning' || state.pointerMode === 'pinch') {
    return 'grabbing';
  }
  if (state.pointerMode === 'resizing-node') {
    return 'nwse-resize';
  }
  if (tool === 'pan' || isSpacePressed) {
    return 'grab';
  }
  if (tool === 'rect' || tool === 'freehand' || tool === 'text') {
    return 'crosshair';
  }
  return 'default';
}
