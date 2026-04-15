## ADDED Requirements

### Requirement: Canvas viewport interactions remain responsive during active manipulation
The system SHALL keep pan, pinch, and wheel-zoom interactions visually responsive by avoiding unnecessary non-canvas work on each input frame and by applying viewport updates on a paint-aligned schedule.

#### Scenario: Panning does not require app-wide committed state on every pointer frame
- **WHEN** a user pans the canvas continuously
- **THEN** the system updates the visible viewport responsively without requiring a committed whole-project store update for each raw pointer event

#### Scenario: Zooming remains paint-aligned
- **WHEN** a user performs continuous wheel zoom or pinch zoom
- **THEN** the system applies viewport changes on a paint-aligned schedule that preserves direct manipulation feel

### Requirement: Automatic persistence does not block active canvas manipulation
The system SHALL preserve local-first project saving without synchronously serializing and writing the entire project on every active drag, resize, pan, or zoom frame.

#### Scenario: Dragging defers automatic save work
- **WHEN** a user continuously drags or resizes a node
- **THEN** automatic persistence does not synchronously write the full project on each intermediate movement frame

#### Scenario: Committed edits still become recoverable
- **WHEN** a user finishes an interaction that changes the board
- **THEN** the system persists the committed project state soon after completion so the latest board remains recoverable after refresh

## MODIFIED Requirements

### Requirement: Canvas nodes remain directly editable
The system SHALL allow users to select supported canvas nodes and perform basic editing operations needed for layout composition, and SHALL keep those interactions responsive while preserving one committed undoable mutation per completed edit gesture.

#### Scenario: Move a placed image
- **WHEN** a user selects an image node and drags it
- **THEN** the system updates the node position on the board

#### Scenario: Resize a placed node
- **WHEN** a user selects a supported node and performs a resize action
- **THEN** the system updates the node bounds while preserving a valid render state

#### Scenario: Reorder stacked objects
- **WHEN** a user changes the layer order of overlapping nodes
- **THEN** the system renders the nodes in the updated visual order

#### Scenario: Drag interaction commits as one undoable change
- **WHEN** a user completes a drag or resize gesture that changes a node
- **THEN** the system records the completed gesture as a single undoable mutation rather than one history entry per intermediate movement frame

### Requirement: Project state is recoverable and exportable
The system SHALL preserve the local-first editing loop by restoring project state after refresh and supporting export of current work, while keeping persistence compatible with existing saved projects.

#### Scenario: Restore project after reload
- **WHEN** a user reloads the application after editing a board with assets and text
- **THEN** the system restores the board content, assets, and relevant job history from local persistence

#### Scenario: Export current result
- **WHEN** a user requests export
- **THEN** the system provides an export of the current board result or project data without requiring external services

#### Scenario: Existing saved projects remain readable after optimization changes
- **WHEN** a user opens a project saved before the interaction performance optimization
- **THEN** the system loads the project without requiring a document migration or losing persisted board state
