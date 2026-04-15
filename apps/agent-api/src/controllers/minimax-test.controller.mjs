import { createMiniMaxService } from '../services/minimax.service.mjs';
import { createToolRunnerService } from '../services/tool-runner.service.mjs';

export function createMiniMaxTestController() {
  const minimaxService = createMiniMaxService();
  const toolRunnerService = createToolRunnerService();

  return async function minimaxTestController(request, response) {
    const chunks = [];

    for await (const chunk of request) {
      chunks.push(chunk);
    }

    const raw = Buffer.concat(chunks).toString('utf8');
    const body = raw ? JSON.parse(raw) : {};
    const message = typeof body.message === 'string' && body.message.trim().length > 0 ? body.message.trim() : '请回复“minimax 通了”。';
    const useTools = body.useTools === true;
    const temperature = typeof body.temperature === 'number' ? body.temperature : 0.1;

    const result = await minimaxService.debugChatCompletion({
      messages: [
        {
          role: 'system',
          content: useTools
            ? 'You are a tool-calling assistant. If the user asks for a board mutation, prefer calling a tool.'
            : 'You are a concise assistant. Answer the user directly.',
        },
        { role: 'user', content: message },
      ],
      tools: useTools ? toolRunnerService.listTools() : undefined,
      temperature,
    });

    if (!result) {
      response.writeHead(502, { 'content-type': 'application/json' });
      response.end(
        JSON.stringify({
          ok: false,
          provider: 'minimax',
          error: 'MiniMax request failed. Check agent-api logs for upstream status/body.',
        }),
      );
      return;
    }

    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(
      JSON.stringify({
        ok: true,
        provider: 'minimax',
        useTools,
        summary: result.summary,
        message: result.payload?.choices?.[0]?.message ?? null,
      }),
    );
  };
}
