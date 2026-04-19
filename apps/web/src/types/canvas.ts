import type { ChatMessage } from '@infinite-canvas/shared/chat';
import type { GenerationMediaType } from '@infinite-canvas/shared/api';
import type { BoardDoc } from '@infinite-canvas/canvas-engine';
export type {
  AnchorId,
  AttachedConnectorEndpoint,
  BoardDoc,
  BoxNode,
  CanvasNode,
  GroupChildNode,
  GroupNode,
  ConnectorEndpoint,
  ConnectorNode,
  ConnectorPathMode,
  FreeConnectorEndpoint,
  FreehandNode,
  ImageNode,
  Point,
  RectNode,
  Shape,
  TextNode,
  VideoNode,
  Viewport,
} from '@infinite-canvas/canvas-engine';

export type Tool = 'select' | 'rect' | 'freehand' | 'text' | 'connector' | 'pan';

export interface AssetRecord {
  id: string;
  type: GenerationMediaType;
  name: string;
  mimeType: string;
  src: string;
  width: number;
  height: number;
  posterSrc?: string | null;
  durationSeconds?: number;
  origin: 'upload' | 'generated';
  createdAt: number;
  sourceJobId?: string;
}

export type GenerationJobStatus = 'pending' | 'success' | 'failed';

export interface GenerationJob {
  id: string;
  prompt: string;
  mediaType?: GenerationMediaType;
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
  selectedIds: string[];
  activeGroupId: string | null;
  past: CanvasProject[];
  future: CanvasProject[];
}
