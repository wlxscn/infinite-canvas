import { createAssistantMessageService } from '../services/assistant-message.service.mjs';

export function createAssistantMessageController() {
  const assistantMessageService = createAssistantMessageService();

  return async function assistantMessageController(request, response) {
    const chunks = [];

    for await (const chunk of request) {
      chunks.push(chunk);
    }

    const raw = Buffer.concat(chunks).toString('utf8');
    const body = raw ? JSON.parse(raw) : {};
    const assistantMessage = await assistantMessageService.build(body);

    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ assistantMessage }));
  };
}
