import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createImageGenerationController } from './image-generation.controller.mjs';
import { createVideoGenerationController } from './video-generation.controller.mjs';
import { GeneratedMediaStorageConfigError, GeneratedMediaStorageError } from '../services/media-storage.service.mjs';

function createJsonRequest(body) {
  const payload = Buffer.from(JSON.stringify(body));
  return {
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
  response.end = function end(chunk = '') {
    this.body += Buffer.from(chunk).toString('utf8');
    this.emit('finish');
  };
  return response;
}

function parseBody(response) {
  return JSON.parse(response.body);
}

test('image generation controller returns Cloudflare image URLs after storage', async () => {
  const providerUrl = 'https://provider.example.com/image.jpg';
  const controller = createImageGenerationController({
    minimaxService: {
      async generateImage({ prompt, aspectRatio }) {
        assert.equal(prompt, 'poster');
        assert.equal(aspectRatio, '16:9');
        return {
          requestId: 'request_1',
          imageUrl: providerUrl,
          aspectRatio,
          width: 1280,
          height: 720,
        };
      },
    },
    mediaStorageService: {
      async storeGeneratedMedia(input) {
        assert.deepEqual(input, {
          mediaType: 'image',
          sourceUrl: providerUrl,
          provider: 'minimax',
          requestId: 'request_1',
        });
        return { url: 'https://media.example.com/generated/image.jpg' };
      },
    },
  });
  const response = createMockResponse();

  await controller(createJsonRequest({ prompt: 'poster', aspectRatio: '16:9' }), response);

  assert.equal(response.statusCode, 200);
  assert.equal(parseBody(response).imageUrl, 'https://media.example.com/generated/image.jpg');
  assert.doesNotMatch(response.body, /provider\.example\.com/);
});

test('video generation controller returns Cloudflare video URLs after storage', async () => {
  const providerUrl = 'https://provider.example.com/video.mp4';
  const controller = createVideoGenerationController({
    minimaxService: {
      async generateVideo() {
        return {
          requestId: 'request_2',
          taskId: 'task_1',
          fileId: 'file_1',
          videoUrl: providerUrl,
          posterUrl: null,
          width: 1920,
          height: 1080,
          durationSeconds: 6,
          resolution: '1080P',
        };
      },
    },
    mediaStorageService: {
      async storeGeneratedMedia(input) {
        assert.deepEqual(input, {
          mediaType: 'video',
          sourceUrl: providerUrl,
          provider: 'minimax',
          requestId: 'request_2',
          taskId: 'task_1',
          fileId: 'file_1',
        });
        return { url: 'https://media.example.com/generated/video.mp4' };
      },
    },
  });
  const response = createMockResponse();

  await controller(createJsonRequest({ prompt: 'motion' }), response);

  assert.equal(response.statusCode, 200);
  assert.equal(parseBody(response).videoUrl, 'https://media.example.com/generated/video.mp4');
  assert.doesNotMatch(response.body, /provider\.example\.com/);
});

test('generation controllers map missing Cloudflare configuration to 503', async () => {
  let generateCalled = false;
  const controller = createImageGenerationController({
    minimaxService: {
      async generateImage() {
        generateCalled = true;
        return {
          requestId: 'request_1',
          imageUrl: 'https://provider.example.com/image.jpg',
          aspectRatio: '16:9',
        };
      },
    },
    mediaStorageService: {
      assertReady() {
        throw new GeneratedMediaStorageConfigError('missing cloudflare config');
      },
      async storeGeneratedMedia() {
        throw new Error('storeGeneratedMedia should not be called when config is missing');
      },
    },
  });
  const response = createMockResponse();

  await controller(createJsonRequest({ prompt: 'poster' }), response);

  assert.equal(response.statusCode, 503);
  assert.equal(parseBody(response).code, 'GENERATED_MEDIA_STORAGE_NOT_CONFIGURED');
  assert.doesNotMatch(response.body, /provider\.example\.com/);
  assert.equal(generateCalled, false);
});

test('generation controllers map Cloudflare upload failures to 502', async () => {
  const controller = createVideoGenerationController({
    minimaxService: {
      async generateVideo() {
        return {
          requestId: 'request_2',
          taskId: 'task_1',
          fileId: 'file_1',
          videoUrl: 'https://provider.example.com/video.mp4',
          width: 1280,
          height: 720,
        };
      },
    },
    mediaStorageService: {
      async storeGeneratedMedia() {
        throw new GeneratedMediaStorageError('r2 upload failed');
      },
    },
  });
  const response = createMockResponse();

  await controller(createJsonRequest({ prompt: 'motion' }), response);

  assert.equal(response.statusCode, 502);
  assert.equal(parseBody(response).code, 'GENERATED_MEDIA_STORAGE_FAILED');
  assert.doesNotMatch(response.body, /provider\.example\.com/);
});
