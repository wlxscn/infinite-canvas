import type { CanvasContextPayload } from './canvas-context';
import type { ChatMessage, ChatSuggestion } from './chat';
import type { AgentEffect } from './tool-effects';

export type GenerationMediaType = 'image' | 'video';

export interface AgentChatRequest {
  projectId: string;
  conversationId?: string;
  previousResponseId?: string;
  message: string;
  history?: ChatMessage[];
  canvasContext: CanvasContextPayload;
}

export interface AgentChatResponse {
  conversationId?: string;
  previousResponseId?: string | null;
  assistantMessage: {
    role: 'assistant';
    text: string;
    suggestions: ChatSuggestion[];
  };
  effects: AgentEffect[];
}

export interface CanvasProjectSnapshot {
  version: 2;
  board: unknown;
  assets: unknown[];
  jobs: unknown[];
  chat: {
    activeSessionId: string | null;
    sessions: unknown[];
  };
}

export interface ProjectPersistenceMetadata {
  projectId: string;
  title: string;
  createdAt?: string;
  updatedAt?: string;
  ownerId?: string | null;
}

export interface ProjectSummary extends ProjectPersistenceMetadata {
  lastOpenedAt?: string;
}

export interface ProjectListResponse {
  projects: ProjectSummary[];
}

export interface ProjectLoadResponse extends ProjectPersistenceMetadata {
  project: CanvasProjectSnapshot;
}

export interface ProjectCreateRequest {
  title?: string;
}

export interface ProjectCreateResponse extends ProjectLoadResponse {}

export interface ProjectSaveRequest {
  project: CanvasProjectSnapshot;
}

export interface ProjectSaveResponse extends ProjectPersistenceMetadata {
  project: CanvasProjectSnapshot;
}

export interface ProjectRenameRequest {
  title: string;
}

export interface ProjectRenameResponse extends ProjectSummary {}

export type TranscriptionAudioMimeType =
  | 'audio/m4a'
  | 'audio/mp3'
  | 'audio/mp4'
  | 'audio/mpeg'
  | 'audio/mpga'
  | 'audio/ogg'
  | 'audio/wav'
  | 'audio/webm';

export interface TranscriptionRequest {
  audio: File | Blob;
  language?: string;
}

export interface TranscriptionResponse {
  text: string;
}

export interface ApiErrorResponse {
  error: string;
  code?: string;
}

export interface ImageGenerationRequest {
  prompt: string;
  aspectRatio?: string;
}

export interface ImageGenerationResponse {
  imageUrl: string;
  requestId?: string | null;
  aspectRatio: string;
  width: number;
  height: number;
}

export interface VideoGenerationRequest {
  prompt: string;
  aspectRatio?: string;
  durationSeconds?: number;
  resolution?: string;
}

export interface VideoGenerationResponse {
  videoUrl: string;
  posterUrl?: string | null;
  requestId?: string | null;
  taskId?: string | null;
  fileId?: string | null;
  aspectRatio: string;
  width: number;
  height: number;
  durationSeconds?: number;
  resolution?: string;
  mimeType?: string;
}
