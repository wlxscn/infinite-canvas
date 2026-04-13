import type { ChatMessage } from '@infinite-canvas/shared/chat';

export type Tool = 'select' | 'rect' | 'freehand' | 'text' | 'pan';

export interface Viewport {
  tx: number;
  ty: number;
  scale: number;
}

export interface Point {
  x: number;
  y: number;
}

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

export type CanvasNode = RectNode | FreehandNode | TextNode | ImageNode;
export type Shape = RectNode | FreehandNode;

export interface BoardDoc {
  version: 2;
  viewport: Viewport;
  nodes: CanvasNode[];
}

export interface AssetRecord {
  id: string;
  type: 'image';
  name: string;
  mimeType: string;
  src: string;
  width: number;
  height: number;
  origin: 'upload' | 'generated';
  createdAt: number;
  sourceJobId?: string;
}

export type GenerationJobStatus = 'pending' | 'success' | 'failed';

export interface GenerationJob {
  id: string;
  prompt: string;
  status: GenerationJobStatus;
  createdAt: number;
  updatedAt: number;
  assetId?: string;
  error?: string;
}

export interface ChatSession {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: ChatMessage[];
  conversationId?: string;
  previousResponseId?: string | null;
}

export interface ChatThreadState {
  activeSessionId: string | null;
  sessions: ChatSession[];
}

export interface CanvasProject {
  version: 2;
  board: BoardDoc;
  assets: AssetRecord[];
  jobs: GenerationJob[];
  chat: ChatThreadState;
}

export interface CanvasStoreState {
  project: CanvasProject;
  tool: Tool;
  selectedId: string | null;
  past: CanvasProject[];
  future: CanvasProject[];
}
