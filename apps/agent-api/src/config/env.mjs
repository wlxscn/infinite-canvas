export function getEnv() {
  return {
    port: Number.parseInt(process.env.PORT ?? '8787', 10),
    openAiApiKey: process.env.OPENAI_API_KEY ?? '',
    openAiBaseUrl: process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1',
    openAiTranscriptionModel: process.env.OPENAI_TRANSCRIPTION_MODEL ?? 'gpt-4o-mini-transcribe',
    transcriptionMaxBytes: Number.parseInt(process.env.TRANSCRIPTION_MAX_BYTES ?? `${10 * 1024 * 1024}`, 10),
    transcriptionTimeoutMs: Number.parseInt(process.env.TRANSCRIPTION_TIMEOUT_MS ?? '30000', 10),
    minimaxApiKey: process.env.MINIMAX_API_KEY ?? 'sk-api-5qdyUMdGTwsgP5x5xvmGbfIHKZ-NRxesPuXDIqhE5xFI-9sW9hq_wPXt8Lu0zqL6WiBwdZQPgmylYaEJfw6TfAfIPZqpTtktcNXih7octgIDXfMKJEwdgTQ',
    minimaxBaseUrl: process.env.MINIMAX_BASE_URL ?? 'https://api.minimaxi.com/v1',
    minimaxModel: process.env.MINIMAX_MODEL ?? 'MiniMax-M2.7',
    minimaxImageBaseUrl: process.env.MINIMAX_IMAGE_BASE_URL ?? 'https://api.minimaxi.com/v1',
    minimaxImageModel: process.env.MINIMAX_IMAGE_MODEL ?? 'image-01',
    minimaxVideoModel: process.env.MINIMAX_VIDEO_MODEL ?? 'MiniMax-Hailuo-02',
    minimaxVideoDurationSeconds: Number.parseInt(process.env.MINIMAX_VIDEO_DURATION_SECONDS ?? '6', 10),
    minimaxVideoResolution: process.env.MINIMAX_VIDEO_RESOLUTION ?? '1080P',
    minimaxVideoPollIntervalMs: Number.parseInt(process.env.MINIMAX_VIDEO_POLL_INTERVAL_MS ?? '10000', 10),
    minimaxVideoTimeoutMs: Number.parseInt(process.env.MINIMAX_VIDEO_TIMEOUT_MS ?? '600000', 10),
    corsOrigins: (process.env.CORS_ORIGIN ?? 'http://localhost:5173,http://127.0.0.1:5173')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  };
}

export function validateEnv() {
  const env = getEnv();

  if (!Number.isFinite(env.port) || env.port <= 0) {
    throw new Error('PORT must be a positive integer.');
  }

  if (!Number.isFinite(env.transcriptionMaxBytes) || env.transcriptionMaxBytes <= 0) {
    throw new Error('TRANSCRIPTION_MAX_BYTES must be a positive integer.');
  }

  if (!Number.isFinite(env.transcriptionTimeoutMs) || env.transcriptionTimeoutMs <= 0) {
    throw new Error('TRANSCRIPTION_TIMEOUT_MS must be a positive integer.');
  }

  if (env.corsOrigins.length === 0) {
    throw new Error('CORS_ORIGIN must define at least one allowed origin.');
  }

  return env;
}
