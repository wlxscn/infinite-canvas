## MODIFIED Requirements

### Requirement: Agent service orchestrates design chat with canvas-aware context
The system SHALL provide a service-backed design chat endpoint that accepts user chat input together with a summarized view of the current canvas context, routes model operations through the configured server-side LLM provider, and returns an assistant response for the sidebar workflow.

#### Scenario: Agent service receives a design chat request
- **WHEN** the frontend sends a chat request with the user message and current canvas context
- **THEN** the agent service processes the request through the configured design-agent workflow and returns a structured assistant response

#### Scenario: Agent service preserves multi-turn conversation state
- **WHEN** a chat request includes a prior conversation identifier or response pointer
- **THEN** the service continues the existing conversation instead of treating the request as a new isolated exchange

#### Scenario: Agent service uses configured LLM provider for chat orchestration
- **WHEN** the agent-api is configured to use a supported LLM provider for text, streaming, or tool decisions
- **THEN** the design chat workflow routes those model operations through the internal LLM gateway without changing the frontend chat request or response contract

#### Scenario: Agent service uses Vercel AI Gateway when configured
- **WHEN** the agent-api text, stream, and tool provider defaults are configured as `vercel`
- **THEN** the design chat workflow uses Vercel AI Gateway for supported model operations while preserving server-side tool execution and structured effects
