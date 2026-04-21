import { createLlmGatewayError, LLM_ERROR_CODES } from '../errors.mjs';
import { LLM_STREAM_EVENT_TYPES } from '../types.mjs';
import {
  createThinkTagFilter,
  isAbortError,
  normalizeMessageTextContent,
  normalizeToolCalls,
  normalizeUsage,
  readSseStream,
} from '../utils.mjs';

const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504, 529]);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getRetryDelay(attempt) {
  const baseDelay = 400 * 2 ** attempt;
  const jitter = Math.floor(Math.random() * 200);
  return baseDelay + jitter;
}

function summarizeMessages(messages) {
  return messages.map((message) => ({
    role: message.role,
    hasToolCalls: Array.isArray(message.tool_calls) && message.tool_calls.length > 0,
    content: message.content,
  }));
}

function getContentDelta(chunkPayload) {
  return chunkPayload?.choices?.[0]?.delta?.content ?? '';
}

export function createMiniMaxAdapter({ env, fetchImpl = globalThis.fetch }) {
  async function requestChatCompletion({ model, messages, tools, temperature = 1, retries = 0 }) {
    if (!env.minimaxApiKey) {
      throw createLlmGatewayError(500, LLM_ERROR_CODES.PROVIDER_NOT_CONFIGURED, 'MINIMAX_API_KEY is not configured');
    }

    for (let attempt = 0; attempt <= retries; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15_000);
      const requestPayload = {
        model,
        messages,
        temperature,
        stream: false,
        ...(tools?.length ? { tools } : {}),
      };

      console.log('[agent-api/llm/minimax] completion:start', {
        attempt: attempt + 1,
        url: `${env.minimaxBaseUrl}/chat/completions`,
        model,
        temperature,
        toolCount: tools?.length ?? 0,
        messages: summarizeMessages(messages),
        requestPayload,
      });

      try {
        const response = await fetchImpl(`${env.minimaxBaseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${env.minimaxApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestPayload),
          signal: controller.signal,
        });

        if (response.ok) {
          const data = await response.json();
          console.log('[agent-api/llm/minimax] completion:response', {
            attempt: attempt + 1,
            status: response.status,
            body: data,
          });

          return data;
        }

        const body = await response.text();
        console.warn('[agent-api/llm/minimax] completion:error-response', {
          attempt: attempt + 1,
          status: response.status,
          body,
        });
        if (RETRYABLE_STATUS_CODES.has(response.status) && attempt < retries) {
          await sleep(getRetryDelay(attempt));
          continue;
        }

        if (response.status === 401 || response.status === 403) {
          throw createLlmGatewayError(502, LLM_ERROR_CODES.UPSTREAM_AUTH_FAILED, 'MiniMax authentication failed', { body });
        }

        if (response.status === 400) {
          throw createLlmGatewayError(502, LLM_ERROR_CODES.UPSTREAM_INVALID_REQUEST, 'MiniMax rejected the request', {
            body,
          });
        }

        if (response.status === 429) {
          throw createLlmGatewayError(502, LLM_ERROR_CODES.UPSTREAM_RATE_LIMITED, 'MiniMax rate limited the request', {
            body,
          });
        }

        throw createLlmGatewayError(502, LLM_ERROR_CODES.UPSTREAM_FAILED, 'MiniMax request failed', { body });
      } catch (error) {
        if (isAbortError(error)) {
          throw createLlmGatewayError(504, LLM_ERROR_CODES.UPSTREAM_TIMEOUT, 'MiniMax request timed out');
        }

        if (error instanceof Error && error.name === 'LlmGatewayError') {
          throw error;
        }

        if (attempt < retries) {
          await sleep(getRetryDelay(attempt));
          continue;
        }

        throw createLlmGatewayError(502, LLM_ERROR_CODES.UPSTREAM_FAILED, 'MiniMax request failed', {
          message: error instanceof Error ? error.message : String(error),
        });
      } finally {
        clearTimeout(timeout);
      }
    }

    throw createLlmGatewayError(502, LLM_ERROR_CODES.UPSTREAM_FAILED, 'MiniMax request failed');
  }

  return {
    provider: 'minimax',
    async complete({ model, messages, temperature = 1, fallbackText = '' }) {
      const payload = await requestChatCompletion({
        model,
        messages,
        temperature,
      });

      const text = normalizeMessageTextContent(payload?.choices?.[0]?.message?.content) || fallbackText;

      return {
        provider: 'minimax',
        model,
        text,
        finishReason: payload?.choices?.[0]?.finish_reason ?? null,
        usage: normalizeUsage(payload),
        providerResponseId: payload?.id ?? null,
        raw: payload,
      };
    },
    async callTools({ model, messages, tools, temperature = 0.1 }) {
      const payload = await requestChatCompletion({
        model,
        messages,
        temperature,
        tools,
      });

      const choice = payload?.choices?.[0] ?? null;
      const message = choice?.message ?? {};

      return {
        provider: 'minimax',
        model,
        assistantText: normalizeMessageTextContent(message.content),
        toolCalls: normalizeToolCalls(message.tool_calls ?? []),
        finishReason: choice?.finish_reason ?? null,
        usage: normalizeUsage(payload),
        providerResponseId: payload?.id ?? null,
        raw: payload,
      };
    },
    async stream({ model, messages, temperature = 1, fallbackText = '', onEvent }) {
      if (!env.minimaxApiKey) {
        if (fallbackText) {
          onEvent?.({ type: LLM_STREAM_EVENT_TYPES.TEXT_START });
          onEvent?.({ type: LLM_STREAM_EVENT_TYPES.TEXT_DELTA, text: fallbackText });
          onEvent?.({ type: LLM_STREAM_EVENT_TYPES.TEXT_END });
          onEvent?.({ type: LLM_STREAM_EVENT_TYPES.DONE });
        }

        return {
          provider: 'minimax',
          model,
          text: fallbackText,
          finishReason: 'fallback',
          usage: null,
          providerResponseId: null,
        };
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 60_000);
      const requestPayload = {
        model,
        messages,
        temperature,
        stream: true,
      };

      console.log('[agent-api/llm/minimax] stream:start', {
        url: `${env.minimaxBaseUrl}/chat/completions`,
        model,
        temperature,
        messages: summarizeMessages(messages),
        requestPayload,
      });

      try {
        const response = await fetchImpl(`${env.minimaxBaseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${env.minimaxApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestPayload),
          signal: controller.signal,
        });

        if (!response.ok || !response.body) {
          const body = await response.text();
          console.warn('[agent-api/llm/minimax] stream:error-response', {
            status: response.status,
            body,
          });
          if (fallbackText) {
            onEvent?.({ type: LLM_STREAM_EVENT_TYPES.TEXT_START });
            onEvent?.({ type: LLM_STREAM_EVENT_TYPES.TEXT_DELTA, text: fallbackText });
            onEvent?.({ type: LLM_STREAM_EVENT_TYPES.TEXT_END });
            onEvent?.({ type: LLM_STREAM_EVENT_TYPES.DONE });
          }

          throw createLlmGatewayError(502, LLM_ERROR_CODES.UPSTREAM_FAILED, 'MiniMax stream request failed', { body });
        }

        let emittedText = '';
        const thinkTagFilter = createThinkTagFilter();
        onEvent?.({ type: LLM_STREAM_EVENT_TYPES.TEXT_START });

        await readSseStream({
          stream: response.body,
          onData(chunkPayload) {
            const chunkText = getContentDelta(chunkPayload);
            if (!chunkText) {
              return;
            }

            const nextDelta = thinkTagFilter.push(chunkText);
            if (!nextDelta) {
              return;
            }

            emittedText += nextDelta;
            onEvent?.({ type: LLM_STREAM_EVENT_TYPES.TEXT_DELTA, text: nextDelta });
          },
        });

        const finalDelta = thinkTagFilter.flush();
        if (finalDelta) {
          emittedText += finalDelta;
          onEvent?.({ type: LLM_STREAM_EVENT_TYPES.TEXT_DELTA, text: finalDelta });
        }

        const finalText = emittedText || fallbackText;
        if (!emittedText && fallbackText) {
          onEvent?.({ type: LLM_STREAM_EVENT_TYPES.TEXT_DELTA, text: fallbackText });
        }

        console.log('[agent-api/llm/minimax] stream:response', {
          status: response.status,
          text: finalText,
        });

        onEvent?.({ type: LLM_STREAM_EVENT_TYPES.TEXT_END });
        onEvent?.({ type: LLM_STREAM_EVENT_TYPES.DONE });

        return {
          provider: 'minimax',
          model,
          text: finalText,
          finishReason: emittedText ? 'stop' : 'fallback',
          usage: null,
          providerResponseId: null,
        };
      } catch (error) {
        if (isAbortError(error)) {
          throw createLlmGatewayError(504, LLM_ERROR_CODES.UPSTREAM_TIMEOUT, 'MiniMax stream timed out');
        }

        if (error instanceof Error && error.name === 'LlmGatewayError') {
          throw error;
        }

        throw createLlmGatewayError(502, LLM_ERROR_CODES.UPSTREAM_FAILED, 'MiniMax stream failed', {
          message: error instanceof Error ? error.message : String(error),
        });
      } finally {
        clearTimeout(timeout);
      }
    },
    async transcribe() {
      throw createLlmGatewayError(
        400,
        LLM_ERROR_CODES.CAPABILITY_UNSUPPORTED,
        'MiniMax transcription is not supported by this gateway',
      );
    },
  };
}
