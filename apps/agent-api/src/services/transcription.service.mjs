import { basename, extname } from 'node:path';
import { getEnv } from '../config/env.mjs';

const SUPPORTED_AUDIO_TYPES = new Set([
  'audio/m4a',
  'audio/mp3',
  'audio/mp4',
  'audio/mpeg',
  'audio/mpga',
  'audio/ogg',
  'audio/wav',
  'audio/webm',
]);

const MIME_TYPE_EXTENSIONS = {
  'audio/m4a': '.m4a',
  'audio/mp3': '.mp3',
  'audio/mp4': '.mp4',
  'audio/mpeg': '.mp3',
  'audio/mpga': '.mp3',
  'audio/ogg': '.ogg',
  'audio/wav': '.wav',
  'audio/webm': '.webm',
};

export class TranscriptionError extends Error {
  constructor(statusCode, code, message) {
    super(message);
    this.name = 'TranscriptionError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

function normalizeMimeType(mimeType) {
  return `${mimeType ?? ''}`.split(';')[0].trim().toLowerCase();
}

function sanitizeFileName(fileName, normalizedMimeType) {
  const baseName = basename(fileName || 'recording');
  if (extname(baseName)) {
    return baseName;
  }

  const extension = MIME_TYPE_EXTENSIONS[normalizedMimeType] ?? '.webm';
  return `${baseName}${extension}`;
}

export function validateAudioUpload(file, { maxBytes } = {}) {
  if (!(file instanceof File)) {
    throw new TranscriptionError(400, 'missing_audio', 'audio file is required');
  }

  const normalizedMimeType = normalizeMimeType(file.type);
  if (!SUPPORTED_AUDIO_TYPES.has(normalizedMimeType)) {
    throw new TranscriptionError(415, 'unsupported_audio_type', 'Unsupported audio format');
  }

  if (!Number.isFinite(file.size) || file.size <= 0) {
    throw new TranscriptionError(400, 'empty_audio', 'Audio file is empty');
  }

  if (Number.isFinite(maxBytes) && file.size > maxBytes) {
    throw new TranscriptionError(413, 'audio_too_large', 'Audio file exceeds size limit');
  }

  return {
    normalizedMimeType,
    fileName: sanitizeFileName(file.name, normalizedMimeType),
    size: file.size,
  };
}

export function createTranscriptionService({
  env = getEnv(),
  fetchImpl = globalThis.fetch,
} = {}) {
  return {
    async transcribeAudio({ audioBuffer, mimeType, fileName, language }) {
      if (!env.openAiApiKey) {
        throw new TranscriptionError(500, 'missing_provider_config', 'OPENAI_API_KEY is not configured');
      }

      const upstreamBody = new FormData();
      upstreamBody.set('model', env.openAiTranscriptionModel);
      upstreamBody.set('file', new File([audioBuffer], fileName, { type: mimeType }));

      if (typeof language === 'string' && language.trim()) {
        upstreamBody.set('language', language.trim());
      }

      let upstreamResponse;
      try {
        upstreamResponse = await fetchImpl(`${env.openAiBaseUrl}/audio/transcriptions`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${env.openAiApiKey}`,
          },
          body: upstreamBody,
          signal: AbortSignal.timeout(env.transcriptionTimeoutMs),
        });
      } catch (error) {
        throw new TranscriptionError(502, 'transcription_failed', `Transcription provider request failed: ${error.message}`);
      }

      if (!upstreamResponse.ok) {
        let detail = '';

        try {
          const upstreamError = await upstreamResponse.json();
          detail = upstreamError?.error?.message ?? upstreamError?.message ?? '';
        } catch {
          detail = await upstreamResponse.text();
        }

        const suffix = detail ? `: ${detail}` : '';
        throw new TranscriptionError(502, 'transcription_failed', `Transcription provider returned ${upstreamResponse.status}${suffix}`);
      }

      let payload;
      try {
        payload = await upstreamResponse.json();
      } catch {
        throw new TranscriptionError(502, 'invalid_transcription_response', 'Transcription provider returned invalid JSON');
      }

      const text = typeof payload?.text === 'string' ? payload.text.trim() : '';
      if (!text) {
        throw new TranscriptionError(502, 'invalid_transcription_response', 'Transcription provider returned no text');
      }

      return { text };
    },
  };
}
