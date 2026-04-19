## MODIFIED Requirements

### Requirement: Sidebar chat supports explicit session-based conversations
The system SHALL support multiple sidebar chat sessions within the same canvas project and SHALL allow the project to have no active session by default.

#### Scenario: Sidebar shows empty-state when no session exists
- **WHEN** a project has no chat sessions
- **THEN** the sidebar shows an empty-state UI instead of rendering a conversation thread

#### Scenario: User creates a new session
- **WHEN** a user creates a new chat session from the sidebar
- **THEN** the system creates a new active session with an empty message list

#### Scenario: User switches between sessions
- **WHEN** a user selects a different chat session in the sidebar
- **THEN** the sidebar renders the selected session's messages and uses that session's conversation identifiers for subsequent agent-service requests

### Requirement: Session switching does not branch the shared board state
The system SHALL treat chat sessions as conversation contexts around one shared canvas, not as separate board snapshots.

#### Scenario: Switching sessions preserves board content
- **WHEN** a user switches from one chat session to another
- **THEN** the current board, assets, jobs, and viewport remain unchanged

### Requirement: Legacy single-thread chat is not auto-migrated into a visible default session
The system SHALL not create a visible default session from legacy single-thread chat data when multi-session chat is enabled.

#### Scenario: Load a legacy project with old chat fields
- **WHEN** a previously saved project contains only the legacy single-thread chat shape
- **THEN** the project remains readable, but the sidebar does not surface that legacy thread as an auto-created session
