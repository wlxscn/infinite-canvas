import type { AgentChatRequest, AgentChatResponse } from '@infinite-canvas/shared/api';
import type { ChatMessage, ChatSuggestion } from '@infinite-canvas/shared/chat';
import type { AgentEffect } from '@infinite-canvas/shared/tool-effects';
import type { UIMessage } from 'ai';
import { createId } from '../../../utils/id';

export interface AgentResponseData {
  suggestions: ChatSuggestion[];
  effects: AgentEffect[];
  conversationId?: string;
  previousResponseId?: string | null;
}

export type AgentUIData = {
  agentResponse: AgentResponseData;
};

export type AgentUIMessage = UIMessage<unknown, AgentUIData>;

export function toUIMessage(message: ChatMessage): AgentUIMessage {
  return {
    id: message.id,
    role: message.role,
    parts: [{ type: 'text', text: message.text }],
  };
}

export function toLocalChatMessage(message: AgentUIMessage): ChatMessage {
  const text = message.parts
    .filter((part): part is Extract<AgentUIMessage['parts'][number], { type: 'text' }> => part.type === 'text')
    .map((part) => part.text)
    .join('')
    .trim();

  const responseData = extractAgentResponseData(message);

  return {
    id: message.id || createId('message'),
    role: message.role === 'assistant' ? 'assistant' : 'user',
    text,
    createdAt: Date.now(),
    suggestions: responseData?.suggestions ?? [],
  };
}

export function extractAgentResponseData(message: AgentUIMessage): AgentResponseData | null {
  const dataParts = message.parts.filter(
    (part): part is Extract<AgentUIMessage['parts'][number], { type: 'data-agentResponse' }> => part.type === 'data-agentResponse',
  );

  if (dataParts.length === 0) {
    return null;
  }

  return dataParts.reduce<AgentResponseData>(
    (merged, part) => ({
      suggestions: [...merged.suggestions, ...(part.data?.suggestions ?? [])],
      effects: [...merged.effects, ...(part.data?.effects ?? [])],
      conversationId: part.data?.conversationId ?? merged.conversationId,
      previousResponseId: part.data?.previousResponseId ?? merged.previousResponseId,
    }),
    {
      suggestions: [],
      effects: [],
      conversationId: undefined,
      previousResponseId: undefined,
    },
  );
}

export function buildAgentRequestBody(request: AgentChatRequest) {
  return request;
}

export function readAgentResponse(response: AgentChatResponse): AgentResponseData {
  return {
    suggestions: response.assistantMessage.suggestions,
    effects: response.effects,
    conversationId: response.conversationId,
    previousResponseId: response.previousResponseId,
  };
}
