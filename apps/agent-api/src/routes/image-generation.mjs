import { createImageGenerationController } from '../controllers/image-generation.controller.mjs';

const imageGenerationController = createImageGenerationController();

export async function handleImageGenerationRoute(request, response) {
  await imageGenerationController(request, response);
}
