import { AGENT_EFFECT_TYPES, CHAT_SUGGESTION_ACTIONS } from '../../../../packages/shared/src/runtime.mjs';

export function previewGenerateVariantTool({ message, canvasContext }) {
  const prompt = canvasContext?.latestPrompt
    ? `${canvasContext.latestPrompt} poster series variation`
    : message || 'poster series variation';

  return {
    action: 'generate_image_variant',
    effects: [{ type: AGENT_EFFECT_TYPES.START_GENERATION, prompt }],
    suggestions: [
      { id: 'suggest-variants', label: '生成系列海报', action: CHAT_SUGGESTION_ACTIONS.GENERATE_VARIANTS },
      { id: 'suggest-add-text', label: '添加宣传文字', action: CHAT_SUGGESTION_ACTIONS.ADD_TEXT },
    ],
  };
}
