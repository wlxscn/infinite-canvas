## ADDED Requirements

### Requirement: Users can create a new canvas project from the workspace
The system SHALL let a user create a new empty canvas project from the product UI without overwriting the currently open project.

#### Scenario: Create a new canvas project
- **WHEN** a user invokes the create-new-canvas action from the workspace
- **THEN** the system SHALL create a new project identifier
- **AND** initialize a new empty canvas project for that identifier
- **AND** navigate the workspace to that new project

#### Scenario: New canvas project keeps previous project intact
- **WHEN** a user creates a new canvas while another project already exists
- **THEN** the system SHALL preserve the previously open project under its existing identifier
- **AND** SHALL NOT clear or overwrite that previous project's stored snapshot

### Requirement: Users can view and switch between recent canvas projects
The system SHALL provide a project-management entry that exposes recent or available canvas projects and allows switching between them.

#### Scenario: Show recent canvas projects
- **WHEN** a user opens the canvas-management entry point
- **THEN** the system SHALL show a list of recent or otherwise available projects with stable project identifiers and summary metadata

#### Scenario: Switch to another canvas project
- **WHEN** a user selects a different project from the canvas-management entry point
- **THEN** the system SHALL load that project's canvas snapshot into the workspace
- **AND** update the active project identifier used by the application

### Requirement: Canvas projects have independent project metadata
The system SHALL maintain project-level metadata separately from chat-session metadata so the workspace can identify and manage canvas projects consistently.

#### Scenario: New project gets a default title
- **WHEN** a user creates a new canvas project
- **THEN** the system SHALL assign a default project title suitable for display in project-management UI

#### Scenario: Project title is independent from chat titles
- **WHEN** a project contains one or more chat sessions with their own titles
- **THEN** the system SHALL keep the project title as separate project metadata rather than deriving it directly from a chat-session title

### Requirement: Project switching resets project-scoped runtime editor state
The system SHALL treat switching to another project as a workspace transition rather than as a same-project hydration event.

#### Scenario: Switching project resets transient editor state
- **WHEN** a user switches from one project to another
- **THEN** the system SHALL clear or reinitialize transient runtime editor state that belongs only to the previously active project
- **AND** SHALL NOT carry over stale selection, group-navigation, or undo/redo history into the newly active project

#### Scenario: Switching project preserves persisted document state
- **WHEN** a user switches to a different project
- **THEN** the system SHALL preserve that target project's persisted canvas content, assets, jobs, and project-scoped chat state

### Requirement: Canvas management remains usable with local-first fallback
The system SHALL keep canvas management usable when backend project-management capabilities are unavailable by relying on local project identity and local recent-project knowledge where possible.

#### Scenario: Backend project-management load fails
- **WHEN** the project-management list cannot be loaded from the backend because the backend is unavailable or misconfigured
- **THEN** the system SHALL continue to allow local project recovery and local project switching for projects known to the current browser where possible

#### Scenario: Backend create fails after local initialization
- **WHEN** a user creates a new canvas in an environment where backend project creation cannot complete
- **THEN** the system SHALL still keep the locally initialized project available for editing without blocking the workspace
