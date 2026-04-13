import type { CanvasContextPayload } from './canvas-context';
import type { ChatMessage, ChatSuggestion } from './chat';
import type { AgentEffect } from './tool-effects';

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

export type AssistantEventType =
  | 'welcome'
  | 'asset-uploaded'
  | 'asset-inserted'
  | 'generation-requested'
  | 'generation-failed'
  | 'generation-succeeded'
  | 'text-inserted';

export interface AssistantEventRequest {
  event: AssistantEventType;
  metadata?: {
    fileName?: string;
    assetName?: string;
    prompt?: string;
  };
}

export interface AssistantEventResponse {
  assistantMessage: {
    role: 'assistant';
    text: string;
    suggestions: ChatSuggestion[];
  };
}
