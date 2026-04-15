import { createTranscriptionService, TranscriptionError, validateAudioUpload } from '../services/transcription.service.mjs';
import { getEnv } from '../config/env.mjs';

function writeJson(response, statusCode, body) {
  response.writeHead(statusCode, { 'content-type': 'application/json' });
  response.end(JSON.stringify(body));
}

async function parseMultipartRequest(request) {
  const parsedRequest = new Request(`http://127.0.0.1${request.url ?? '/transcribe'}`, {
    method: request.method,
    headers: request.headers,
    body: request,
    duplex: 'half',
  });

  return parsedRequest.formData();
}

export function createTranscriptionController({
  env = getEnv(),
  transcriptionService = createTranscriptionService({ env }),
} = {}) {
  return async function transcriptionController(request, response) {
    const contentType = `${request.headers['content-type'] ?? ''}`;
    if (!contentType.toLowerCase().startsWith('multipart/form-data')) {
      writeJson(response, 400, {
        error: 'Expected multipart/form-data request body',
        code: 'invalid_multipart',
      });
      return;
    }

    let formData;
    try {
      formData = await parseMultipartRequest(request);
    } catch {
      writeJson(response, 400, {
        error: 'Invalid multipart form data',
        code: 'invalid_multipart',
      });
      return;
    }

    const audio = formData.get('audio');
    const language = formData.get('language');

    try {
      const validatedAudio = validateAudioUpload(audio, {
        maxBytes: env.transcriptionMaxBytes,
      });
      const audioBuffer = Buffer.from(await audio.arrayBuffer());
      const result = await transcriptionService.transcribeAudio({
        audioBuffer,
        mimeType: validatedAudio.normalizedMimeType,
        fileName: validatedAudio.fileName,
        language: typeof language === 'string' ? language : undefined,
      });

      writeJson(response, 200, result);
    } catch (error) {
      if (error instanceof TranscriptionError) {
        writeJson(response, error.statusCode, {
          error: error.message,
          code: error.code,
        });
        return;
      }

      writeJson(response, 500, {
        error: 'Unexpected transcription error',
        code: 'internal_error',
      });
    }
  };
}
