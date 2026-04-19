import { createLlmGatewayError, LLM_ERROR_CODES } from '../errors.mjs';
import { LLM_STREAM_EVENT_TYPES } from '../types.mjs';
import { isAbortError, normalizeMessageTextContent, normalizeToolCalls, normalizeUsage, readSseStream } from '../utils.mjs';

function getDeltaText(chunkPayload) {
  return chunkPayload?.choices?.[0]?.delta?.content ?? '';
}

export function createOpenAiAdapter({ env, fetchImpl = globalThis.fetch }) {
  async function requestChatCompletion({ model, messages, tools, temperature = 1, stream = false }) {
    if (!env.openAiApiKey) {
      throw createLlmGatewayError(500, LLM_ERROR_CODES.PROVIDER_NOT_CONFIGURED, 'OPENAI_API_KEY is not configured');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), stream ? 60_000 : 15_000);

    try {
      const response = await fetchImpl(`${env.openAiBaseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.openAiApiKey}`,
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
        let detail = '';

        try {
          const errorPayload = await response.json();
          detail = errorPayload?.error?.message ?? errorPayload?.message ?? '';
        } catch {
          detail = await response.text();
        }

        if (response.status === 401 || response.status === 403) {
          throw createLlmGatewayError(502, LLM_ERROR_CODES.UPSTREAM_AUTH_FAILED, 'OpenAI authentication failed', {
            detail,
          });
        }

        if (response.status === 429) {
          throw createLlmGatewayError(502, LLM_ERROR_CODES.UPSTREAM_RATE_LIMITED, 'OpenAI rate limited the request', {
            detail,
          });
        }

        if (response.status === 400) {
          throw createLlmGatewayError(502, LLM_ERROR_CODES.UPSTREAM_INVALID_REQUEST, 'OpenAI rejected the request', {
            detail,
          });
        }

        throw createLlmGatewayError(502, LLM_ERROR_CODES.UPSTREAM_FAILED, 'OpenAI request failed', { detail });
      }

      return response;
    } catch (error) {
      if (isAbortError(error)) {
        throw createLlmGatewayError(504, LLM_ERROR_CODES.UPSTREAM_TIMEOUT, 'OpenAI request timed out');
      }

      if (error instanceof Error && error.name === 'LlmGatewayError') {
        throw error;
      }

      throw createLlmGatewayError(502, LLM_ERROR_CODES.UPSTREAM_FAILED, 'OpenAI request failed', {
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  return {
    provider: 'openai',
    async complete({ model, messages, temperature = 1, fallbackText = '' }) {
      const response = await requestChatCompletion({
        model,
        messages,
        temperature,
        stream: false,
      });
      const payload = await response.json();

      return {
        provider: 'openai',
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
        provider: 'openai',
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
        throw createLlmGatewayError(502, LLM_ERROR_CODES.UPSTREAM_FAILED, 'OpenAI stream response missing body');
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
        provider: 'openai',
        model,
        text: finalText,
        finishReason: emittedText ? 'stop' : 'fallback',
        usage: null,
        providerResponseId: null,
      };
    },
    async transcribe({ model, audioBuffer, mimeType, fileName, language }) {
      if (!env.openAiApiKey) {
        throw createLlmGatewayError(500, LLM_ERROR_CODES.PROVIDER_NOT_CONFIGURED, 'OPENAI_API_KEY is not configured');
      }

      const upstreamBody = new FormData();
      upstreamBody.set('model', model);
      upstreamBody.set('file', new File([audioBuffer], fileName, { type: mimeType }));

      if (typeof language === 'string' && language.trim()) {
        upstreamBody.set('language', language.trim());
      }

      let response;
      try {
        response = await fetchImpl(`${env.openAiBaseUrl}/audio/transcriptions`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${env.openAiApiKey}`,
          },
          body: upstreamBody,
          signal: AbortSignal.timeout(env.transcriptionTimeoutMs),
        });
      } catch (error) {
        if (isAbortError(error)) {
          throw createLlmGatewayError(504, LLM_ERROR_CODES.UPSTREAM_TIMEOUT, 'OpenAI transcription timed out');
        }

        throw createLlmGatewayError(502, LLM_ERROR_CODES.UPSTREAM_FAILED, 'OpenAI transcription request failed', {
          message: error instanceof Error ? error.message : String(error),
        });
      }

      if (!response.ok) {
        let detail = '';

        try {
          const payload = await response.json();
          detail = payload?.error?.message ?? payload?.message ?? '';
        } catch {
          detail = await response.text();
        }

        throw createLlmGatewayError(502, LLM_ERROR_CODES.UPSTREAM_FAILED, `OpenAI transcription failed${detail ? `: ${detail}` : ''}`);
      }

      let payload;
      try {
        payload = await response.json();
      } catch {
        throw createLlmGatewayError(
          502,
          LLM_ERROR_CODES.INVALID_TRANSCRIPTION_RESPONSE,
          'OpenAI transcription returned invalid JSON',
        );
      }

      const text = typeof payload?.text === 'string' ? payload.text.trim() : '';
      if (!text) {
        throw createLlmGatewayError(
          502,
          LLM_ERROR_CODES.INVALID_TRANSCRIPTION_RESPONSE,
          'OpenAI transcription returned no text',
        );
      }

      return {
        provider: 'openai',
        model,
        text,
        providerResponseId: payload?.id ?? null,
        raw: payload,
      };
    },
  };
}
