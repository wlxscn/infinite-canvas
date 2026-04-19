## ADDED Requirements

### Requirement: Unified gateway normalizes provider-backed text operations
The system SHALL provide a server-side LLM gateway that exposes a stable internal interface for text completion and text streaming without requiring business services to depend on provider-specific HTTP payloads.

#### Scenario: Business service requests a standard text completion
- **WHEN** an internal caller requests a text completion through the gateway with provider selection, model selection, messages, and generation options
- **THEN** the gateway returns a normalized result object containing assistant text, finish reason, usage metadata when available, and provider response identifiers without exposing provider-specific response shapes

#### Scenario: Business service requests text streaming
- **WHEN** an internal caller starts a streaming text request through the gateway
- **THEN** the gateway emits normalized stream events that preserve provider output order while hiding provider-specific SSE frame formats

### Requirement: Unified gateway standardizes tool calling semantics
The system SHALL expose a provider-neutral tool calling interface that accepts application tool definitions and returns normalized tool call results for downstream execution.

#### Scenario: Gateway requests tool selection from a provider
- **WHEN** an internal caller submits messages together with application tool definitions and a tool choice policy
- **THEN** the gateway maps those tools to the selected provider format, executes the upstream request, and returns normalized tool call records with tool name, call id, parsed arguments, raw arguments, and finish reason

#### Scenario: Provider returns invalid tool arguments
- **WHEN** the upstream provider returns tool arguments that cannot be parsed into the normalized tool call structure
- **THEN** the gateway returns a structured `invalid_tool_arguments` failure instead of silently passing malformed tool payloads to downstream services

### Requirement: Unified gateway separates application conversation state from provider continuation state
The system SHALL treat application conversation identity as a business concern and provider continuation pointers as provider-specific internal state.

#### Scenario: Application continues a multi-turn conversation
- **WHEN** the chat workflow continues an existing application conversation
- **THEN** the workflow can preserve the same application conversation identifier without assuming that every provider uses the same response pointer or session continuation mechanism

#### Scenario: Provider requires continuation metadata
- **WHEN** a selected provider requires response identifiers, session handles, or cached context keys to continue a conversation
- **THEN** the gateway stores or forwards that continuation metadata as provider state rather than requiring the caller to treat it as a provider-agnostic business field

### Requirement: Unified gateway exposes capability-aware failures
The system SHALL check provider/model capability support and return normalized error codes for unsupported or failed operations.

#### Scenario: Caller requests an unsupported capability
- **WHEN** an internal caller asks a provider/model combination to execute a capability that is not declared in the gateway capability registry
- **THEN** the gateway fails with a normalized `capability_unsupported` error before attempting the upstream request

#### Scenario: Upstream request fails
- **WHEN** a provider request fails because of authentication, timeout, rate limiting, or stream parsing problems
- **THEN** the gateway returns a normalized error code and error details that allow callers to log, surface, or retry the failure consistently across providers

### Requirement: Unified gateway supports audio transcription as a normalized operation
The system SHALL provide a normalized transcription interface so the service can invoke provider-backed audio transcription without hard-coding a specific provider protocol in business logic.

#### Scenario: Service submits audio for transcription
- **WHEN** an internal caller submits audio bytes, mime type, file name, and optional language to the gateway transcription interface
- **THEN** the gateway forwards the request through the selected provider adapter and returns a normalized transcription result containing the transcribed text

#### Scenario: Provider is not configured for transcription
- **WHEN** the selected provider lacks valid transcription credentials or transcription capability
- **THEN** the gateway returns a normalized configuration or capability error instead of attempting a partial transcription flow
