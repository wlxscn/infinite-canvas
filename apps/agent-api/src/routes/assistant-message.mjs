import { createAssistantMessageController } from '../controllers/assistant-message.controller.mjs';

const assistantMessageController = createAssistantMessageController();

export async function handleAssistantMessageRoute(request, response) {
  await assistantMessageController(request, response);
}
