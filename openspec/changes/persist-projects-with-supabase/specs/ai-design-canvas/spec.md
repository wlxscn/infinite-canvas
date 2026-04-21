## MODIFIED Requirements

### Requirement: Project state is recoverable and exportable
The system SHALL preserve the local-first editing loop by restoring project state after refresh, preferring backend project persistence when available, and supporting export of current work, while keeping persistence compatible with existing saved projects.

#### Scenario: Restore project after reload
- **WHEN** a user reloads the application after editing a board with assets and text
- **THEN** the system restores the board content, assets, relevant job history, and project-scoped chat sessions from backend persistence when available, or from local persistence when backend persistence is unavailable

#### Scenario: Export current result
- **WHEN** a user requests export
- **THEN** the system provides an export of the current board result or project data without requiring external services

#### Scenario: Existing saved projects remain readable after optimization changes
- **WHEN** a user opens a project saved before the interaction performance optimization
- **THEN** the system loads the project without requiring a document migration or losing persisted board state

#### Scenario: Existing local project seeds backend persistence
- **WHEN** backend persistence is enabled and the backend has no stored snapshot for the current project identifier
- **THEN** the system can continue from the locally cached project and persist that project snapshot to the backend on a subsequent save
