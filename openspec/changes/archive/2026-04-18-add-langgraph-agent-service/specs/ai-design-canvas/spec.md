## ADDED Requirements

### Requirement: Sidebar chat uses a real agent service
The system SHALL connect the existing design chat sidebar to the agent service instead of generating assistant replies entirely in local mock frontend logic.

#### Scenario: Submit a sidebar message to the agent service
- **WHEN** a user sends a chat message from the sidebar
- **THEN** the frontend sends that message and current canvas context to the agent service and renders the returned assistant response in the conversation thread

#### Scenario: Continue chat after refresh with persisted service metadata
- **WHEN** a user refreshes the application during an active design conversation
- **THEN** the frontend restores locally persisted chat history and any stored conversation metadata needed to continue the same service-backed thread

### Requirement: Sidebar applies structured agent effects without replacing local board ownership
The system SHALL interpret structured agent effect payloads from the service and apply them through the existing frontend board state and interaction model.

#### Scenario: Agent effect inserts canvas text
- **WHEN** the agent service returns a text-insertion effect
- **THEN** the frontend applies that effect through the existing board state workflow so the new text node participates in local undo/redo and persistence behavior

#### Scenario: Agent effect starts a follow-up design action
- **WHEN** the agent service returns a style-variation or generation-follow-up effect
- **THEN** the frontend triggers the corresponding local canvas workflow without breaking the visible chat context
