import { createTranscriptionController } from '../controllers/transcription.controller.mjs';

const transcriptionController = createTranscriptionController();

export async function handleTranscriptionRoute(request, response) {
  await transcriptionController(request, response);
}
