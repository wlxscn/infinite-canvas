import { randomUUID } from 'node:crypto';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getEnv } from '../config/env.mjs';

const MEDIA_TYPE_CONFIG = {
  image: {
    directory: 'images',
    defaultContentType: 'image/jpeg',
    extensions: {
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'image/gif': 'gif',
    },
  },
  video: {
    directory: 'videos',
    defaultContentType: 'video/mp4',
    extensions: {
      'video/mp4': 'mp4',
      'video/mpeg': 'mpeg',
      'video/quicktime': 'mov',
      'video/webm': 'webm',
    },
  },
};

export class GeneratedMediaStorageConfigError extends Error {
  constructor(message = 'Cloudflare generated media storage is not configured.') {
    super(message);
    this.name = 'GeneratedMediaStorageConfigError';
    this.code = 'GENERATED_MEDIA_STORAGE_NOT_CONFIGURED';
  }
}

export class GeneratedMediaStorageError extends Error {
  constructor(message, cause) {
    super(message);
    this.name = 'GeneratedMediaStorageError';
    this.code = 'GENERATED_MEDIA_STORAGE_FAILED';
    this.cause = cause;
  }
}

function getHeader(headers, name) {
  return typeof headers?.get === 'function' ? headers.get(name) : null;
}

function normalizeContentType(contentType, mediaType) {
  const config = MEDIA_TYPE_CONFIG[mediaType];
  const normalized = typeof contentType === 'string' ? contentType.split(';')[0].trim().toLowerCase() : '';

  if (!normalized || normalized === 'application/octet-stream') {
    return config.defaultContentType;
  }

  if (mediaType === 'image' && normalized.startsWith('image/')) {
    return normalized;
  }

  if (mediaType === 'video' && normalized.startsWith('video/')) {
    return normalized;
  }

  throw new GeneratedMediaStorageError(`Provider media content type ${normalized} is not valid for ${mediaType}.`);
}

function extensionForContentType(contentType, mediaType) {
  return MEDIA_TYPE_CONFIG[mediaType].extensions[contentType] ?? (mediaType === 'video' ? 'mp4' : 'jpg');
}

