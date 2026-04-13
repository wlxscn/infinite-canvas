export const CHAT_SUGGESTION_ACTIONS = {
  ADD_TEXT: 'add-text',
  CHANGE_STYLE: 'change-style',
  GENERATE_VARIANTS: 'generate-variants',
};

export const AGENT_EFFECT_TYPES = {
  INSERT_TEXT: 'insert-text',
  START_GENERATION: 'start-generation',
  STYLE_VARIATION: 'style-variation',
  NOOP: 'noop',
};

export function createAgentChatResponse({
  conversationId,
  previousResponseId,
  assistantText,
  suggestions = [],
  effects = [],
}) {
  return {
    conversationId,
    previousResponseId,
    assistantMessage: {
      role: 'assistant',
      text: assistantText,
      suggestions,
    },
    effects,
  };
}
