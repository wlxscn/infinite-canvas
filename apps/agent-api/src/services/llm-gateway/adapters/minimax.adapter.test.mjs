import test from 'node:test';
import assert from 'node:assert/strict';
import { createMiniMaxAdapter } from './minimax.adapter.mjs';
import { LLM_ERROR_CODES, LLM_STREAM_EVENT_TYPES } from '../index.mjs';

function createEnv() {
  return {
    minimaxApiKey: 'minimax-key',
    minimaxBaseUrl: 'https://minimax.invalid/v1',
    minimaxModel: 'MiniMax-M2.7',
  };
}

test('minimax adapter normalizes tool calls', async () => {
  const adapter = createMiniMaxAdapter({
    env: createEnv(),
    fetchImpl: async () =>
      Response.json({
        id: 'resp_1',
        choices: [
          {
            finish_reason: 'tool_calls',
            message: {
              role: 'assistant',
              content: 'tool',
              tool_calls: [
                {
                  id: 'call_1',
                  function: {
                    name: 'add_text_to_canvas',
                    arguments: '{"text":"Hello"}',
                  },
                },
              ],
            },
          },
        ],
      }),
  });

  const result = await adapter.callTools({
    model: 'MiniMax-M2.7',
    messages: [{ role: 'user', content: 'add text' }],
    tools: [],
  });

  assert.equal(result.toolCalls.length, 1);
  assert.deepEqual(result.toolCalls[0], {
    id: 'call_1',
    name: 'add_text_to_canvas',
    arguments: { text: 'Hello' },
    rawArguments: '{"text":"Hello"}',
  });
});

test('minimax adapter rejects malformed tool arguments', async () => {
  const adapter = createMiniMaxAdapter({
    env: createEnv(),
    fetchImpl: async () =>
      Response.json({
        choices: [
          {
            finish_reason: 'tool_calls',
            message: {
              tool_calls: [
                {
                  id: 'call_1',
                  function: {
                    name: 'add_text_to_canvas',
                    arguments: '{"text":',
                  },
                },
              ],
            },
          },
        ],
      }),
  });

  await assert.rejects(
    () =>
      adapter.callTools({
        model: 'MiniMax-M2.7',
        messages: [{ role: 'user', content: 'add text' }],
        tools: [],
      }),
    (error) => {
      assert.equal(error.code, LLM_ERROR_CODES.INVALID_TOOL_ARGUMENTS);
      return true;
    },
  );
});

test('minimax adapter emits normalized stream events', async () => {
  const encoder = new TextEncoder();
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"你好"}}]}\n\n'));
      controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"<think>skip</think>世界"}}]}\n\n'));
      controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      controller.close();
    },
  });

  const events = [];
  const adapter = createMiniMaxAdapter({
    env: createEnv(),
    fetchImpl: async () => new Response(body, { status: 200 }),
  });

  const result = await adapter.stream({
    model: 'MiniMax-M2.7',
    messages: [{ role: 'user', content: 'hello' }],
    onEvent(event) {
      events.push(event);
    },
  });

  assert.equal(result.text, '你好世界');
  assert.deepEqual(
    events.map((event) => event.type),
    [
      LLM_STREAM_EVENT_TYPES.TEXT_START,
      LLM_STREAM_EVENT_TYPES.TEXT_DELTA,
      LLM_STREAM_EVENT_TYPES.TEXT_DELTA,
      LLM_STREAM_EVENT_TYPES.TEXT_END,
      LLM_STREAM_EVENT_TYPES.DONE,
    ],
  );
});
