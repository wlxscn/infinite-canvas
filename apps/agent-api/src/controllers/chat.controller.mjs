import { createOpenAiService } from '../services/openai.service.mjs';
import { createConversationService } from '../services/conversation.service.mjs';
import { createToolRunnerService } from '../services/tool-runner.service.mjs';
import { createUIMessageStream, pipeUIMessageStreamToResponse } from 'ai';

function logChat(event, payload = {}) {
  console.log(`[agent-api/chat] ${event}`, payload);
}

export function createChatController({
  openAiService = createOpenAiService(),
  conversationService = createConversationService(),
  toolRunnerService = createToolRunnerService(),
} = {}) {

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
      responseId: conversationState.responseId,
    });
    const textId = `assistant-text-${requestId}`;

    const stream = createUIMessageStream({
      execute: async ({ writer }) => {
        logChat('stream:start', { requestId, textId });

        writer.write({
          type: 'text-start',
          id: textId,
        });

        const prepared = await openAiService.prepareResponse({
          request: body,
          conversationState,
          toolRunnerService,
        });

        logChat('response:prepared', {
          requestId,
          suggestionCount: prepared.suggestions.length,
          effectCount: prepared.effects.length,
        });

        const assistantText = await openAiService.streamPreparedResponse({
          prepared,
          onTextDelta(chunk) {
            if (!chunk) {
              return;
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
          },
        });

        writer.write({
          type: 'text-end',
          id: textId,
        });
        logChat('stream:text-end', { requestId, textId });

        writer.write({
          type: 'data-agentResponse',
          data: {
            suggestions: prepared.suggestions,
            effects: prepared.effects,
            conversationId: prepared.conversationId,
            previousResponseId: prepared.previousResponseId,
          },
        });

        logChat('stream:data-agentResponse', {
          requestId,
          assistantTextLength: assistantText?.length ?? 0,
          conversationId: prepared.conversationId,
          previousResponseId: prepared.previousResponseId,
          suggestionCount: prepared.suggestions.length,
          effectCount: prepared.effects.length,
          durationMs: Date.now() - startedAt,
        });

        const deferredPrompt = prepared.deferredGenerationEffect?.prompt;
        if (!deferredPrompt) {
          return;
        }

        const mediaType = prepared.deferredGenerationEffect?.mediaType ?? 'image';

        logChat('stream:generation:start', {
          requestId,
          mediaType,
          prompt: deferredPrompt,
        });

        const generatedEffect =
          mediaType === 'video'
            ? await toolRunnerService.generateVideoEffect({
                prompt: deferredPrompt,
              })
            : await toolRunnerService.generateImageEffect({
                prompt: deferredPrompt,
              });

        writer.write({
          type: 'data-agentResponse',
          data: {
            suggestions: [],
            effects: [generatedEffect],
            conversationId: prepared.conversationId,
            previousResponseId: prepared.previousResponseId,
          },
        });

        logChat('stream:generation:end', {
          requestId,
          mediaType,
          effectType: generatedEffect.type,
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
