import { AGENT_EFFECT_TYPES, CHAT_SUGGESTION_ACTIONS } from '../../../../packages/shared/src/runtime.mjs';

export function previewChangeStyleTool({ message, canvasContext, args = {} }) {
  const requestedPrompt = typeof args.prompt === 'string' ? args.prompt.trim() : '';
  const styleDirection = typeof args.styleDirection === 'string' ? args.styleDirection.trim() : '';
  const fallbackPrompt = canvasContext?.latestPrompt
    ? `${canvasContext.latestPrompt}，风格改成${styleDirection || '更强烈的版式'}`
    : message || 'refresh the current style';
  const prompt = requestedPrompt || fallbackPrompt;

  return {
    action: 'change_canvas_style',
    effects: [{ type: AGENT_EFFECT_TYPES.STYLE_VARIATION, prompt, mediaType: 'image' }],
    toolResult: `Prepared a style variation request for the canvas. Prompt: ${prompt}`,
    suggestions: [
      { id: 'suggest-style', label: '更换风格', action: CHAT_SUGGESTION_ACTIONS.CHANGE_STYLE },
      { id: 'suggest-variants', label: '生成系列海报', action: CHAT_SUGGESTION_ACTIONS.GENERATE_VARIANTS },
    ],
  };
}
