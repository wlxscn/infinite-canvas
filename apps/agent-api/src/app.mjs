import { createServer } from 'node:http';
import { UI_MESSAGE_STREAM_HEADERS } from 'ai';
import { getEnv } from './config/env.mjs';
import { handleAssistantMessageRoute } from './routes/assistant-message.mjs';
import { handleHealthRoute } from './routes/health.mjs';
import { handleChatRoute } from './routes/chat.mjs';

export function createApp() {
  return createServer(async (request, response) => {
    const { corsOrigins } = getEnv();
    const requestOrigin = request.headers.origin;
    const allowOrigin = requestOrigin && corsOrigins.includes(requestOrigin) ? requestOrigin : corsOrigins[0];

    response.setHeader('access-control-allow-origin', allowOrigin);
    response.setHeader('vary', 'Origin');
    response.setHeader('access-control-allow-headers', 'content-type, accept');
    response.setHeader('access-control-allow-methods', 'GET,POST,OPTIONS');
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

    if (request.method === 'POST' && request.url === '/chat') {
      await handleChatRoute(request, response);
      return;
    }

    if (request.method === 'POST' && request.url === '/assistant-message') {
      await handleAssistantMessageRoute(request, response);
      return;
    }

    response.writeHead(404, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ error: 'Not found' }));
  });
}
