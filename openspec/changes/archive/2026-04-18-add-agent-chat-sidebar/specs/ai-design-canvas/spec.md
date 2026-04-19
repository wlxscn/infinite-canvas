## ADDED Requirements

### Requirement: Editor provides a persistent right-side agent chat sidebar
The system SHALL provide a persistent chat-oriented sidebar on the right side of the canvas editor so users can continue design work through conversation while keeping the board visible.

#### Scenario: Open the editor with agent sidebar enabled
- **WHEN** a user opens the infinite canvas editor
- **THEN** the interface shows a right-side assistant panel that remains available alongside the canvas

#### Scenario: Keep canvas usable while sidebar is visible
- **WHEN** the sidebar is present
- **THEN** the canvas and existing editing controls remain usable without leaving the current board

### Requirement: Users can send iterative requests through the sidebar
The system SHALL allow users to enter follow-up requests in the sidebar so assistant interactions can continue beyond the initial generation action.

#### Scenario: Submit a follow-up request
- **WHEN** a user types a request in the sidebar composer and submits it
- **THEN** the system appends the user message and produces an assistant response in the same conversation thread

#### Scenario: Continue a previous design thread
- **WHEN** a user issues a second or later request in the same session
- **THEN** the sidebar preserves prior messages so the interaction reads as an ongoing conversation

### Requirement: Assistant replies can include suggested next actions
The system SHALL allow assistant responses to present relevant follow-up actions that help users continue editing or generation workflows.

#### Scenario: Show actionable suggestions after an assistant response
- **WHEN** the assistant returns a response about a design task
- **THEN** the interface presents one or more suggestion chips or buttons for likely next steps

#### Scenario: Trigger a suggested action
- **WHEN** a user chooses a suggested follow-up action from the assistant panel
- **THEN** the system initiates the corresponding editor or generation flow without breaking the conversation context
