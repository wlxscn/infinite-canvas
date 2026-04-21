## ADDED Requirements

### Requirement: Agent API persists canvas projects through Supabase
The system SHALL expose backend project persistence endpoints that save and load complete canvas project snapshots through Supabase Postgres.

#### Scenario: Save a project snapshot
- **WHEN** the frontend sends a valid version 2 canvas project to the backend project save endpoint with a project identifier
- **THEN** the backend SHALL upsert that project snapshot into Supabase and update the project's persistence timestamp

#### Scenario: Load an existing project snapshot
- **WHEN** the frontend requests a project identifier that exists in Supabase
- **THEN** the backend SHALL return the stored canvas project snapshot and its project metadata

#### Scenario: Missing project
- **WHEN** the frontend requests a project identifier that does not exist in Supabase
- **THEN** the backend SHALL return a not-found response without creating a new project implicitly

#### Scenario: Supabase configuration is unavailable
- **WHEN** Supabase environment variables are missing or invalid
- **THEN** the backend SHALL return a recoverable service error for project persistence requests without affecting chat, transcription, or generation routes

### Requirement: Project identity is stable for backend persistence
The system SHALL use a stable project identifier for project persistence and agent chat requests so a browser session can continue saving and loading the same canvas project.

#### Scenario: First browser session creates a project identifier
- **WHEN** the frontend starts without an existing persisted project identifier
- **THEN** the frontend SHALL create a new project identifier and store it locally for subsequent project loads, project saves, and chat requests

#### Scenario: Existing browser session reuses project identifier
- **WHEN** the frontend starts with an existing locally stored project identifier
- **THEN** the frontend SHALL reuse that identifier when loading the project, saving the project, and sending agent chat requests

### Requirement: Frontend preserves local-first fallback behavior
The system SHALL keep local project persistence as a fallback cache while using the backend as the preferred project source when available.

#### Scenario: Backend project load succeeds
- **WHEN** the frontend starts and the backend returns a stored project snapshot
- **THEN** the frontend SHALL hydrate the editor from the backend project without adding the hydration step to undo history

#### Scenario: Backend project load fails
- **WHEN** the frontend starts and the backend project load fails because the backend is unavailable, misconfigured, or returns a recoverable error
- **THEN** the frontend SHALL continue with the locally cached project or an empty project without blocking canvas editing

#### Scenario: Backend project save fails
- **WHEN** the frontend attempts to save a changed project and the backend save fails
- **THEN** the frontend SHALL still update the local project cache and keep the editor usable

### Requirement: Backend project persistence uses project-scoped chat sessions
The system SHALL persist sidebar chat sessions as part of the canvas project snapshot rather than as a global conversation list.

#### Scenario: Save project with multiple chat sessions
- **WHEN** a project contains multiple sidebar chat sessions and an active session identifier
- **THEN** the backend SHALL store those sessions and the active session identifier inside the project snapshot

#### Scenario: Restore project-scoped chat sessions
- **WHEN** the frontend hydrates a project snapshot loaded from the backend
- **THEN** the sidebar SHALL render the restored project-scoped sessions and continue using each session's stored conversation metadata for subsequent agent-service requests

### Requirement: Initial backend persistence avoids collaborative conflict resolution
The system SHALL use a simple last-write-wins strategy for project saves until explicit collaboration or conflict handling is introduced.

#### Scenario: Multiple clients save the same project
- **WHEN** two clients save different snapshots for the same project identifier
- **THEN** the backend SHALL persist the most recently accepted save as the current project snapshot

