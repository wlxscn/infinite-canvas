import { getEnv } from '../../config/env.mjs';
import { createLlmGatewayError, LlmGatewayError, LLM_ERROR_CODES } from './errors.mjs';
import { createProviderRegistry } from './providers.mjs';
import { LLM_CAPABILITIES } from './types.mjs';

function getDefaultProviderForCapability(env, capability) {
  switch (capability) {
    case LLM_CAPABILITIES.STREAM:
      return env.llmDefaultStreamProvider;
    case LLM_CAPABILITIES.CALL_TOOLS:
      return env.llmDefaultToolProvider;
    case LLM_CAPABILITIES.TRANSCRIBE:
      return env.llmDefaultTranscriptionProvider;
    case LLM_CAPABILITIES.COMPLETE:
    default:
      return env.llmDefaultTextProvider;
  }
}

export function createLlmGateway({ env = getEnv(), fetchImpl = globalThis.fetch, providerRegistry = null } = {}) {
  const registry = providerRegistry ?? createProviderRegistry({ env, fetchImpl });

  function resolveTarget({ capability, provider, model }) {
    const resolvedProvider = provider ?? getDefaultProviderForCapability(env, capability);
    const entry = registry[resolvedProvider];

    if (!entry) {
      throw createLlmGatewayError(400, LLM_ERROR_CODES.PROVIDER_UNSUPPORTED, `Unknown provider: ${resolvedProvider}`);
    }

    if (!entry.capabilities?.[capability]) {
      throw createLlmGatewayError(
        400,
        LLM_ERROR_CODES.CAPABILITY_UNSUPPORTED,
        `${resolvedProvider} does not support ${capability}`,
      );
    }

    const resolvedModel = model ?? entry.defaultModels?.[capability] ?? null;
    if (!resolvedModel) {
      throw createLlmGatewayError(
        400,
        LLM_ERROR_CODES.MODEL_UNSUPPORTED,
        `No default model configured for ${resolvedProvider} ${capability}`,
      );
    }

    return {
      provider: resolvedProvider,
      model: resolvedModel,
      adapter: entry.adapter,
    };
  }

  async function callAdapter(capability, request, methodName) {
    const { provider, model, adapter } = resolveTarget({
      capability,
      provider: request?.provider,
      model: request?.model,
    });

    try {
      return await adapter[methodName]({
        ...request,
        provider,
        model,
      });
    } catch (error) {
      if (error instanceof LlmGatewayError) {
        throw error;
      }

      throw createLlmGatewayError(502, LLM_ERROR_CODES.UPSTREAM_FAILED, `${provider} ${methodName} failed`, {
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    getProviderCapabilities() {
      return Object.fromEntries(
        Object.entries(registry).map(([provider, entry]) => [
          provider,
          {
            capabilities: entry.capabilities,
            defaultModels: entry.defaultModels,
          },
        ]),
      );
    },
    async complete(request) {
      return await callAdapter(LLM_CAPABILITIES.COMPLETE, request, 'complete');
    },
    async stream(request) {
      return await callAdapter(LLM_CAPABILITIES.STREAM, request, 'stream');
    },
    async callTools(request) {
      return await callAdapter(LLM_CAPABILITIES.CALL_TOOLS, request, 'callTools');
    },
    async transcribe(request) {
      return await callAdapter(LLM_CAPABILITIES.TRANSCRIBE, request, 'transcribe');
    },
  };
}

export { LlmGatewayError, LLM_ERROR_CODES } from './errors.mjs';
export { LLM_CAPABILITIES, LLM_PROVIDERS, LLM_STREAM_EVENT_TYPES, LLM_TOOL_CHOICE } from './types.mjs';
