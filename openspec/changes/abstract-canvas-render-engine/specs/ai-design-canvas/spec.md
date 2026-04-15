## ADDED Requirements

### Requirement: Canvas node behavior uses a shared engine contract
The system SHALL route supported canvas node behavior through a shared render-engine contract so rendering, bounds calculation, and hit testing stay consistent across node types.

#### Scenario: Existing supported node types render through the shared contract
- **WHEN** the application renders a board containing freehand, rectangular, text, image, or video nodes
- **THEN** the system resolves each supported node type through the shared engine contract instead of requiring separate hard-coded dispatch paths for render, bounds, and hit testing

#### Scenario: A supported node type exposes its behavior in one place
- **WHEN** a developer implements or updates behavior for a supported canvas node type
- **THEN** the node's rendering, bounds, and hit-testing behavior are defined through the same engine adapter or registry entry

### Requirement: Runtime rendering state remains separate from persisted project data
The system SHALL keep render-time caches and resource helpers out of the persisted canvas project schema so existing projects remain compatible with local persistence and history behavior.

#### Scenario: Runtime caches are recreated after loading a saved project
- **WHEN** the application restores a previously saved project from local persistence
- **THEN** the system recreates any render-time caches or resource lookup structures from the saved document data without requiring new persisted fields

#### Scenario: Undo and redo operate on document data rather than runtime cache state
- **WHEN** a user performs undo or redo after editing supported nodes
- **THEN** the system restores the document state without serializing or replaying transient render-engine cache data

## MODIFIED Requirements

### Requirement: Canvas nodes remain directly editable
The system SHALL allow users to select supported canvas nodes and perform basic editing operations needed for layout composition, with supported node behaviors routed through the shared render engine while preserving existing editing semantics.

#### Scenario: Move a placed image
- **WHEN** a user selects an image node and drags it
- **THEN** the system updates the node position on the board

#### Scenario: Resize a placed node
- **WHEN** a user selects a supported node and performs a resize action
- **THEN** the system updates the node bounds while preserving a valid render state

#### Scenario: Reorder stacked objects
- **WHEN** a user changes the layer order of overlapping nodes
- **THEN** the system renders the nodes in the updated visual order

#### Scenario: Edit freehand and rectangular nodes through the same engine boundary
- **WHEN** a user edits a freehand stroke or a rectangular node on the canvas
- **THEN** the system preserves the same move, resize, selection, and hit-test behavior through the shared render engine boundary
