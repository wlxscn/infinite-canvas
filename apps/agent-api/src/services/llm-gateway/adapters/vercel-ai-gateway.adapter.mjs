import { createLlmGatewayError, LLM_ERROR_CODES } from '../errors.mjs';
import { LLM_STREAM_EVENT_TYPES } from '../types.mjs';
import { isAbortError, normalizeMessageTextContent, normalizeToolCalls, normalizeUsage, readSseStream } from '../utils.mjs';

function getDeltaText(chunkPayload) {
  return chunkPayload?.choices?.[0]?.delta?.content ?? '';
}

function resolveAuthToken(env) {
  return env.vercelAiGatewayApiKey || env.vercelAiGatewayToken || '';
}

async function readErrorDetail(response) {
  try {
    const errorPayload = await response.json();
    return errorPayload?.error?.message ?? errorPayload?.message ?? '';
  } catch {
    return await response.text();
  }
}

function mapErrorResponse(response, detail) {
  if (response.status === 401 || response.status === 403) {
    return createLlmGatewayError(502, LLM_ERROR_CODES.UPSTREAM_AUTH_FAILED, 'Vercel AI Gateway authentication failed', {
      detail,
    });
  }

  if (response.status === 429) {
    return createLlmGatewayError(502, LLM_ERROR_CODES.UPSTREAM_RATE_LIMITED, 'Vercel AI Gateway rate limited the request', {
      detail,
    });
  }

  if (response.status === 400) {
    return createLlmGatewayError(502, LLM_ERROR_CODES.UPSTREAM_INVALID_REQUEST, 'Vercel AI Gateway rejected the request', {
      detail,
    });
  }

  return createLlmGatewayError(502, LLM_ERROR_CODES.UPSTREAM_FAILED, 'Vercel AI Gateway request failed', { detail });
}

export function createVercelAiGatewayAdapter({ env, fetchImpl = globalThis.fetch }) {
  async function requestChatCompletion({ model, messages, tools, temperature = 1, stream = false }) {
    const authToken = resolveAuthToken(env);
    if (!authToken) {
      throw createLlmGatewayError(
        500,
        LLM_ERROR_CODES.PROVIDER_NOT_CONFIGURED,
        'AI_GATEWAY_API_KEY or VERCEL_OIDC_TOKEN is not configured',
      );
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), stream ? 60_000 : 15_000);

    try {
      const response = await fetchImpl(`${env.vercelAiGatewayBaseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages,
          temperature,
          stream,
          ...(tools?.length ? { tools } : {}),
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const detail = await readErrorDetail(response);
        throw mapErrorResponse(response, detail);
      }

      return response;
    } catch (error) {
      if (isAbortError(error)) {
        throw createLlmGatewayError(504, LLM_ERROR_CODES.UPSTREAM_TIMEOUT, 'Vercel AI Gateway request timed out');
      }

      if (error instanceof Error && error.name === 'LlmGatewayError') {
        throw error;
      }

      throw createLlmGatewayError(502, LLM_ERROR_CODES.UPSTREAM_FAILED, 'Vercel AI Gateway request failed', {
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  return {
    provider: 'vercel',
    async complete({ model, messages, temperature = 1, fallbackText = '' }) {
      const response = await requestChatCompletion({
        model,
        messages,
        temperature,
        stream: false,
      });
      const payload = await response.json();

      return {
        provider: 'vercel',
        model,
        text: normalizeMessageTextContent(payload?.choices?.[0]?.message?.content) || fallbackText,
        finishReason: payload?.choices?.[0]?.finish_reason ?? null,
        usage: normalizeUsage(payload),
        providerResponseId: payload?.id ?? null,
        raw: payload,
      };
    },
    async callTools({ model, messages, tools, temperature = 0.1 }) {
      const response = await requestChatCompletion({
        model,
        messages,
        tools,
        temperature,
        stream: false,
      });
      const payload = await response.json();
      const choice = payload?.choices?.[0] ?? null;
      const message = choice?.message ?? {};

      return {
        provider: 'vercel',
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
      const response = await requestChatCompletion({
        model,
        messages,
        temperature,
        stream: true,
      });

      if (!response.body) {
        throw createLlmGatewayError(502, LLM_ERROR_CODES.UPSTREAM_FAILED, 'Vercel AI Gateway stream response missing body');
      }

      let emittedText = '';
      onEvent?.({ type: LLM_STREAM_EVENT_TYPES.TEXT_START });

      await readSseStream({
        stream: response.body,
        onData(chunkPayload) {
          const deltaText = getDeltaText(chunkPayload);
          if (!deltaText) {
            return;
          }

          emittedText += deltaText;
          onEvent?.({ type: LLM_STREAM_EVENT_TYPES.TEXT_DELTA, text: deltaText });
        },
      });

      const finalText = emittedText || fallbackText;
      if (!emittedText && fallbackText) {
        onEvent?.({ type: LLM_STREAM_EVENT_TYPES.TEXT_DELTA, text: fallbackText });
      }

      onEvent?.({ type: LLM_STREAM_EVENT_TYPES.TEXT_END });
      onEvent?.({ type: LLM_STREAM_EVENT_TYPES.DONE });

      return {
        provider: 'vercel',
        model,
        text: finalText,
        finishReason: emittedText ? 'stop' : 'fallback',
        usage: null,
        providerResponseId: null,
      };
    },
  };
}
