export function getEnv() {
  return {
    port: Number.parseInt(process.env.PORT ?? '8787', 10),
    openAiApiKey: process.env.OPENAI_API_KEY ?? '',
    minimaxApiKey: process.env.MINIMAX_API_KEY ?? 'sk-api-iD97p6BHhgKwxLauOZiwp7Qi15LEO450cxrSQUHdYwlVfInoYt7KllCv73rBUIAPvbpnK43uMhz-cmvorruV5-UZiIuG17ikraLi5WUQPVsvVfzcv4wlZ_Y',
    minimaxBaseUrl: process.env.MINIMAX_BASE_URL ?? 'https://api.minimaxi.com/v1',
    minimaxModel: process.env.MINIMAX_MODEL ?? 'MiniMax-M2.7',
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

  if (env.corsOrigins.length === 0) {
    throw new Error('CORS_ORIGIN must define at least one allowed origin.');
  }

  return env;
}
