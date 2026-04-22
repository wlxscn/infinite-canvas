## MODIFIED Requirements

### Requirement: Agent API persists canvas projects through backend project persistence
The system SHALL expose backend project persistence endpoints that save and load complete canvas project snapshots and SHALL expose the minimum project-management metadata needed to create, list, and rename canvas projects.

#### Scenario: Save a project snapshot
- **WHEN** the frontend sends a valid version 2 canvas project to the backend project save endpoint with a project identifier
- **THEN** the backend SHALL upsert that project snapshot and update the project's persistence timestamp

#### Scenario: Load an existing project snapshot
- **WHEN** the frontend requests a project identifier that exists in backend persistence
- **THEN** the backend SHALL return the stored canvas project snapshot and its project metadata

#### Scenario: List available projects
- **WHEN** the frontend requests the project-management list
- **THEN** the backend SHALL return project summaries containing identifiers and management metadata sufficient to render a recent-project list

#### Scenario: Create a project through the backend
- **WHEN** the frontend invokes a backend project-creation endpoint
- **THEN** the backend SHALL create a new project record with default project metadata and a valid empty canvas project snapshot

#### Scenario: Rename a project
- **WHEN** the frontend updates a project's title through the backend
- **THEN** the backend SHALL persist the updated project title without requiring the frontend to rewrite the entire project snapshot solely for renaming

#### Scenario: Backend configuration is unavailable
- **WHEN** backend persistence environment variables are missing or invalid
- **THEN** the backend SHALL return a recoverable service error for project-management requests without affecting chat, transcription, or generation routes
