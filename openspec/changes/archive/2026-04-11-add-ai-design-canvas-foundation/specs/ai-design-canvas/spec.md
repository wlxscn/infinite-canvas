## ADDED Requirements

### Requirement: Canvas supports design-oriented nodes
The system SHALL support a board model that can represent image nodes and text nodes in addition to existing simple geometric content so users can compose design assets on the infinite canvas.

#### Scenario: Insert an uploaded image onto the board
- **WHEN** a user uploads an image asset and chooses to place it on the canvas
- **THEN** the system creates an image node on the board with position and size metadata

#### Scenario: Create a text node on the board
- **WHEN** a user invokes text creation and enters content
- **THEN** the system creates a text node that remains editable after placement

### Requirement: Canvas nodes remain directly editable
The system SHALL allow users to select supported canvas nodes and perform basic editing operations needed for layout composition.

#### Scenario: Move a placed image
- **WHEN** a user selects an image node and drags it
- **THEN** the system updates the node position on the board

#### Scenario: Resize a placed node
- **WHEN** a user selects a supported node and performs a resize action
- **THEN** the system updates the node bounds while preserving a valid render state

#### Scenario: Reorder stacked objects
- **WHEN** a user changes the layer order of overlapping nodes
- **THEN** the system renders the nodes in the updated visual order

### Requirement: Assets persist independently from board placement
The system SHALL track uploaded and generated images as reusable assets separate from their placement on the board.

#### Scenario: Generated asset appears in asset storage
- **WHEN** an image generation job completes successfully
- **THEN** the resulting image is recorded as an asset that can be inserted into the board

#### Scenario: Asset remains available after refresh
- **WHEN** a user refreshes the application after uploading or generating an image
- **THEN** the asset remains available to reinsert or continue editing from local persistence

### Requirement: Generation jobs expose user-visible lifecycle state
The system SHALL represent image generation as a tracked job with visible status transitions.

#### Scenario: Pending generation is visible
- **WHEN** a user submits a generation request
- **THEN** the system creates a job record marked as pending and surfaces that status in the interface

#### Scenario: Failed generation remains inspectable
- **WHEN** a generation request fails
- **THEN** the system records the job as failed without corrupting existing board or asset state

### Requirement: Project state is recoverable and exportable
The system SHALL preserve the local-first editing loop by restoring project state after refresh and supporting export of current work.

#### Scenario: Restore project after reload
- **WHEN** a user reloads the application after editing a board with assets and text
- **THEN** the system restores the board content, assets, and relevant job history from local persistence

#### Scenario: Export current result
- **WHEN** a user requests export
- **THEN** the system provides an export of the current board result or project data without requiring external services
