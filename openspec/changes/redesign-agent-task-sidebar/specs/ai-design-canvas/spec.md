## MODIFIED Requirements

### Requirement: Editor provides a persistent right-side agent chat sidebar
The system SHALL provide a persistent task-oriented assistant sidebar on the right side of the canvas editor so users can continue design work through collaboration while keeping the board visible.

#### Scenario: Open the editor with assistant sidebar enabled
- **WHEN** a user opens the infinite canvas editor
- **THEN** the interface shows a right-side assistant panel that remains available alongside the canvas

#### Scenario: Keep canvas usable while sidebar is visible
- **WHEN** the sidebar is present
- **THEN** the canvas and existing editing controls remain usable without leaving the current board

#### Scenario: Active task summary is prioritized above the conversation log
- **WHEN** the sidebar has an active chat session
- **THEN** the interface presents the current task summary and task status before the detailed conversation log

### Requirement: Sidebar chat supports explicit session-based conversations
The system SHALL support multiple sidebar chat sessions within the same canvas project, SHALL allow the project to have no active session by default, and SHALL expose non-active sessions as historical task threads rather than the primary focus of the sidebar.

#### Scenario: Sidebar shows empty-state when no session exists
- **WHEN** a project has no chat sessions
- **THEN** the sidebar shows an empty-state UI instead of rendering a conversation thread

#### Scenario: User creates a new session
- **WHEN** a user creates a new chat session from the sidebar
- **THEN** the system creates a new active session with an empty message list

#### Scenario: User switches between sessions
- **WHEN** a user selects a different chat session in the sidebar
- **THEN** the sidebar renders that session as the current task thread and uses that session's conversation identifiers for subsequent agent-service requests

#### Scenario: Historical sessions remain accessible without replacing the current-task layout
- **WHEN** a project contains multiple chat sessions
- **THEN** the sidebar keeps a visible entry point for historical sessions while preserving the active session's task summary and execution state as the primary content

### Requirement: Assistant replies can include suggested next actions
The system SHALL allow assistant responses to present relevant follow-up actions that help users continue editing or generation workflows, and SHALL surface the latest applicable suggestions as task-level next actions for the active session.

#### Scenario: Show actionable suggestions after an assistant response
- **WHEN** the assistant returns a response about a design task
- **THEN** the interface presents one or more suggestion chips or buttons for likely next steps

#### Scenario: Promote latest suggestions into a task-level next-actions area
- **WHEN** the active session has recent assistant suggestions
- **THEN** the sidebar shows those suggestions in a dedicated next-actions area that is separate from the scrollable conversation log

#### Scenario: Trigger a suggested action
- **WHEN** a user chooses a suggested follow-up action from the assistant panel
- **THEN** the system initiates the corresponding editor or generation flow without breaking the conversation context

## ADDED Requirements

### Requirement: Sidebar surfaces a derived current task and execution timeline
The system SHALL derive a current-task view for the active session from existing chat messages, structured agent effects, generation jobs, and chat transport state so users can understand what the assistant is doing without parsing the entire conversation transcript.

#### Scenario: Derive a task title from the current turn
- **WHEN** the active session has a latest user request
- **THEN** the sidebar shows that request, or a concise summary derived from it, as the current task title

#### Scenario: Show generation progress for a pending media task
- **WHEN** the active session has triggered a generation follow-up and the corresponding generation job remains pending
- **THEN** the sidebar shows the task as in progress and includes a visible execution step indicating that generation is underway

#### Scenario: Show a non-mutating status for a pure conversational reply
- **WHEN** the assistant responds with text and no structured canvas effect or generation job is active
- **THEN** the sidebar shows the interaction as a conversational task rather than falsely presenting a canvas mutation step

#### Scenario: Show failed execution state without losing conversation continuity
- **WHEN** the relevant chat request or generation job fails
- **THEN** the sidebar marks the current task as failed while preserving the session history and allowing follow-up input
