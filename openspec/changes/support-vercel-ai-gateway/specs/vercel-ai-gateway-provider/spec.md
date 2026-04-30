## ADDED Requirements

### Requirement: Agent API can route LLM requests through Vercel AI Gateway
The system SHALL provide a `vercel` LLM provider that routes supported agent-api text operations through Vercel AI Gateway without requiring chat business logic to depend on Vercel-specific HTTP payloads.

#### Scenario: Gateway routes text completion through Vercel
- **WHEN** an internal caller requests a text completion using provider `vercel`
- **THEN** the LLM gateway sends the request to the configured Vercel AI Gateway chat completion endpoint and returns the normalized assistant text result

#### Scenario: Gateway routes text streaming through Vercel
- **WHEN** an internal caller requests a streaming text response using provider `vercel`
- **THEN** the LLM gateway emits normalized text stream events in provider output order while hiding Vercel Gateway response framing from the caller

#### Scenario: Gateway routes tool calling through Vercel
- **WHEN** an internal caller submits messages and application tool definitions using provider `vercel`
- **THEN** the LLM gateway maps the tools to the upstream request and returns normalized tool call records for server-side tool execution

### Requirement: Vercel AI Gateway provider is configured by environment
The system SHALL read Vercel AI Gateway base URL, credentials, and default model configuration from agent-api environment variables.

#### Scenario: Vercel provider has API key credentials
- **WHEN** the Vercel provider is selected and an AI Gateway API key is configured
- **THEN** the adapter authenticates upstream requests with that API key

#### Scenario: Vercel provider has OIDC token credentials
- **WHEN** the Vercel provider is selected, no AI Gateway API key is configured, and a Vercel OIDC token is configured
- **THEN** the adapter authenticates upstream requests with the OIDC token

#### Scenario: Vercel provider has no credentials
- **WHEN** the Vercel provider is selected without an API key or OIDC token
- **THEN** the adapter fails with a normalized provider configuration error before attempting an upstream request

#### Scenario: Vercel provider uses provider-model slug
- **WHEN** the Vercel provider builds an upstream request
- **THEN** the request model is the configured Vercel AI Gateway model slug in `provider/model` format or the explicit model supplied by the caller

### Requirement: Vercel provider participates in capability-aware routing
The system SHALL declare Vercel AI Gateway provider capabilities in the LLM provider registry so unsupported operations fail before upstream execution.

#### Scenario: Text capabilities are declared
- **WHEN** the LLM gateway reports provider capabilities
- **THEN** the `vercel` provider declares support for text completion, text streaming, and tool calling

#### Scenario: Transcription is not declared for Vercel
- **WHEN** an internal caller requests transcription using provider `vercel`
- **THEN** the LLM gateway fails with a normalized capability unsupported error without calling Vercel AI Gateway

### Requirement: Vercel provider maps upstream failures to normalized gateway errors
The system SHALL map Vercel AI Gateway upstream failures to the existing LLM Gateway error model.

#### Scenario: Vercel authentication fails
- **WHEN** Vercel AI Gateway returns an authentication or authorization failure
- **THEN** the adapter returns a normalized upstream authentication failure error

#### Scenario: Vercel rate limits a request
- **WHEN** Vercel AI Gateway rate limits a request
- **THEN** the adapter returns a normalized upstream rate-limited error

#### Scenario: Vercel request times out
- **WHEN** a Vercel AI Gateway request exceeds the configured timeout
- **THEN** the adapter returns a normalized upstream timeout error
