export function getEnv() {
  return {
    port: Number.parseInt(process.env.PORT ?? '8787', 10),
    llmDefaultTextProvider: process.env.LLM_DEFAULT_TEXT_PROVIDER ?? 'minimax',
    llmDefaultStreamProvider: process.env.LLM_DEFAULT_STREAM_PROVIDER ?? 'minimax',
    llmDefaultToolProvider: process.env.LLM_DEFAULT_TOOL_PROVIDER ?? 'minimax',
    llmDefaultTranscriptionProvider: process.env.LLM_DEFAULT_TRANSCRIPTION_PROVIDER ?? 'openai',
    openAiApiKey: process.env.OPENAI_API_KEY ?? '',
    openAiBaseUrl: process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1',
    openAiModel: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
    openAiTranscriptionModel: process.env.OPENAI_TRANSCRIPTION_MODEL ?? 'gpt-4o-mini-transcribe',
    anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? '',
    anthropicBaseUrl: process.env.ANTHROPIC_BASE_URL ?? 'https://api.anthropic.com/v1',
    anthropicModel: process.env.ANTHROPIC_MODEL ?? 'claude-3-5-sonnet-latest',
    geminiApiKey: process.env.GEMINI_API_KEY ?? '',
    geminiBaseUrl: process.env.GEMINI_BASE_URL ?? 'https://generativelanguage.googleapis.com/v1beta',
    geminiModel: process.env.GEMINI_MODEL ?? 'gemini-2.0-flash',
    glmApiKey: process.env.GLM_API_KEY ?? '',
    glmBaseUrl: process.env.GLM_BASE_URL ?? 'https://open.bigmodel.cn/api/paas/v4',
    glmModel: process.env.GLM_MODEL ?? 'glm-4.5',
    kimiApiKey: process.env.KIMI_API_KEY ?? '',
    kimiBaseUrl: process.env.KIMI_BASE_URL ?? 'https://api.moonshot.cn/v1',
    kimiModel: process.env.KIMI_MODEL ?? 'moonshot-v1-8k',
    transcriptionMaxBytes: Number.parseInt(process.env.TRANSCRIPTION_MAX_BYTES ?? `${10 * 1024 * 1024}`, 10),
    transcriptionTimeoutMs: Number.parseInt(process.env.TRANSCRIPTION_TIMEOUT_MS ?? '30000', 10),
    minimaxApiKey: process.env.MINIMAX_API_KEY ?? '',
    minimaxBaseUrl: process.env.MINIMAX_BASE_URL ?? 'https://api.minimaxi.com/v1',
    minimaxModel: process.env.MINIMAX_MODEL ?? 'MiniMax-M2.7',
    minimaxImageBaseUrl: process.env.MINIMAX_IMAGE_BASE_URL ?? 'https://api.minimaxi.com/v1',
    minimaxImageModel: process.env.MINIMAX_IMAGE_MODEL ?? 'image-01',
    minimaxVideoModel: process.env.MINIMAX_VIDEO_MODEL ?? 'MiniMax-Hailuo-02',
    minimaxVideoDurationSeconds: Number.parseInt(process.env.MINIMAX_VIDEO_DURATION_SECONDS ?? '6', 10),
    minimaxVideoResolution: process.env.MINIMAX_VIDEO_RESOLUTION ?? '1080P',
    minimaxVideoPollIntervalMs: Number.parseInt(process.env.MINIMAX_VIDEO_POLL_INTERVAL_MS ?? '10000', 10),
    minimaxVideoTimeoutMs: Number.parseInt(process.env.MINIMAX_VIDEO_TIMEOUT_MS ?? '600000', 10),
    supabaseUrl: process.env.SUPABASE_URL ?? '',
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
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

  if (!env.llmDefaultTextProvider) {
    throw new Error('LLM_DEFAULT_TEXT_PROVIDER must be configured.');
  }

  if (!env.llmDefaultStreamProvider) {
    throw new Error('LLM_DEFAULT_STREAM_PROVIDER must be configured.');
  }

  if (!env.llmDefaultToolProvider) {
    throw new Error('LLM_DEFAULT_TOOL_PROVIDER must be configured.');
  }

  if (!env.llmDefaultTranscriptionProvider) {
    throw new Error('LLM_DEFAULT_TRANSCRIPTION_PROVIDER must be configured.');
  }

  if (env.corsOrigins.length === 0) {
    throw new Error('CORS_ORIGIN must define at least one allowed origin.');
  }

  return env;
}
