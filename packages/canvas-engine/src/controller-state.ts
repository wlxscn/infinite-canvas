import type { AnchorId, ConnectorNode, FreehandNode, Point, RectNode } from './model';

export type PointerMode =
  | 'idle'
  | 'panning'
  | 'dragging-node'
  | 'drawing-rect'
  | 'drawing-freehand'
  | 'drawing-connector'
  | 'editing-connector-end'
  | 'editing-connector-waypoint'
  | 'resizing-node'
  | 'marquee-selecting'
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

export type ConnectorHandle =
  | { kind: 'endpoint'; endpoint: 'start' | 'end' }
  | { kind: 'waypoint'; index: number };

export interface SnapGuide {
  axis: 'x' | 'y';
  screenPosition: number;
  start: number;
  end: number;
  kind: 'edge' | 'center';
}

export interface SelectionBox {
  start: Point;
  current: Point;
}

export interface CanvasInteractionState extends DraftState {
  pointerMode: PointerMode;
  isWheelInteractionActive: boolean;
  snapGuides: SnapGuide[];
  hoveredNodeId: string | null;
  hoveredAnchor: HoveredAnchor | null;
  activeConnectorHandle: ConnectorHandle | null;
  selectionBox: SelectionBox | null;
}

export function createInitialInteractionState(): CanvasInteractionState {
  return {
    pointerMode: 'idle',
    isWheelInteractionActive: false,
    draftRect: null,
    draftFreehand: null,
    draftConnector: null,
    snapGuides: [],
    hoveredNodeId: null,
    hoveredAnchor: null,
    activeConnectorHandle: null,
    selectionBox: null,
  };
}

export function isActiveInteractionMode(mode: PointerMode): boolean {
  return (
      mode === 'panning' ||
      mode === 'dragging-node' ||
      mode === 'drawing-connector' ||
      mode === 'editing-connector-end' ||
      mode === 'editing-connector-waypoint' ||
      mode === 'resizing-node' ||
      mode === 'marquee-selecting' ||
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
