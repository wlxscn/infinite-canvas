import type { AnchorId, ConnectorNode, FreehandNode, RectNode } from './model';

export type PointerMode =
  | 'idle'
  | 'panning'
  | 'dragging-node'
  | 'drawing-rect'
  | 'drawing-freehand'
  | 'drawing-connector'
  | 'editing-connector-end'
  | 'resizing-node'
  | 'pinch';

export interface DraftState {
  draftRect: RectNode | null;
  draftFreehand: FreehandNode | null;
  draftConnector: ConnectorNode | null;
}

export interface HoveredAnchor {
  nodeId: string;
  anchor: AnchorId;
}

export interface SnapGuide {
  axis: 'x' | 'y';
  screenPosition: number;
  start: number;
  end: number;
  kind: 'edge' | 'center';
}

export interface CanvasInteractionState extends DraftState {
  pointerMode: PointerMode;
  isWheelInteractionActive: boolean;
  snapGuides: SnapGuide[];
  hoveredAnchor: HoveredAnchor | null;
  activeConnectorHandle: 'start' | 'end' | null;
}

export function createInitialInteractionState(): CanvasInteractionState {
  return {
    pointerMode: 'idle',
    isWheelInteractionActive: false,
    draftRect: null,
    draftFreehand: null,
    draftConnector: null,
    snapGuides: [],
    hoveredAnchor: null,
    activeConnectorHandle: null,
  };
}

export function isActiveInteractionMode(mode: PointerMode): boolean {
  return (
    mode === 'panning' ||
    mode === 'dragging-node' ||
    mode === 'drawing-connector' ||
    mode === 'editing-connector-end' ||
    mode === 'resizing-node' ||
    mode === 'pinch'
  );
}

export function isInteractionActive(state: CanvasInteractionState): boolean {
  return isActiveInteractionMode(state.pointerMode) || state.isWheelInteractionActive;
}

export function getCanvasCursor(
  state: CanvasInteractionState,
  tool: 'select' | 'rect' | 'freehand' | 'text' | 'connector' | 'pan',
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
  if (tool === 'rect' || tool === 'freehand' || tool === 'text' || tool === 'connector') {
    return 'crosshair';
  }
  return 'default';
}
