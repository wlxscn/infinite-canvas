import { createToolRunnerService } from '../services/tool-runner.service.mjs';
import { createLlmGateway } from '../services/llm-gateway/index.mjs';

export function createMiniMaxTestController() {
  const llmGateway = createLlmGateway();
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
    const provider = typeof body.provider === 'string' && body.provider.trim() ? body.provider.trim() : 'minimax';

    try {
      const messages = [
        {
          role: 'system',
          content: useTools
            ? 'You are a tool-calling assistant. If the user asks for a board mutation, prefer calling a tool.'
            : 'You are a concise assistant. Answer the user directly.',
        },
        { role: 'user', content: message },
      ];
      const result = useTools
        ? await llmGateway.callTools({
            provider,
            messages,
            tools: toolRunnerService.listTools(),
            temperature,
          })
        : await llmGateway.complete({
            provider,
            messages,
            temperature,
          });

      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(
        JSON.stringify({
          ok: true,
          provider,
          useTools,
          summary: {
            finishReason: result.finishReason ?? null,
            textLength: result.assistantText?.length ?? result.text?.length ?? 0,
            toolCallCount: Array.isArray(result.toolCalls) ? result.toolCalls.length : 0,
          },
          message: useTools
            ? {
                role: 'assistant',
                content: result.assistantText ?? '',
                tool_calls: result.toolCalls ?? [],
              }
            : {
                role: 'assistant',
                content: result.text ?? '',
              },
        }),
      );
    } catch (error) {
      response.writeHead(502, { 'content-type': 'application/json' });
      response.end(
        JSON.stringify({
          ok: false,
          provider,
          error: error instanceof Error ? error.message : 'Gateway request failed',
        }),
      );
    }
  };
}