function sanitizePathPart(value) {
  return String(value ?? '')
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function normalizePrefix(prefix) {
  return String(prefix ?? '')
    .trim()
    .replace(/^\/+|\/+$/g, '');
}

function joinPublicUrl(baseUrl, key) {
  const encodedKey = key.split('/').map(encodeURIComponent).join('/');
  return `${String(baseUrl).replace(/\/+$/g, '')}/${encodedKey}`;
}

function assertConfig(env) {
  const missing = [
    ['CLOUDFLARE_R2_ACCOUNT_ID', env.cloudflareR2AccountId],
    ['CLOUDFLARE_R2_ACCESS_KEY_ID', env.cloudflareR2AccessKeyId],
    ['CLOUDFLARE_R2_SECRET_ACCESS_KEY', env.cloudflareR2SecretAccessKey],
    ['CLOUDFLARE_R2_BUCKET', env.cloudflareR2Bucket],
    ['CLOUDFLARE_R2_PUBLIC_BASE_URL', env.cloudflareR2PublicBaseUrl],
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name);

  if (missing.length > 0) {
    throw new GeneratedMediaStorageConfigError(`Cloudflare generated media storage is missing: ${missing.join(', ')}.`);
  }

  if (!Number.isFinite(env.generatedMediaMaxBytes) || env.generatedMediaMaxBytes <= 0) {
    throw new GeneratedMediaStorageConfigError('GENERATED_MEDIA_MAX_BYTES must be a positive integer.');
  }

  if (!Number.isFinite(env.generatedMediaFetchTimeoutMs) || env.generatedMediaFetchTimeoutMs <= 0) {
    throw new GeneratedMediaStorageConfigError('GENERATED_MEDIA_FETCH_TIMEOUT_MS must be a positive integer.');
  }
}

function createObjectKey({ env, mediaType, contentType, provider, requestId, taskId, fileId, now, createId }) {
  const date = now();
  const year = String(date.getUTCFullYear());
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const config = MEDIA_TYPE_CONFIG[mediaType];
  const prefix = normalizePrefix(env.cloudflareR2KeyPrefix);
  const traceId = sanitizePathPart(fileId ?? taskId ?? requestId ?? provider) || 'media';
  const id = sanitizePathPart(createId());
  const extension = extensionForContentType(contentType, mediaType);
  const filename = `${traceId}-${id}.${extension}`;

  return [prefix, config.directory, year, month, filename].filter(Boolean).join('/');
}

async function fetchProviderMedia({ sourceUrl, mediaType, env, fetchFn }) {
  if (typeof sourceUrl !== 'string' || !/^https?:\/\//i.test(sourceUrl)) {
    throw new GeneratedMediaStorageError('Provider media URL is invalid.');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.generatedMediaFetchTimeoutMs);

  try {
    const response = await fetchFn(sourceUrl, {
      method: 'GET',
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new GeneratedMediaStorageError(`Provider media download failed with status ${response.status}.`);
    }

    const contentLength = Number.parseInt(getHeader(response.headers, 'content-length') ?? '', 10);
    if (Number.isFinite(contentLength) && contentLength > env.generatedMediaMaxBytes) {
      throw new GeneratedMediaStorageError('Provider media exceeds configured maximum size.');
    }

    const contentType = normalizeContentType(getHeader(response.headers, 'content-type'), mediaType);
    const buffer = new Uint8Array(await response.arrayBuffer());

    if (buffer.byteLength === 0) {
      throw new GeneratedMediaStorageError('Provider media response was empty.');
    }

    if (buffer.byteLength > env.generatedMediaMaxBytes) {
      throw new GeneratedMediaStorageError('Provider media exceeds configured maximum size.');
    }

    return {
      body: buffer,
      contentType,
      contentLength: buffer.byteLength,
    };
  } catch (error) {
    if (error instanceof GeneratedMediaStorageError) {
      throw error;
    }

    throw new GeneratedMediaStorageError('Failed to download provider media.', error);
  } finally {
    clearTimeout(timeout);
  }
}

function sourceHost(sourceUrl) {
  try {
    return new URL(sourceUrl).host;
  } catch {
    return 'unknown';
  }
}

export function createMediaStorageService({
  env = getEnv(),
  fetchFn = fetch,
  createS3Client = (config) => new S3Client(config),
  createId = randomUUID,
  now = () => new Date(),
} = {}) {
  let client = null;

  function getClient() {
    assertConfig(env);

    client ??= createS3Client({
      region: 'auto',
      endpoint: `https://${env.cloudflareR2AccountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: env.cloudflareR2AccessKeyId,
        secretAccessKey: env.cloudflareR2SecretAccessKey,
      },
    });

    return client;
  }

  return {
    assertReady() {
      assertConfig(env);
    },

    async storeGeneratedMedia({ mediaType, sourceUrl, provider = 'unknown', requestId, taskId, fileId }) {
      if (!MEDIA_TYPE_CONFIG[mediaType]) {
        throw new GeneratedMediaStorageError(`Unsupported generated media type: ${mediaType}.`);
      }

      assertConfig(env);

      const media = await fetchProviderMedia({
        sourceUrl,
        mediaType,
        env,
        fetchFn,
      });
      const key = createObjectKey({
        env,
        mediaType,
        contentType: media.contentType,
        provider,
        requestId,
        taskId,
        fileId,
        now,
        createId,
      });

      try {
        await getClient().send(
          new PutObjectCommand({
            Bucket: env.cloudflareR2Bucket,
            Key: key,
            Body: media.body,
            ContentType: media.contentType,
            ContentLength: media.contentLength,
            CacheControl: env.generatedMediaCacheControl,
            Metadata: {
              media_type: mediaType,
              provider,
              request_id: String(requestId ?? ''),
              task_id: String(taskId ?? ''),
              file_id: String(fileId ?? ''),
              source_host: sourceHost(sourceUrl),
            },
          }),
        );
      } catch (error) {
        throw new GeneratedMediaStorageError('Failed to upload generated media to Cloudflare.', error);
      }

      return {
        url: joinPublicUrl(env.cloudflareR2PublicBaseUrl, key),
        key,
        contentType: media.contentType,
        contentLength: media.contentLength,
      };
    },
  };
}
