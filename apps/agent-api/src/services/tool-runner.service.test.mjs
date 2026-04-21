import test from 'node:test';
import assert from 'node:assert/strict';
import { createToolRunnerService } from './tool-runner.service.mjs';
import { GeneratedMediaStorageError } from './media-storage.service.mjs';

test('tool runner returns Cloudflare image URLs in generated image effects', async () => {
  const providerUrl = 'https://provider.example.com/image.jpg';
  const service = createToolRunnerService({
    minimaxService: {
      async generateImage({ prompt }) {
        assert.equal(prompt, 'poster');
        return {
          requestId: 'request_1',
          imageUrl: providerUrl,
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

  const effect = await service.generateImageEffect({ prompt: 'poster' });

  assert.equal(effect.type, 'insert-image');
  assert.equal(effect.imageUrl, 'https://media.example.com/generated/image.jpg');
});

test('tool runner returns Cloudflare video URLs in generated video effects', async () => {
  const providerUrl = 'https://provider.example.com/video.mp4';
  const service = createToolRunnerService({
    minimaxService: {
      async generateVideo() {
        return {
          requestId: 'request_2',
          taskId: 'task_1',
          fileId: 'file_1',
          videoUrl: providerUrl,
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

  const effect = await service.generateVideoEffect({ prompt: 'motion' });

  assert.equal(effect.type, 'insert-video');
  assert.equal(effect.videoUrl, 'https://media.example.com/generated/video.mp4');
});

test('tool runner surfaces Cloudflare storage failures without returning provider URLs', async () => {
  const service = createToolRunnerService({
    minimaxService: {
      async generateImage() {
        return {
          requestId: 'request_1',
          imageUrl: 'https://provider.example.com/image.jpg',
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

  await assert.rejects(() => service.generateImageEffect({ prompt: 'poster' }), /r2 upload failed/);
});
