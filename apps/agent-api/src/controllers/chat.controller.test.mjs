import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createChatController } from './chat.controller.mjs';

function createJsonRequest(body) {
  const payload = Buffer.from(JSON.stringify(body));
  return {
    method: 'POST',
    url: '/chat',
    headers: {},
    async *[Symbol.asyncIterator]() {
      yield payload;
    },
  };
}

function createMockResponse() {
  const response = new EventEmitter();
  response.statusCode = 200;
  response.headers = {};
  response.body = '';
  response.writeHead = function writeHead(statusCode, headers) {
    this.statusCode = statusCode;
    this.headers = headers;
  };
  response.write = function write(chunk) {
    this.body += Buffer.from(chunk).toString('utf8');
    return true;
  };
  response.end = function end(chunk = '') {
    this.body += Buffer.from(chunk).toString('utf8');
    this.emit('finish');
  };
  return response;
}

async function invokeController(controller, body) {
  const request = createJsonRequest(body);
  const response = createMockResponse();
  const finished = new Promise((resolve) => response.once('finish', resolve));

  await controller(request, response);
  await finished;

  return response;
}

test('chat controller closes the stream when prepareResponse fails', async () => {
  const controller = createChatController({
    conversationService: {
      prepare(body) {
        return {
          conversationId: body.conversationId ?? 'conv_1',
          previousResponseId: body.previousResponseId ?? null,
          responseId: 'resp_1',
          providerState: {},
        };
      },
    },
    openAiService: {
      async prepareResponse() {
        throw new Error('prepare failed');
      },
      async streamPreparedResponse() {
        throw new Error('should not be called');
      },
    },
    toolRunnerService: {
      async generateImageEffect() {
        throw new Error('should not be called');
      },
      async generateVideoEffect() {
        throw new Error('should not be called');
      },
    },
  });

  const response = await invokeController(controller, {
    message: '你是谁',
    conversationId: 'conv_1',
  });

  assert.equal(response.statusCode, 200);
  assert.match(response.body, /text-start/);
  assert.match(response.body, /抱歉，当前请求执行失败，请稍后重试。/);
  assert.match(response.body, /"type":"text-end"/);
  assert.match(response.body, /"type":"data-agentResponse"/);
  assert.match(response.body, /"stage":"prepareResponse"/);
  assert.match(response.body, /"message":"prepare failed"/);
});

test('chat controller closes the stream when streamPreparedResponse fails before deltas', async () => {
  const controller = createChatController({
    conversationService: {
      prepare(body) {
        return {
          conversationId: body.conversationId ?? 'conv_2',
          previousResponseId: body.previousResponseId ?? null,
          responseId: 'resp_2',
          providerState: {},
        };
      },
    },
    openAiService: {
      async prepareResponse() {
        return {
          conversationId: 'conv_2',
          previousResponseId: 'resp_2',
          suggestions: [{ id: 's1' }],
          effects: [],
          deferredGenerationEffect: null,
          prompt: null,
          fallbackText: 'fallback',
        };
      },
      async streamPreparedResponse() {
        throw new Error('stream failed');
      },
    },
    toolRunnerService: {
      async generateImageEffect() {
        throw new Error('should not be called');
      },
      async generateVideoEffect() {
        throw new Error('should not be called');
      },
    },
  });

  const response = await invokeController(controller, {
    message: '请介绍一下你',
    conversationId: 'conv_2',
  });

  assert.equal(response.statusCode, 200);
  assert.match(response.body, /text-start/);
  assert.match(response.body, /抱歉，当前请求执行失败，请稍后重试。/);
  assert.match(response.body, /"type":"text-end"/);
  assert.match(response.body, /"type":"data-agentResponse"/);
  assert.match(response.body, /"stage":"streamPreparedResponse"/);
  assert.match(response.body, /"message":"stream failed"/);
});

test('chat controller closes the stream when deferred generation fails', async () => {
  const controller = createChatController({
    conversationService: {
      prepare(body) {
        return {
          conversationId: body.conversationId ?? 'conv_3',
          previousResponseId: body.previousResponseId ?? null,
          responseId: 'resp_3',
          providerState: {},
        };
      },
    },
    openAiService: {
      async prepareResponse() {
        return {
          conversationId: 'conv_3',
          previousResponseId: 'resp_3',
          suggestions: [{ id: 's1' }],
          effects: [{ type: 'insert-text', text: 'hello' }],
          deferredGenerationEffect: {
            type: 'start-generation',
            prompt: '生成海报',
            mediaType: 'image',
          },
          fallbackText: 'hello',
          prompt: {
            system: 'sys',
            user: 'user',
          },
        };
      },
      async streamPreparedResponse({ onTextDelta }) {
        onTextDelta('hello');
        return 'hello';
      },
    },
    toolRunnerService: {
      async generateImageEffect() {
        throw new Error('image generation failed');
      },
      async generateVideoEffect() {
        throw new Error('should not be called');
      },
    },
  });

  const response = await invokeController(controller, {
    message: '生成一张海报',
    conversationId: 'conv_3',
  });

  assert.equal(response.statusCode, 200);
  assert.match(response.body, /"type":"text-start"/);
  assert.match(response.body, /"type":"text-delta"/);
  assert.match(response.body, /"type":"text-end"/);
  assert.match(response.body, /"type":"data-agentResponse"/);
  assert.match(response.body, /"type":"start-generation"/);
  assert.match(response.body, /"stage":"deferredGeneration"/);
  assert.match(response.body, /"message":"image generation failed"/);
});
