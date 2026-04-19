import { createLlmGatewayError, LLM_ERROR_CODES } from './errors.mjs';
import { LLM_STREAM_EVENT_TYPES } from './types.mjs';

export function stripThinkTags(text) {
  return text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
}

export function normalizeMessageTextContent(content) {
  if (typeof content === 'string') {
    return stripThinkTags(content);
  }

  if (!Array.isArray(content)) {
    return '';
  }

  return content
    .map((part) => {
      if (typeof part === 'string') {
        return part;
      }

      if (part?.type === 'text' && typeof part.text === 'string') {
        return part.text;
      }

      return '';
    })
    .join('')
    .trim();
}

export function parseToolArguments(rawArguments) {
  if (!rawArguments) {
    return {};
  }

  if (typeof rawArguments === 'object') {
    return rawArguments;
  }

  if (typeof rawArguments !== 'string') {
    throw createLlmGatewayError(
      502,
      LLM_ERROR_CODES.INVALID_TOOL_ARGUMENTS,
      'Provider returned unsupported tool argument format',
      { rawArguments },
    );
  }

  try {
    return JSON.parse(rawArguments);
  } catch (error) {
    throw createLlmGatewayError(
      502,
      LLM_ERROR_CODES.INVALID_TOOL_ARGUMENTS,
      'Provider returned invalid tool arguments',
      {
        rawArguments,
        message: error instanceof Error ? error.message : String(error),
      },
    );
  }
}

export function normalizeToolCalls(toolCalls = []) {
  return toolCalls.map((toolCall, index) => ({
    id: toolCall?.id ?? `tool-call-${index + 1}`,
    name: toolCall?.function?.name ?? 'unknown_tool',
    arguments: parseToolArguments(toolCall?.function?.arguments),
    rawArguments:
      typeof toolCall?.function?.arguments === 'string'
        ? toolCall.function.arguments
        : JSON.stringify(toolCall?.function?.arguments ?? {}),
  }));
}

export function createThinkTagFilter() {
  let buffer = '';
  let insideThink = false;

  return {
    push(chunk) {
      if (typeof chunk !== 'string' || chunk.length === 0) {
        return '';
      }

      buffer += chunk;
      let output = '';

      while (buffer.length > 0) {
        if (insideThink) {
          const closeIndex = buffer.indexOf('</think>');

          if (closeIndex === -1) {
            const safeTrimLength = Math.max(0, buffer.length - '</think>'.length + 1);
            buffer = buffer.slice(safeTrimLength);
            break;
          }

          buffer = buffer.slice(closeIndex + '</think>'.length);
          insideThink = false;
          continue;
        }

        const openIndex = buffer.indexOf('<think>');
        if (openIndex === -1) {
          const safeTextLength = Math.max(0, buffer.length - '<think>'.length + 1);
          output += buffer.slice(0, safeTextLength);
          buffer = buffer.slice(safeTextLength);
          break;
        }

        output += buffer.slice(0, openIndex);
        buffer = buffer.slice(openIndex + '<think>'.length);
        insideThink = true;
      }

      return output;
    },
    flush() {
      if (insideThink) {
        buffer = '';
        return '';
      }

      const output = buffer;
      buffer = '';
      return output;
    },
  };
}

export async function readSseStream({ stream, onData }) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const frames = buffer.split('\n\n');
    buffer = frames.pop() ?? '';

    for (const frame of frames) {
      const lines = frame
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.startsWith('data:'));

      for (const line of lines) {
        const data = line.slice(5).trim();
        if (!data) {
          continue;
        }

        if (data === '[DONE]') {
          return;
        }

        try {
          onData(JSON.parse(data));
        } catch (error) {
          throw createLlmGatewayError(
            502,
            LLM_ERROR_CODES.STREAM_PARSE_FAILED,
            'Provider returned an invalid stream payload',
            {
              preview: data.slice(0, 300),
              message: error instanceof Error ? error.message : String(error),
            },
          );
        }
      }
    }
  }
}

export function emitTextStreamEvents({ text, onEvent }) {
  if (!text) {
    return;
  }

  onEvent?.({ type: LLM_STREAM_EVENT_TYPES.TEXT_START });
  onEvent?.({ type: LLM_STREAM_EVENT_TYPES.TEXT_DELTA, text });
  onEvent?.({ type: LLM_STREAM_EVENT_TYPES.TEXT_END });
  onEvent?.({ type: LLM_STREAM_EVENT_TYPES.DONE });
}

export function normalizeUsage(payload) {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const usage = payload.usage ?? payload?.choices?.[0]?.usage ?? null;
  if (!usage || typeof usage !== 'object') {
    return null;
  }

  return {
    inputTokens: usage.prompt_tokens ?? usage.input_tokens ?? null,
    outputTokens: usage.completion_tokens ?? usage.output_tokens ?? null,
    totalTokens: usage.total_tokens ?? null,
  };
}

export function isAbortError(error) {
  return error instanceof Error && error.name === 'AbortError';
}
