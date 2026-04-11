export type Tool = 'select' | 'rect' | 'freehand' | 'pan';

export interface Viewport {
  tx: number;
  ty: number;
  scale: number;
}

export interface RectShape {
  id: string;
  type: 'rect';
  x: number;
  y: number;
  w: number;
  h: number;
  stroke: string;
  fill?: string;
}

export interface FreehandShape {
  id: string;
  type: 'freehand';
  points: Array<{ x: number; y: number }>;
  stroke: string;
  width: number;
}

export type Shape = RectShape | FreehandShape;

export interface CanvasDoc {
  version: 1;
  viewport: Viewport;
  shapes: Shape[];
}

export interface CanvasStoreState {
  doc: CanvasDoc;
  tool: Tool;
  selectedId: string | null;
  past: CanvasDoc[];
  future: CanvasDoc[];
}

export interface Point {
  x: number;
  y: number;
}
