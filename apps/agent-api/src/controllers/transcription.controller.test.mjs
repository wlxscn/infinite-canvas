import test from 'node:test';
import assert from 'node:assert/strict';
import { createTranscriptionController } from './transcription.controller.mjs';
import { TranscriptionError } from '../services/transcription.service.mjs';

async function createMultipartRequest({ file, language } = {}) {
  const formData = new FormData();
  if (file) {
    formData.set('audio', file);
  }

  if (language) {
    formData.set('language', language);
  }

  const request = new Request('http://127.0.0.1/transcribe', {
    method: 'POST',
    body: formData,
  });
  const buffer = Buffer.from(await request.arrayBuffer());
  const contentType = request.headers.get('content-type');

  return {
    method: 'POST',
    url: '/transcribe',
    headers: {
      'content-type': contentType,
    },
    async *[Symbol.asyncIterator]() {
      yield buffer;
    },
  };
}

function createMockResponse() {
  return {
    statusCode: 200,
    headers: {},
    body: '',
    writeHead(statusCode, headers) {
      this.statusCode = statusCode;
      this.headers = headers;
    },
    end(body = '') {
      this.body = body;
    },
  };
}

async function invokeController(controller, requestInit) {
  const request = await createMultipartRequest(requestInit);
  const response = createMockResponse();
  await controller(request, response);
  return response;
}

test('transcription controller rejects unsupported audio types', async () => {
  const controller = createTranscriptionController({
    env: {
      transcriptionMaxBytes: 1024,
    },
    transcriptionService: {
      async transcribeAudio() {
        throw new Error('should not be called');
      },
    },
  });

  const response = await invokeController(controller, {
    file: new File(['hello'], 'recording.txt', { type: 'text/plain' }),
  });

  assert.equal(response.statusCode, 415);
  assert.deepEqual(JSON.parse(response.body), {
    error: 'Unsupported audio format',
    code: 'unsupported_audio_type',
  });
});

test('transcription controller rejects empty audio uploads', async () => {
  const controller = createTranscriptionController({
    env: {
      transcriptionMaxBytes: 1024,
    },
    transcriptionService: {
      async transcribeAudio() {
        throw new Error('should not be called');
      },
    },
  });

  const response = await invokeController(controller, {
    file: new File([], 'recording.webm', { type: 'audio/webm' }),
  });

  assert.equal(response.statusCode, 400);
  assert.deepEqual(JSON.parse(response.body), {
    error: 'Audio file is empty',
    code: 'empty_audio',
  });
});

test('transcription controller maps provider failures to JSON errors', async () => {
  const controller = createTranscriptionController({
    env: {
      transcriptionMaxBytes: 1024,
    },
    transcriptionService: {
      async transcribeAudio() {
        throw new TranscriptionError(502, 'transcription_failed', 'Provider failed');
      },
    },
  });

  const response = await invokeController(controller, {
    file: new File(['hello'], 'recording.webm', { type: 'audio/webm' }),
  });

  assert.equal(response.statusCode, 502);
  assert.deepEqual(JSON.parse(response.body), {
    error: 'Provider failed',
    code: 'transcription_failed',
  });
});

test('transcription controller returns transcript text for valid uploads', async () => {
  const controller = createTranscriptionController({
    env: {
      transcriptionMaxBytes: 1024,
    },
    transcriptionService: {
      async transcribeAudio({ mimeType, fileName }) {
        assert.equal(mimeType, 'audio/webm');
        assert.equal(fileName, 'recording.webm');
        return { text: '生成一张海报' };
      },
    },
  });

  const response = await invokeController(controller, {
    file: new File(['hello'], 'recording.webm', { type: 'audio/webm' }),
    language: 'zh',
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(JSON.parse(response.body), {
    text: '生成一张海报',
  });
});
