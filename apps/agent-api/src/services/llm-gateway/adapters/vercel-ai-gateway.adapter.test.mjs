import test from 'node:test';
import assert from 'node:assert/strict';
import { createVercelAiGatewayAdapter } from './vercel-ai-gateway.adapter.mjs';
import { LLM_ERROR_CODES, LLM_STREAM_EVENT_TYPES } from '../index.mjs';

function createEnv(overrides = {}) {
  return {
    vercelAiGatewayApiKey: 'gateway-key',
    vercelAiGatewayToken: '',
    vercelAiGatewayBaseUrl: 'https://ai-gateway.invalid/v1',
    vercelAiGatewayModel: 'openai/gpt-5.4',
    ...overrides,
  };
}

test('vercel ai gateway adapter sends completion requests with configured credentials and model', async () => {
  let capturedRequest = null;
  const adapter = createVercelAiGatewayAdapter({
    env: createEnv(),
    fetchImpl: async (url, init) => {
      capturedRequest = {
        url,
        headers: init.headers,
        body: JSON.parse(init.body),
      };

      return Response.json({
        id: 'chatcmpl_1',
        choices: [
          {
            finish_reason: 'stop',
            message: {
              content: '你好',
            },
          },
        ],
        usage: {
          prompt_tokens: 5,
          completion_tokens: 2,
          total_tokens: 7,
        },
      });
    },
  });

  const result = await adapter.complete({
    model: 'openai/gpt-5.4',
    messages: [{ role: 'user', content: 'hello' }],
  });

  assert.equal(capturedRequest.url, 'https://ai-gateway.invalid/v1/chat/completions');
  assert.equal(capturedRequest.headers.Authorization, 'Bearer gateway-key');
  assert.equal(capturedRequest.body.model, 'openai/gpt-5.4');
  assert.equal(capturedRequest.body.stream, false);
  assert.equal(result.provider, 'vercel');
  assert.equal(result.text, '你好');
  assert.deepEqual(result.usage, {
    inputTokens: 5,
    outputTokens: 2,
    totalTokens: 7,
  });
});

test('vercel ai gateway adapter falls back to oidc token credentials', async () => {
  let authorization = '';
  const adapter = createVercelAiGatewayAdapter({
    env: createEnv({
      vercelAiGatewayApiKey: '',
      vercelAiGatewayToken: 'oidc-token',
    }),
    fetchImpl: async (_url, init) => {
      authorization = init.headers.Authorization;
      return Response.json({
        choices: [{ message: { content: 'ok' } }],
      });
    },
  });

  await adapter.complete({
    model: 'openai/gpt-5.4',
    messages: [{ role: 'user', content: 'hello' }],
  });

  assert.equal(authorization, 'Bearer oidc-token');
});

test('vercel ai gateway adapter normalizes tool calls', async () => {
  const adapter = createVercelAiGatewayAdapter({
    env: createEnv(),
    fetchImpl: async () =>
      Response.json({
        id: 'chatcmpl_2',
        choices: [
          {
            finish_reason: 'tool_calls',
            message: {
              role: 'assistant',
              content: '',
              tool_calls: [
                {
                  id: 'call_1',
                  function: {
                    name: 'change_canvas_style',
                    arguments: '{"prompt":"retro","styleDirection":"bold"}',
                  },
                },
              ],
            },
          },
        ],
      }),
  });

  const result = await adapter.callTools({
    model: 'openai/gpt-5.4',
    messages: [{ role: 'user', content: 'restyle' }],
    tools: [],
  });

  assert.equal(result.provider, 'vercel');
  assert.equal(result.finishReason, 'tool_calls');
  assert.deepEqual(result.toolCalls[0], {
    id: 'call_1',
    name: 'change_canvas_style',
    arguments: {
      prompt: 'retro',
      styleDirection: 'bold',
    },
    rawArguments: '{"prompt":"retro","styleDirection":"bold"}',
  });
});

test('vercel ai gateway adapter emits normalized stream events', async () => {
  const encoder = new TextEncoder();
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"你"}}]}\n\n'));
      controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"好"}}]}\n\n'));
      controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      controller.close();
    },
  });
  const events = [];
  const adapter = createVercelAiGatewayAdapter({
    env: createEnv(),
    fetchImpl: async () => new Response(body, { status: 200 }),
  });

  const result = await adapter.stream({
    model: 'openai/gpt-5.4',
    messages: [{ role: 'user', content: 'hello' }],
    onEvent(event) {
      events.push(event);
    },
  });

  assert.equal(result.text, '你好');
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

test('vercel ai gateway adapter rejects missing credentials before fetch', async () => {
  const adapter = createVercelAiGatewayAdapter({
    env: createEnv({
      vercelAiGatewayApiKey: '',
      vercelAiGatewayToken: '',
    }),
    fetchImpl: async () => {
      throw new Error('fetch should not be called');
    },
  });

  await assert.rejects(
    () =>
      adapter.complete({
        model: 'openai/gpt-5.4',
        messages: [{ role: 'user', content: 'hello' }],
      }),
    (error) => {
      assert.equal(error.code, LLM_ERROR_CODES.PROVIDER_NOT_CONFIGURED);
      return true;
    },
  );
});

test('vercel ai gateway adapter maps upstream failures to normalized errors', async () => {
  const cases = [
    [401, LLM_ERROR_CODES.UPSTREAM_AUTH_FAILED],
    [403, LLM_ERROR_CODES.UPSTREAM_AUTH_FAILED],
    [429, LLM_ERROR_CODES.UPSTREAM_RATE_LIMITED],
    [400, LLM_ERROR_CODES.UPSTREAM_INVALID_REQUEST],
    [500, LLM_ERROR_CODES.UPSTREAM_FAILED],
  ];

  for (const [status, code] of cases) {
    const adapter = createVercelAiGatewayAdapter({
      env: createEnv(),
      fetchImpl: async () => Response.json({ error: { message: 'nope' } }, { status }),
    });

    await assert.rejects(
      () =>
        adapter.complete({
          model: 'openai/gpt-5.4',
          messages: [{ role: 'user', content: 'hello' }],
        }),
      (error) => {
        assert.equal(error.code, code);
        return true;
      },
    );
  }
});

test('vercel ai gateway adapter maps aborts to timeout errors', async () => {
  const adapter = createVercelAiGatewayAdapter({
    env: createEnv(),
    fetchImpl: async () => {
      throw new DOMException('aborted', 'AbortError');
    },
  });

  await assert.rejects(
    () =>
      adapter.complete({
        model: 'openai/gpt-5.4',
        messages: [{ role: 'user', content: 'hello' }],
      }),
    (error) => {
      assert.equal(error.code, LLM_ERROR_CODES.UPSTREAM_TIMEOUT);
      return true;
    },
  );
});
