import { createOpenAiService } from '../services/openai.service.mjs';
import { createConversationService } from '../services/conversation.service.mjs';
import { createToolRunnerService } from '../services/tool-runner.service.mjs';
import { createUIMessageStream, pipeUIMessageStreamToResponse } from 'ai';

function logChat(event, payload = {}) {
  console.log(`[agent-api/chat] ${event}`, payload);
}

export function createChatController() {
  const openAiService = createOpenAiService();
  const conversationService = createConversationService();
  const toolRunnerService = createToolRunnerService();

  return async function chatController(request, response) {
    const startedAt = Date.now();
    const chunks = [];

    for await (const chunk of request) {
      chunks.push(chunk);
    }

    const raw = Buffer.concat(chunks).toString('utf8');
    const body = raw ? JSON.parse(raw) : {};
    const requestId = body.previousResponseId ?? body.conversationId ?? `req_${startedAt}`;

    logChat('request:received', {
      requestId,
      message: body.message,
      origin: request.headers.origin,
      hasHistory: Array.isArray(body.history),
      historyCount: Array.isArray(body.history) ? body.history.length : 0,
    });

    const conversationState = conversationService.prepare(body);
    logChat('conversation:prepared', {
      requestId,
      conversationId: conversationState.conversationId,
      previousResponseId: conversationState.previousResponseId,
    });

    const result = await openAiService.respond({
      request: body,
      conversationState,
      toolRunnerService,
    });

    logChat('response:ready', {
      requestId,
      assistantTextLength: result.assistantMessage.text.length,
      suggestionCount: result.assistantMessage.suggestions.length,
      effectCount: result.effects.length,
    });

    const stream = createUIMessageStream({
      execute: async ({ writer }) => {
        const textId = `assistant-text-${conversationState.previousResponseId ?? conversationState.conversationId}`;
        logChat('stream:start', { requestId, textId });

        writer.write({
          type: 'text-start',
          id: textId,
        });

        for (const chunk of result.assistantMessage.text.split(/(?<=[,.!?\n。！？])/)) {
          if (!chunk) {
            continue;
          }

          logChat('stream:text-delta', {
            requestId,
            textId,
            deltaLength: chunk.length,
            preview: chunk.slice(0, 48),
          });

          writer.write({
            type: 'text-delta',
            id: textId,
            delta: chunk,
          });
        }

        writer.write({
          type: 'text-end',
          id: textId,
        });
        logChat('stream:text-end', { requestId, textId });

        writer.write({
          type: 'data-agentResponse',
          data: {
            suggestions: result.assistantMessage.suggestions,
            effects: result.effects,
            conversationId: result.conversationId,
            previousResponseId: result.previousResponseId,
          },
        });

        logChat('stream:data-agentResponse', {
          requestId,
          conversationId: result.conversationId,
          previousResponseId: result.previousResponseId,
          suggestionCount: result.assistantMessage.suggestions.length,
          effectCount: result.effects.length,
          durationMs: Date.now() - startedAt,
        });
      },
    });

    pipeUIMessageStreamToResponse({
      response,
      stream,
    });
  };
}
