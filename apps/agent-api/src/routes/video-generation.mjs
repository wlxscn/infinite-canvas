import { createVideoGenerationController } from '../controllers/video-generation.controller.mjs';

const videoGenerationController = createVideoGenerationController();

export async function handleVideoGenerationRoute(request, response) {
  await videoGenerationController(request, response);
}
