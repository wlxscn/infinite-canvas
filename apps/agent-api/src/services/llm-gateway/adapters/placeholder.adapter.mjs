import { createLlmGatewayError, LLM_ERROR_CODES } from '../errors.mjs';

function unsupported(provider, capability) {
  throw createLlmGatewayError(
    501,
    LLM_ERROR_CODES.PROVIDER_UNSUPPORTED,
    `${provider} adapter does not implement ${capability} yet`,
  );
}

export function createPlaceholderAdapter({ provider }) {
  return {
    provider,
    async complete() {
      unsupported(provider, 'complete');
    },
    async stream() {
      unsupported(provider, 'stream');
    },
    async callTools() {
      unsupported(provider, 'callTools');
    },
    async transcribe() {
      unsupported(provider, 'transcribe');
    },
  };
}
