## Purpose

Define the baseline requirements for the backend agent chat service that powers canvas-aware design conversations and returns structured effects to the frontend.
## Requirements
### Requirement: Agent service orchestrates design chat with canvas-aware context
The system SHALL provide a service-backed design chat endpoint that accepts user chat input together with a summarized view of the current canvas context and returns an assistant response for the sidebar workflow.

#### Scenario: Agent service receives a design chat request
- **WHEN** the frontend sends a chat request with the user message and current canvas context
- **THEN** the agent service processes the request through the configured design-agent workflow and returns a structured assistant response

#### Scenario: Agent service preserves multi-turn conversation state
- **WHEN** a chat request includes a prior conversation identifier or response pointer
- **THEN** the service continues the existing conversation instead of treating the request as a new isolated exchange

### Requirement: Agent service returns structured tool effects
The system SHALL allow the design agent to return structured tool-effect intents that the frontend can apply without giving the backend direct ownership of the board document.

#### Scenario: Agent requests text insertion
- **WHEN** the design agent determines that the next step is to add text to the canvas
- **THEN** the service returns a tool effect describing the requested text insertion action in a machine-readable format

#### Scenario: Agent requests a style or generation follow-up
- **WHEN** the design agent determines that a style change or generation follow-up should occur
- **THEN** the service returns a structured effect describing the next action and any prompt payload needed by the frontend

### Requirement: Agent service keeps tool execution on the server
The system SHALL route model-invoked tool decisions through the agent service instead of exposing model or tool orchestration directly to the frontend.

#### Scenario: Service executes the tool-routing workflow
- **WHEN** the design agent decides that a supported tool should be used
- **THEN** the backend orchestration layer resolves that tool decision and returns the resulting assistant output and effect payload to the frontend

#### Scenario: Frontend does not receive model credentials
- **WHEN** the web app interacts with the design agent
- **THEN** all model credentials and orchestration remain confined to the agent service runtime

