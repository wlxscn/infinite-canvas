## MODIFIED Requirements

### Requirement: Project state is recoverable and exportable
The system SHALL preserve the local-first editing loop by restoring project state after refresh, preferring backend project persistence when available, supporting export of current work, and allowing the user to move between managed canvas projects without corrupting project-scoped editor state.

#### Scenario: Restore current project after reload
- **WHEN** a user reloads the application while working in a specific managed canvas project
- **THEN** the system restores that project's board content, assets, relevant job history, and project-scoped chat sessions from backend persistence when available, or from local persistence when backend persistence is unavailable

#### Scenario: Switch to another managed project
- **WHEN** a user navigates from the currently open canvas project to a different managed canvas project
- **THEN** the system loads the target project's persisted state as the active workspace document
- **AND** resets transient editor state that belonged only to the previously active project

#### Scenario: Export current result
- **WHEN** a user requests export
- **THEN** the system provides an export of the current board result or project data without requiring external services

#### Scenario: Existing saved projects remain readable after canvas-management changes
- **WHEN** a user opens a project saved before canvas-management support was introduced
- **THEN** the system loads the project without requiring a document migration or losing persisted board state
