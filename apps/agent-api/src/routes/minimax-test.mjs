import { createMiniMaxTestController } from '../controllers/minimax-test.controller.mjs';

const minimaxTestController = createMiniMaxTestController();

export async function handleMiniMaxTestRoute(request, response) {
  await minimaxTestController(request, response);
}
