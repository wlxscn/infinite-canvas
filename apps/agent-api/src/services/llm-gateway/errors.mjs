export const LLM_ERROR_CODES = {
  PROVIDER_NOT_CONFIGURED: 'provider_not_configured',
  PROVIDER_UNSUPPORTED: 'provider_unsupported',
  MODEL_UNSUPPORTED: 'model_unsupported',
  CAPABILITY_UNSUPPORTED: 'capability_unsupported',
  UPSTREAM_TIMEOUT: 'upstream_timeout',
  UPSTREAM_RATE_LIMITED: 'upstream_rate_limited',
  UPSTREAM_AUTH_FAILED: 'upstream_auth_failed',
  UPSTREAM_INVALID_REQUEST: 'upstream_invalid_request',
  UPSTREAM_FAILED: 'upstream_failed',
  STREAM_PARSE_FAILED: 'stream_parse_failed',
  INVALID_TOOL_ARGUMENTS: 'invalid_tool_arguments',
  INVALID_TRANSCRIPTION_RESPONSE: 'invalid_transcription_response',
};

export class LlmGatewayError extends Error {
  constructor(statusCode, code, message, details = null) {
    super(message);
    this.name = 'LlmGatewayError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export function createLlmGatewayError(statusCode, code, message, details = null) {
  return new LlmGatewayError(statusCode, code, message, details);
}
