import { AGENT_EFFECT_TYPES, CHAT_SUGGESTION_ACTIONS } from '../../../../packages/shared/src/runtime.mjs';

export function previewAddTextTool({ message, canvasContext, args = {} }) {
  const selectedText = canvasContext?.selectedNode?.text;
  const requestedText = typeof args.text === 'string' ? args.text.trim() : '';
  const nextText = requestedText || (selectedText ? `优化：${selectedText}` : message || '新的标题文案');

  return {
    action: 'add_text_to_canvas',
    effects: [{ type: AGENT_EFFECT_TYPES.INSERT_TEXT, text: nextText }],
    toolResult: `Prepared text insertion for the canvas. Text: ${nextText}`,
    suggestions: [
      { id: 'suggest-add-text', label: '添加宣传文字', action: CHAT_SUGGESTION_ACTIONS.ADD_TEXT },
      { id: 'suggest-change-style', label: '更换风格', action: CHAT_SUGGESTION_ACTIONS.CHANGE_STYLE },
    ],
  };
}
