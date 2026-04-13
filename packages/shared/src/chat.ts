export type ChatRole = 'user' | 'assistant';

export type ChatSuggestionAction = 'add-text' | 'change-style' | 'generate-variants';

export interface ChatSuggestion {
  id: string;
  label: string;
  action: ChatSuggestionAction;
}

export interface ChatMessage {
  id: string;
  role: ChatRole;
  text: string;
  createdAt: number;
  suggestions: ChatSuggestion[];
}
