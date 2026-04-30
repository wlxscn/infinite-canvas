export const LLM_CAPABILITIES = {
  COMPLETE: 'complete',
  STREAM: 'stream',
  CALL_TOOLS: 'callTools',
  TRANSCRIBE: 'transcribe',
};

export const LLM_STREAM_EVENT_TYPES = {
  TEXT_START: 'text-start',
  TEXT_DELTA: 'text-delta',
  TEXT_END: 'text-end',
  TOOL_CALL_START: 'tool-call-start',
  TOOL_CALL_DELTA: 'tool-call-delta',
  TOOL_CALL_END: 'tool-call-end',
  USAGE: 'usage',
  DONE: 'done',
  ERROR: 'error',
};

export const LLM_TOOL_CHOICE = {
  AUTO: 'auto',
  REQUIRED: 'required',
  NONE: 'none',
};

export const LLM_PROVIDERS = {
  OPENAI: 'openai',
  MINIMAX: 'minimax',
  VERCEL: 'vercel',
  ANTHROPIC: 'anthropic',
  GEMINI: 'gemini',
  GLM: 'glm',
  KIMI: 'kimi',
};
