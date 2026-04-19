import test from 'node:test';
import assert from 'node:assert/strict';
import { createOpenAiService } from './openai.service.mjs';
import { LLM_STREAM_EVENT_TYPES } from './llm-gateway/index.mjs';

test('openai service prepares response from normalized tool results', async () => {
  const llmGateway = {
    async callTools() {
      return {
        provider: 'openai',
        providerResponseId: 'provider_resp_1',
        toolCalls: [
          {
            id: 'call_1',
            name: 'add_text_to_canvas',
            rawArguments: '{"text":"Hello"}',
          },
        ],
      };
    },
    async stream() {
      return { text: 'done' };
    },
  };

  let executedToolCall = null;
  const toolRunnerService = {
    listTools() {
      return [];
    },
    async preview() {
      throw new Error('preview should not be called');
    },
    async executeToolCall(toolCall) {
      executedToolCall = toolCall;
      return {
        action: 'add_text_to_canvas',
        toolResult: 'Prepared text insertion',
        suggestions: [{ id: 's1', label: 'x', action: 'add-text' }],
        effects: [
          { type: 'insert-text', text: 'Hello' },
          { type: 'start-generation', prompt: 'poster prompt', mediaType: 'image' },
        ],
      };
    },
  };

  const service = createOpenAiService({ llmGateway });
  const prepared = await service.prepareResponse({
    request: {
      message: '加一句标题',
      canvasContext: {
        latestPrompt: '科技海报',
        nodeCount: 3,
        assetCount: 1,
        selectedNode: { type: 'text' },
      },
    },
    conversationState: {
      conversationId: 'conv_1',
      responseId: 'resp_1',
      providerState: {},
    },
    toolRunnerService,
  });

  assert.deepEqual(executedToolCall, {
    name: 'add_text_to_canvas',
    rawArguments: '{"text":"Hello"}',
    message: '加一句标题',
    canvasContext: {
      latestPrompt: '科技海报',
      nodeCount: 3,
      assetCount: 1,
      selectedNode: { type: 'text' },
    },
  });
  assert.equal(prepared.conversationId, 'conv_1');
  assert.equal(prepared.previousResponseId, 'resp_1');
  assert.deepEqual(prepared.effects, [{ type: 'insert-text', text: 'Hello' }]);
  assert.deepEqual(prepared.deferredGenerationEffect, {
    type: 'start-generation',
    prompt: 'poster prompt',
    mediaType: 'image',
  });
});

test('openai service maps gateway stream events to text deltas', async () => {
  const seen = [];
  const service = createOpenAiService({
    llmGateway: {
      async callTools() {
        return { toolCalls: [] };
      },
      async stream({ onEvent }) {
        onEvent({ type: LLM_STREAM_EVENT_TYPES.TEXT_START });
        onEvent({ type: LLM_STREAM_EVENT_TYPES.TEXT_DELTA, text: '你' });
        onEvent({ type: LLM_STREAM_EVENT_TYPES.TEXT_DELTA, text: '好' });
        onEvent({ type: LLM_STREAM_EVENT_TYPES.TEXT_END });
        return { text: '你好' };
      },
    },
  });

  const text = await service.streamPreparedResponse({
    prepared: {
      prompt: {
        system: 'sys',
        user: 'user',
      },
      fallbackText: 'fallback',
    },
    onTextDelta(chunk) {
      seen.push(chunk);
    },
  });

  assert.equal(text, '你好');
  assert.deepEqual(seen, ['你', '好']);
});
