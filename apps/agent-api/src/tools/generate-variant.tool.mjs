import { AGENT_EFFECT_TYPES, CHAT_SUGGESTION_ACTIONS } from '../../../../packages/shared/src/runtime.mjs';

function isFollowUpImageRequest(message) {
  const normalized = message.trim().toLowerCase();
  return ['继续', '系列', '变体', '再来', '再生成', '继续生成', 'variants', 'variation', 'another'].some((keyword) =>
    normalized.includes(keyword),
  );
}

export function previewGenerateVariantTool({ message, canvasContext, args = {} }) {
  const trimmedMessage = message.trim();
  const requestedPrompt = typeof args.prompt === 'string' ? args.prompt.trim() : '';
  const shouldUseLatestPrompt = !trimmedMessage || isFollowUpImageRequest(trimmedMessage);
  const prompt =
    requestedPrompt ||
    (shouldUseLatestPrompt && canvasContext?.latestPrompt
      ? `${canvasContext.latestPrompt} poster series variation`
      : trimmedMessage || canvasContext?.latestPrompt || 'poster series variation');

  return {
    action: 'generate_image_variant',
    effects: [{ type: AGENT_EFFECT_TYPES.START_GENERATION, prompt, mediaType: 'image' }],
    toolResult: `Prepared an image generation request for the canvas. Prompt: ${prompt}`,
    suggestions: [
      { id: 'suggest-variants', label: '生成系列海报', action: CHAT_SUGGESTION_ACTIONS.GENERATE_VARIANTS },
      { id: 'suggest-add-text', label: '添加宣传文字', action: CHAT_SUGGESTION_ACTIONS.ADD_TEXT },
    ],
  };
}
