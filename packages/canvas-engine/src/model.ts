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

export interface RectNode {
  id: string;
  type: 'rect';
  x: number;
  y: number;
  w: number;
  h: number;
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

export interface TextNode {
  id: string;
  type: 'text';
  x: number;
  y: number;
  w: number;
  h: number;
  text: string;
  color: string;
  fontSize: number;
  fontFamily: string;
}

export interface ImageNode {
  id: string;
  type: 'image';
  x: number;
  y: number;
  w: number;
  h: number;
  assetId: string;
}

export interface VideoNode {
  id: string;
  type: 'video';
  x: number;
  y: number;
  w: number;
  h: number;
  assetId: string;
}

export type BoxNode = RectNode | TextNode | ImageNode | VideoNode;
export type ContainerChildNode = RectNode | FreehandNode | TextNode | ImageNode | VideoNode;

export interface ContainerNode {
  id: string;
  type: 'container';
  x: number;
  y: number;
  w: number;
  h: number;
  children: ContainerChildNode[];
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

export type ConnectorPathMode = 'straight' | 'polyline';

export interface ConnectorNode {
  id: string;
  type: 'connector';
  start: ConnectorEndpoint;
  end: ConnectorEndpoint;
  stroke: string;
  width: number;
  pathMode?: ConnectorPathMode;
  waypoints?: Point[];
}

export type CanvasNode = RectNode | FreehandNode | TextNode | ImageNode | VideoNode | ConnectorNode | ContainerNode;
export type Shape = RectNode | FreehandNode;

export interface BoardDoc {
  version: 2;
  viewport: Viewport;
  nodes: CanvasNode[];
}
