export interface Viewport {
  tx: number;
  ty: number;
  scale: number;
}

export interface Point {
  x: number;
  y: number;
}

export type AnchorId = 'north' | 'east' | 'south' | 'west';

export interface RotatableBoxNode {
  x: number;
  y: number;
  w: number;
  h: number;
  rotation?: number;
}

export interface RectNode extends RotatableBoxNode {
  id: string;
  type: 'rect';
  stroke: string;
  fill?: string;
}

export interface FreehandNode {
  id: string;
  type: 'freehand';
  points: Point[];
  stroke: string;
  width: number;
}

export interface TextNode extends RotatableBoxNode {
  id: string;
  type: 'text';
  text: string;
  color: string;
  fontSize: number;
  fontFamily: string;
}

export interface ImageNode extends RotatableBoxNode {
  id: string;
  type: 'image';
  assetId: string;
}

export interface VideoNode extends RotatableBoxNode {
  id: string;
  type: 'video';
  assetId: string;
}

export type BoxNode = RectNode | TextNode | ImageNode | VideoNode;
export type GroupChildNode = RectNode | FreehandNode | TextNode | ImageNode | VideoNode;

export interface GroupNode extends RotatableBoxNode {
  id: string;
  type: 'group';
  children: GroupChildNode[];
  name?: string;
}

export interface AttachedConnectorEndpoint {
  kind: 'attached';
  nodeId: string;
  anchor: AnchorId;
}

export interface FreeConnectorEndpoint {
  kind: 'free';
  x: number;
  y: number;
}

export type ConnectorEndpoint = AttachedConnectorEndpoint | FreeConnectorEndpoint;

export type ConnectorPathMode = 'straight' | 'polyline' | 'curve';

export interface ConnectorNode {
  id: string;
  type: 'connector';
  start: ConnectorEndpoint;
  end: ConnectorEndpoint;
  stroke: string;
  width: number;
  pathMode?: ConnectorPathMode;
  waypoints?: Point[];
  curveControl?: Point;
}

export type CanvasNode =
  | RectNode
  | FreehandNode
  | TextNode
  | ImageNode
  | VideoNode
  | ConnectorNode
  | GroupNode;
export type Shape = RectNode | FreehandNode;

export interface BoardDoc {
  version: 2;
  viewport: Viewport;
  nodes: CanvasNode[];
}
