import test from 'node:test';
import assert from 'node:assert/strict';
import { createLlmGateway, LLM_ERROR_CODES } from './index.mjs';

function createEnv() {
  return {
    llmDefaultTextProvider: 'minimax',
    llmDefaultStreamProvider: 'minimax',
    llmDefaultToolProvider: 'minimax',
    llmDefaultTranscriptionProvider: 'openai',
    vercelAiGatewayApiKey: 'gateway-key',
    vercelAiGatewayToken: '',
    vercelAiGatewayBaseUrl: 'https://ai-gateway.invalid/v1',
    vercelAiGatewayModel: 'openai/gpt-5.4',
  };
}

test('llm gateway routes to capability defaults and provider default models', async () => {
  const calls = [];
  const gateway = createLlmGateway({
    env: createEnv(),
    providerRegistry: {
      minimax: {
        adapter: {
          async complete(request) {
            calls.push(['complete', request.provider, request.model]);
            return { provider: request.provider, model: request.model, text: 'hello' };
          },
          async stream(request) {
            calls.push(['stream', request.provider, request.model]);
            return { provider: request.provider, model: request.model, text: 'hello' };
          },
          async callTools(request) {
            calls.push(['callTools', request.provider, request.model]);
            return { provider: request.provider, model: request.model, toolCalls: [] };
          },
        },
        capabilities: {
          complete: true,
          stream: true,
          callTools: true,
          transcribe: false,
        },
        defaultModels: {
          complete: 'minimax-text',
          stream: 'minimax-stream',
          callTools: 'minimax-tools',
        },
      },
      openai: {
        adapter: {
          async transcribe(request) {
            calls.push(['transcribe', request.provider, request.model]);
            return { provider: request.provider, model: request.model, text: '你好' };
          },
        },
        capabilities: {
          complete: true,
          stream: true,
          callTools: true,
          transcribe: true,
        },
        defaultModels: {
          transcribe: 'gpt-4o-mini-transcribe',
        },
      },
    },
  });

  await gateway.complete({ messages: [] });
  await gateway.stream({ messages: [] });
  await gateway.callTools({ messages: [], tools: [] });
  await gateway.transcribe({ audioBuffer: Buffer.from('a'), mimeType: 'audio/webm', fileName: 'a.webm' });

  assert.deepEqual(calls, [
    ['complete', 'minimax', 'minimax-text'],
    ['stream', 'minimax', 'minimax-stream'],
    ['callTools', 'minimax', 'minimax-tools'],
    ['transcribe', 'openai', 'gpt-4o-mini-transcribe'],
  ]);
});

test('llm gateway fails fast for unsupported capability', async () => {
  const gateway = createLlmGateway({
    env: createEnv(),
    providerRegistry: {
      minimax: {
        adapter: {},
        capabilities: {
          complete: true,
          stream: true,
          callTools: true,
          transcribe: false,
        },
        defaultModels: {
          complete: 'minimax-text',
        },
      },
    },
  });

  await assert.rejects(
    () => gateway.transcribe({ provider: 'minimax', audioBuffer: Buffer.from('a'), mimeType: 'audio/webm', fileName: 'a.webm' }),
    (error) => {
      assert.equal(error.code, LLM_ERROR_CODES.CAPABILITY_UNSUPPORTED);
      return true;
    },
  );
});

test('llm gateway routes to vercel provider defaults from registry', async () => {
  let capturedRequest = null;
  const gateway = createLlmGateway({
    env: {
      ...createEnv(),
      llmDefaultTextProvider: 'vercel',
      llmDefaultStreamProvider: 'vercel',
      llmDefaultToolProvider: 'vercel',
    },
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
              content: 'hello',
            },
          },
        ],
      });
    },
  });

  const capabilities = gateway.getProviderCapabilities();
  assert.equal(capabilities.vercel.capabilities.complete, true);
  assert.equal(capabilities.vercel.capabilities.stream, true);
  assert.equal(capabilities.vercel.capabilities.callTools, true);
  assert.equal(capabilities.vercel.capabilities.transcribe, false);

  const result = await gateway.complete({ messages: [{ role: 'user', content: 'hello' }] });

  assert.equal(result.provider, 'vercel');
  assert.equal(result.model, 'openai/gpt-5.4');
  assert.equal(capturedRequest.url, 'https://ai-gateway.invalid/v1/chat/completions');
  assert.equal(capturedRequest.headers.Authorization, 'Bearer gateway-key');
  assert.equal(capturedRequest.body.model, 'openai/gpt-5.4');
});
