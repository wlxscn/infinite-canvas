import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createMediaStorageService,
  GeneratedMediaStorageConfigError,
  GeneratedMediaStorageError,
} from './media-storage.service.mjs';

function createEnv(overrides = {}) {
  return {
    cloudflareR2AccountId: 'account_123',
    cloudflareR2AccessKeyId: 'access_key',
    cloudflareR2SecretAccessKey: 'secret_key',
    cloudflareR2Bucket: 'canvas-media',
    cloudflareR2PublicBaseUrl: 'https://media.example.com/',
    cloudflareR2KeyPrefix: 'generated',
    generatedMediaMaxBytes: 1024 * 1024,
    generatedMediaFetchTimeoutMs: 1000,
    generatedMediaCacheControl: 'public, max-age=31536000, immutable',
    ...overrides,
  };
}

function createStorageService({ env = createEnv(), response, send = async () => ({}) } = {}) {
  const sentCommands = [];
  let fetchCalled = false;
  const service = createMediaStorageService({
    env,
    now: () => new Date('2026-04-21T08:09:10.000Z'),
    createId: () => 'uuid-1',
    async fetchFn(url) {
      fetchCalled = true;
      assert.equal(url, 'https://provider.example.com/media');
      return response ?? new Response('image-bytes', { headers: { 'content-type': 'image/jpeg' } });
    },
    createS3Client(config) {
      assert.equal(config.region, 'auto');
      assert.equal(config.endpoint, 'https://account_123.r2.cloudflarestorage.com');
      assert.equal(config.credentials.accessKeyId, env.cloudflareR2AccessKeyId);
      assert.equal(config.credentials.secretAccessKey, env.cloudflareR2SecretAccessKey);
      return {
        async send(command) {
          sentCommands.push(command);
          return send(command);
        },
      };
    },
  });

  return {
    service,
    sentCommands,
    wasFetchCalled: () => fetchCalled,
  };
}

test('media storage uploads generated images to R2 and returns public URL', async () => {
  const { service, sentCommands } = createStorageService();

  const stored = await service.storeGeneratedMedia({
    mediaType: 'image',
    sourceUrl: 'https://provider.example.com/media',
    provider: 'minimax',
    requestId: 'request_1',
  });

  assert.equal(stored.url, 'https://media.example.com/generated/images/2026/04/request_1-uuid-1.jpg');
  assert.equal(stored.key, 'generated/images/2026/04/request_1-uuid-1.jpg');
  assert.equal(stored.contentType, 'image/jpeg');
  assert.equal(stored.contentLength, 11);
  assert.equal(sentCommands.length, 1);
  assert.equal(sentCommands[0].input.Bucket, 'canvas-media');
  assert.equal(sentCommands[0].input.Key, 'generated/images/2026/04/request_1-uuid-1.jpg');
  assert.equal(sentCommands[0].input.ContentType, 'image/jpeg');
  assert.equal(sentCommands[0].input.CacheControl, 'public, max-age=31536000, immutable');
  assert.equal(sentCommands[0].input.Metadata.media_type, 'image');
  assert.equal(sentCommands[0].input.Metadata.provider, 'minimax');
  assert.equal(sentCommands[0].input.Metadata.request_id, 'request_1');
  assert.equal(sentCommands[0].input.Metadata.source_host, 'provider.example.com');
});

test('media storage uploads generated videos with video keys and content type', async () => {
  const { service, sentCommands } = createStorageService({
    response: new Response('video-bytes', { headers: { 'content-type': 'video/mp4' } }),
  });

  const stored = await service.storeGeneratedMedia({
    mediaType: 'video',
    sourceUrl: 'https://provider.example.com/media',
    provider: 'minimax',
    requestId: 'request_2',
    taskId: 'task_1',
    fileId: 'file_1',
  });

  assert.equal(stored.url, 'https://media.example.com/generated/videos/2026/04/file_1-uuid-1.mp4');
  assert.equal(sentCommands[0].input.Key, 'generated/videos/2026/04/file_1-uuid-1.mp4');
  assert.equal(sentCommands[0].input.ContentType, 'video/mp4');
  assert.equal(sentCommands[0].input.Metadata.task_id, 'task_1');
  assert.equal(sentCommands[0].input.Metadata.file_id, 'file_1');
});

test('media storage reports missing Cloudflare configuration before fetching provider media', async () => {
  const { service, wasFetchCalled } = createStorageService({
    env: createEnv({ cloudflareR2SecretAccessKey: '' }),
  });

  assert.throws(
    () => service.assertReady(),
    (error) => {
      assert.ok(error instanceof GeneratedMediaStorageConfigError);
      assert.equal(error.code, 'GENERATED_MEDIA_STORAGE_NOT_CONFIGURED');
      assert.match(error.message, /CLOUDFLARE_R2_SECRET_ACCESS_KEY/);
      assert.doesNotMatch(error.message, /secret_key/);
      return true;
    },
  );

  await assert.rejects(
    () =>
      service.storeGeneratedMedia({
        mediaType: 'image',
        sourceUrl: 'https://provider.example.com/media',
      }),
    (error) => {
      assert.ok(error instanceof GeneratedMediaStorageConfigError);
      assert.equal(error.code, 'GENERATED_MEDIA_STORAGE_NOT_CONFIGURED');
      assert.match(error.message, /CLOUDFLARE_R2_SECRET_ACCESS_KEY/);
      assert.doesNotMatch(error.message, /secret_key/);
      return true;
    },
  );
  assert.equal(wasFetchCalled(), false);
});

test('media storage rejects provider download failures', async () => {
  const { service } = createStorageService({
    response: new Response('not found', { status: 404 }),
  });

  await assert.rejects(
    () =>
      service.storeGeneratedMedia({
        mediaType: 'image',
        sourceUrl: 'https://provider.example.com/media',
      }),
    /Provider media download failed with status 404/,
  );
});

test('media storage rejects invalid provider content types', async () => {
  const { service } = createStorageService({
    response: new Response('html', { headers: { 'content-type': 'text/html' } }),
  });

  await assert.rejects(
    () =>
      service.storeGeneratedMedia({
        mediaType: 'image',
        sourceUrl: 'https://provider.example.com/media',
      }),
    /not valid for image/,
  );
});

test('media storage rejects oversized provider media', async () => {
  const { service } = createStorageService({
    env: createEnv({ generatedMediaMaxBytes: 4 }),
    response: new Response('too-large', { headers: { 'content-type': 'image/png' } }),
  });

  await assert.rejects(
    () =>
      service.storeGeneratedMedia({
        mediaType: 'image',
        sourceUrl: 'https://provider.example.com/media',
      }),
    /exceeds configured maximum size/,
  );
});

test('media storage maps R2 upload failures', async () => {
  const { service } = createStorageService({
    send: async () => {
      throw new Error('r2 unavailable');
    },
  });

  await assert.rejects(
    () =>
      service.storeGeneratedMedia({
        mediaType: 'image',
        sourceUrl: 'https://provider.example.com/media',
      }),
    (error) => {
      assert.ok(error instanceof GeneratedMediaStorageError);
      assert.equal(error.code, 'GENERATED_MEDIA_STORAGE_FAILED');
      assert.match(error.message, /Failed to upload generated media/);
      assert.equal(error.cause.message, 'r2 unavailable');
      return true;
    },
  );
});
