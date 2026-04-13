import { getEnv } from '../config/env.mjs';

function stripThinkTags(text) {
  return text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
}

export function createMiniMaxService() {
  return {
    async generateText({ system, user, fallbackText, temperature = 1 }) {
      const env = getEnv();

      if (!env.minimaxApiKey) {
        return fallbackText;
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15_000);

      try {
        const response = await fetch(`${env.minimaxBaseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${env.minimaxApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: env.minimaxModel,
            messages: [
              { role: 'system', content: system },
              { role: 'user', content: user },
            ],
            temperature,
            stream: false,
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.warn('[agent-api/minimax] request failed', {
            status: response.status,
            body: errorText.slice(0, 500),
          });
          return fallbackText;
        }

        const payload = await response.json();
        const content = payload?.choices?.[0]?.message?.content;

        if (typeof content !== 'string' || content.trim().length === 0) {
          console.warn('[agent-api/minimax] empty content response', payload);
          return fallbackText;
        }

        return stripThinkTags(content);
      } catch (error) {
        console.warn('[agent-api/minimax] request error', {
          message: error instanceof Error ? error.message : String(error),
        });
        return fallbackText;
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}
