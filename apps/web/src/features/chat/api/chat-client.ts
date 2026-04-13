import type { AssistantEventRequest, AssistantEventResponse } from '@infinite-canvas/shared/api';

export function getAgentChatApiUrl(): string {
  return import.meta.env.VITE_AGENT_API_URL ?? 'http://127.0.0.1:8787/chat';
}

export function getAssistantMessageApiUrl(): string {
  return getAgentChatApiUrl().replace(/\/chat$/, '/assistant-message');
}

export async function fetchAssistantEventMessage(request: AssistantEventRequest): Promise<AssistantEventResponse> {
  const response = await fetch(getAssistantMessageApiUrl(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(`Failed to load assistant message: ${response.status}`);
  }

  return response.json();
}
