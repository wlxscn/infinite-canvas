export type AgentEffect =
  | { type: 'insert-text'; text: string }
  | { type: 'start-generation'; prompt: string }
  | { type: 'style-variation'; prompt: string }
  | { type: 'noop' };
