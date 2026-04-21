import { createMiniMaxService } from '../services/minimax.service.mjs';
import {
  createMediaStorageService,
  GeneratedMediaStorageConfigError,
  GeneratedMediaStorageError,
} from '../services/media-storage.service.mjs';

function writeMediaStorageError(response, error) {
  if (error instanceof GeneratedMediaStorageConfigError) {
    response.writeHead(503, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ error: error.message, code: error.code }));
    return true;
  }

  if (error instanceof GeneratedMediaStorageError) {
    response.writeHead(502, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ error: error.message, code: error.code }));
    return true;
  }

  return false;
}

export function createVideoGenerationController({
  minimaxService = createMiniMaxService(),
  mediaStorageService = createMediaStorageService(),
} = {}) {

  return async function videoGenerationController(request, response) {
    const chunks = [];

    for await (const chunk of request) {
      chunks.push(chunk);
    }

    const raw = Buffer.concat(chunks).toString('utf8');
    const body = raw ? JSON.parse(raw) : {};
    const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
    const aspectRatio = typeof body.aspectRatio === 'string' ? body.aspectRatio : '16:9';
    const durationSeconds = typeof body.durationSeconds === 'number' ? body.durationSeconds : undefined;
    const resolution = typeof body.resolution === 'string' ? body.resolution.trim() : undefined;

    if (!prompt) {
      response.writeHead(400, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ error: 'prompt is required' }));
      return;
    }

    try {
      mediaStorageService.assertReady?.();
    } catch (error) {
      if (writeMediaStorageError(response, error)) {
        return;
      }

      throw error;
    }

    const result = await minimaxService.generateVideo({ prompt, durationSeconds, resolution });

    if (!result) {
      response.writeHead(502, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ error: 'MiniMax video generation failed' }));
      return;
    }

    let storedMedia;
    try {
      storedMedia = await mediaStorageService.storeGeneratedMedia({
        mediaType: 'video',
        sourceUrl: result.videoUrl,
        provider: 'minimax',
        requestId: result.requestId,
        taskId: result.taskId,
        fileId: result.fileId,
      });
    } catch (error) {
      if (writeMediaStorageError(response, error)) {
        return;
      }

      throw error;
    }

    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(
      JSON.stringify({
        videoUrl: storedMedia.url,
        posterUrl: result.posterUrl ?? null,
        requestId: result.requestId,
        taskId: result.taskId,
        fileId: result.fileId,
        aspectRatio,
        width: result.width,
        height: result.height,
        durationSeconds: result.durationSeconds,
        resolution: result.resolution,
        mimeType: 'video/mp4',
      }),
    );
  };
}
