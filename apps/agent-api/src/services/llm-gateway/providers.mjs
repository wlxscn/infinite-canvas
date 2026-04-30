import { createMiniMaxAdapter } from './adapters/minimax.adapter.mjs';
import { createOpenAiAdapter } from './adapters/openai.adapter.mjs';
import { createPlaceholderAdapter } from './adapters/placeholder.adapter.mjs';
import { createVercelAiGatewayAdapter } from './adapters/vercel-ai-gateway.adapter.mjs';
import { LLM_CAPABILITIES, LLM_PROVIDERS } from './types.mjs';

export function createProviderRegistry({ env, fetchImpl = globalThis.fetch }) {
  return {
    [LLM_PROVIDERS.MINIMAX]: {
      adapter: createMiniMaxAdapter({ env, fetchImpl }),
      capabilities: {
        [LLM_CAPABILITIES.COMPLETE]: true,
        [LLM_CAPABILITIES.STREAM]: true,
        [LLM_CAPABILITIES.CALL_TOOLS]: true,
        [LLM_CAPABILITIES.TRANSCRIBE]: false,
      },
      defaultModels: {
        [LLM_CAPABILITIES.COMPLETE]: env.minimaxModel,
        [LLM_CAPABILITIES.STREAM]: env.minimaxModel,
        [LLM_CAPABILITIES.CALL_TOOLS]: env.minimaxModel,
      },
    },
    [LLM_PROVIDERS.OPENAI]: {
      adapter: createOpenAiAdapter({ env, fetchImpl }),
      capabilities: {
        [LLM_CAPABILITIES.COMPLETE]: true,
        [LLM_CAPABILITIES.STREAM]: true,
        [LLM_CAPABILITIES.CALL_TOOLS]: true,
        [LLM_CAPABILITIES.TRANSCRIBE]: true,
      },
      defaultModels: {
        [LLM_CAPABILITIES.COMPLETE]: env.openAiModel,
        [LLM_CAPABILITIES.STREAM]: env.openAiModel,
        [LLM_CAPABILITIES.CALL_TOOLS]: env.openAiModel,
        [LLM_CAPABILITIES.TRANSCRIBE]: env.openAiTranscriptionModel,
      },
    },
    [LLM_PROVIDERS.VERCEL]: {
      adapter: createVercelAiGatewayAdapter({ env, fetchImpl }),
      capabilities: {
        [LLM_CAPABILITIES.COMPLETE]: true,
        [LLM_CAPABILITIES.STREAM]: true,
        [LLM_CAPABILITIES.CALL_TOOLS]: true,
        [LLM_CAPABILITIES.TRANSCRIBE]: false,
      },
      defaultModels: {
        [LLM_CAPABILITIES.COMPLETE]: env.vercelAiGatewayModel,
        [LLM_CAPABILITIES.STREAM]: env.vercelAiGatewayModel,
        [LLM_CAPABILITIES.CALL_TOOLS]: env.vercelAiGatewayModel,
      },
    },
    [LLM_PROVIDERS.ANTHROPIC]: {
      adapter: createPlaceholderAdapter({ provider: LLM_PROVIDERS.ANTHROPIC }),
      capabilities: {
        [LLM_CAPABILITIES.COMPLETE]: true,
        [LLM_CAPABILITIES.STREAM]: true,
        [LLM_CAPABILITIES.CALL_TOOLS]: true,
        [LLM_CAPABILITIES.TRANSCRIBE]: false,
      },
      defaultModels: {
        [LLM_CAPABILITIES.COMPLETE]: env.anthropicModel,
        [LLM_CAPABILITIES.STREAM]: env.anthropicModel,
        [LLM_CAPABILITIES.CALL_TOOLS]: env.anthropicModel,
      },
    },
    [LLM_PROVIDERS.GEMINI]: {
      adapter: createPlaceholderAdapter({ provider: LLM_PROVIDERS.GEMINI }),
      capabilities: {
        [LLM_CAPABILITIES.COMPLETE]: true,
        [LLM_CAPABILITIES.STREAM]: true,
        [LLM_CAPABILITIES.CALL_TOOLS]: true,
        [LLM_CAPABILITIES.TRANSCRIBE]: false,
      },
      defaultModels: {
        [LLM_CAPABILITIES.COMPLETE]: env.geminiModel,
        [LLM_CAPABILITIES.STREAM]: env.geminiModel,
        [LLM_CAPABILITIES.CALL_TOOLS]: env.geminiModel,
      },
    },
    [LLM_PROVIDERS.GLM]: {
      adapter: createPlaceholderAdapter({ provider: LLM_PROVIDERS.GLM }),
      capabilities: {
        [LLM_CAPABILITIES.COMPLETE]: true,
        [LLM_CAPABILITIES.STREAM]: true,
        [LLM_CAPABILITIES.CALL_TOOLS]: true,
        [LLM_CAPABILITIES.TRANSCRIBE]: false,
      },
      defaultModels: {
        [LLM_CAPABILITIES.COMPLETE]: env.glmModel,
        [LLM_CAPABILITIES.STREAM]: env.glmModel,
        [LLM_CAPABILITIES.CALL_TOOLS]: env.glmModel,
      },
    },
    [LLM_PROVIDERS.KIMI]: {
      adapter: createPlaceholderAdapter({ provider: LLM_PROVIDERS.KIMI }),
      capabilities: {
        [LLM_CAPABILITIES.COMPLETE]: true,
        [LLM_CAPABILITIES.STREAM]: true,
        [LLM_CAPABILITIES.CALL_TOOLS]: true,
        [LLM_CAPABILITIES.TRANSCRIBE]: false,
      },
      defaultModels: {
        [LLM_CAPABILITIES.COMPLETE]: env.kimiModel,
        [LLM_CAPABILITIES.STREAM]: env.kimiModel,
        [LLM_CAPABILITIES.CALL_TOOLS]: env.kimiModel,
      },
    },
  };
}
