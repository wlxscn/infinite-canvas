import test from 'node:test';
import assert from 'node:assert/strict';
import { createLlmGateway, LLM_ERROR_CODES } from './index.mjs';

function createEnv() {
  return {
    llmDefaultTextProvider: 'minimax',
    llmDefaultStreamProvider: 'minimax',
    llmDefaultToolProvider: 'minimax',
    llmDefaultTranscriptionProvider: 'openai',
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
