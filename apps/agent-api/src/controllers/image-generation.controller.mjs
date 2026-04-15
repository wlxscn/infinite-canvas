import { createMiniMaxService } from '../services/minimax.service.mjs';

function getImageDimensions(aspectRatio) {
  switch (aspectRatio) {
    case '1:1':
      return { width: 1024, height: 1024 };
    case '9:16':
      return { width: 720, height: 1280 };
    case '4:3':
      return { width: 1152, height: 864 };
    case '3:2':
      return { width: 1248, height: 832 };
    case '2:3':
      return { width: 832, height: 1248 };
    case '3:4':
      return { width: 864, height: 1152 };
    case '21:9':
      return { width: 1344, height: 576 };
    case '16:9':
    default:
      return { width: 1280, height: 720 };
  }
}

export function createImageGenerationController() {
  const minimaxService = createMiniMaxService();

  return async function imageGenerationController(request, response) {
    const chunks = [];

    for await (const chunk of request) {
      chunks.push(chunk);
    }

    const raw = Buffer.concat(chunks).toString('utf8');
    const body = raw ? JSON.parse(raw) : {};
    const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
    const aspectRatio = typeof body.aspectRatio === 'string' ? body.aspectRatio : undefined;

    if (!prompt) {
      response.writeHead(400, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ error: 'prompt is required' }));
      return;
    }

    const result = await minimaxService.generateImage({ prompt, aspectRatio });

    if (!result) {
      response.writeHead(502, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ error: 'MiniMax image generation failed' }));
      return;
    }

    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(
      JSON.stringify({
        imageUrl: result.imageUrl,
        requestId: result.requestId,
        aspectRatio: result.aspectRatio,
        ...getImageDimensions(result.aspectRatio),
      }),
    );
  };
}
