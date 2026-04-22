import { createServer } from 'node:http';
import { UI_MESSAGE_STREAM_HEADERS } from 'ai';
import { getEnv } from './config/env.mjs';
import { handleHealthRoute } from './routes/health.mjs';
import { handleChatRoute } from './routes/chat.mjs';
import { handleTranscriptionRoute } from './routes/transcription.mjs';
import { handleMiniMaxTestRoute } from './routes/minimax-test.mjs';
import { handleImageGenerationRoute } from './routes/image-generation.mjs';
import { handleVideoGenerationRoute } from './routes/video-generation.mjs';
import { handleProjectRoute, matchProjectRoute } from './routes/project.mjs';

export function createApp() {
  return createServer(async (request, response) => {
    const { corsOrigins } = getEnv();
    const requestOrigin = request.headers.origin;
    const allowOrigin = requestOrigin && corsOrigins.includes(requestOrigin) ? requestOrigin : corsOrigins[0];

    response.setHeader('access-control-allow-origin', allowOrigin);
    response.setHeader('vary', 'Origin');
    response.setHeader('access-control-allow-headers', 'content-type, accept');
    response.setHeader('access-control-allow-methods', 'GET,POST,PUT,PATCH,OPTIONS');
    response.setHeader(
      'access-control-expose-headers',
      ['content-type', ...Object.keys(UI_MESSAGE_STREAM_HEADERS)].join(', '),
    );

    if (request.method === 'OPTIONS') {
      response.writeHead(204);
      response.end();
      return;
    }

    if (!request.url) {
      response.writeHead(400, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ error: 'Missing request URL' }));
      return;
    }

    if (request.method === 'GET' && request.url === '/health') {
      handleHealthRoute(response);
      return;
    }

    const projectRoute = matchProjectRoute(request);
    if (projectRoute) {
      const handled = await handleProjectRoute(request, response, projectRoute.projectId);
      if (handled) {
        return;
      }
    }

    if (request.method === 'POST' && request.url === '/chat') {
      await handleChatRoute(request, response);
      return;
    }

    if (request.method === 'POST' && request.url === '/transcribe') {
      await handleTranscriptionRoute(request, response);
      return;
    }

    if (request.method === 'POST' && request.url === '/minimax-test') {
      await handleMiniMaxTestRoute(request, response);
      return;
    }

    if (request.method === 'POST' && request.url === '/generate-image') {
      await handleImageGenerationRoute(request, response);
      return;
    }

    if (request.method === 'POST' && request.url === '/generate-video') {
      await handleVideoGenerationRoute(request, response);
      return;
    }

    response.writeHead(404, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ error: 'Not found' }));
  });
}
