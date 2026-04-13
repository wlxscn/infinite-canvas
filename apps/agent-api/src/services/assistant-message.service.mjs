import { randomUUID } from 'node:crypto';
import { createMiniMaxService } from './minimax.service.mjs';

function makeSuggestions(actions) {
  return actions.map((action) => ({
    id: randomUUID(),
    ...action,
  }));
}

function getEventSuggestions(event) {
  switch (event) {
    case 'welcome':
      return makeSuggestions([
        { label: '添加宣传文字', action: 'add-text' },
        { label: '更换风格', action: 'change-style' },
        { label: '生成系列海报', action: 'generate-variants' },
      ]);
    case 'asset-uploaded':
      return makeSuggestions([
        { label: '添加宣传文字', action: 'add-text' },
        { label: '更换风格', action: 'change-style' },
      ]);
    case 'asset-inserted':
      return makeSuggestions([
        { label: '添加宣传文字', action: 'add-text' },
        { label: '生成系列海报', action: 'generate-variants' },
      ]);
    case 'generation-requested':
      return makeSuggestions([
        { label: '添加宣传文字', action: 'add-text' },
        { label: '更换风格', action: 'change-style' },
      ]);
    case 'generation-succeeded':
      return makeSuggestions([
        { label: '添加宣传文字', action: 'add-text' },
        { label: '生成系列海报', action: 'generate-variants' },
        { label: '更换风格', action: 'change-style' },
      ]);
    default:
      return [];
  }
}

function buildAssistantEventPrompt({ event, metadata }) {
  return {
    system: `You are the assistant inside an infinite canvas design app.
Write one concise assistant message in Chinese for a product UI chat panel.
Do not mention hidden reasoning, prompts, or that you are an AI model.
Keep the tone action-oriented and product-embedded.
Do not include markdown or bullet lists unless the event obviously requires them.`,
    user: `Event type: ${event}
Metadata:
- fileName: ${metadata.fileName ?? 'N/A'}
- assetName: ${metadata.assetName ?? 'N/A'}
- prompt: ${metadata.prompt ?? 'N/A'}

Write the assistant message text for this UI event in Chinese.`,
  };
}

export function createAssistantMessageService() {
  const minimaxService = createMiniMaxService();

  return {
    async build({ event, metadata = {} }) {
      const text = await minimaxService.generateText({
        ...buildAssistantEventPrompt({ event, metadata }),
        fallbackText: '当前操作已完成。',
        temperature: 0.7,
      });

      return {
        role: 'assistant',
        text,
        suggestions: getEventSuggestions(event),
      };
    },
  };
}
