## MODIFIED Requirements

### Requirement: Agent service orchestrates design chat with canvas-aware context
The system SHALL provide a service-backed design chat endpoint that accepts user chat input together with a summarized view of the current canvas context, routes model work through the configured unified LLM gateway, and returns an assistant response for the sidebar workflow.

#### Scenario: Agent service receives a design chat request
- **WHEN** the frontend sends a chat request with the user message and current canvas context
- **THEN** the agent service processes the request through the configured design-agent workflow via the unified LLM gateway and returns a structured assistant response

#### Scenario: Agent service preserves multi-turn conversation state
- **WHEN** a chat request includes a prior application conversation identifier or response pointer
- **THEN** the service continues the existing application conversation without requiring all providers to share the same continuation protocol

### Requirement: Agent service keeps tool execution on the server
The system SHALL route model-invoked tool decisions through the agent service and unified LLM gateway instead of exposing provider-specific model or tool orchestration directly to the frontend.

#### Scenario: Service executes the tool-routing workflow
- **WHEN** the design agent decides that a supported tool should be used
- **THEN** the backend orchestration layer obtains the normalized tool decision through the unified LLM gateway, resolves that tool decision on the server, and returns the resulting assistant output and effect payload to the frontend

#### Scenario: Frontend does not receive model credentials
- **WHEN** the web app interacts with the design agent
- **THEN** all provider credentials, provider-specific continuation state, and orchestration remain confined to the agent service runtime
