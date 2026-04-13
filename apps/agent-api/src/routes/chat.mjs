import { createChatController } from '../controllers/chat.controller.mjs';

const chatController = createChatController();

export async function handleChatRoute(request, response) {
  await chatController(request, response);
}
