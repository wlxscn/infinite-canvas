import { basename, extname } from 'node:path';
import { getEnv } from '../config/env.mjs';
import { createLlmGateway, LlmGatewayError } from './llm-gateway/index.mjs';

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
  llmGateway = createLlmGateway({ env }),
} = {}) {
  return {
    async transcribeAudio({ audioBuffer, mimeType, fileName, language }) {
      try {
        const result = await llmGateway.transcribe({
          audioBuffer,
          mimeType,
          fileName,
          language,
        });

        return {
          text: result.text,
        };
      } catch (error) {
        if (error instanceof LlmGatewayError) {
          throw new TranscriptionError(error.statusCode, error.code, error.message);
        }

        throw new TranscriptionError(502, 'transcription_failed', `Transcription provider request failed: ${error.message}`);
      }
    },
  };
}
