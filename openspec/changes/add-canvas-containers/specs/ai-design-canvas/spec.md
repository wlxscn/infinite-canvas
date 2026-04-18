## MODIFIED Requirements

### Requirement: Canvas supports design-oriented nodes
The system SHALL support a board model that can represent image nodes and text nodes in addition to existing simple geometric content so users can compose design assets on the infinite canvas, and SHALL support container nodes that can own supported child nodes within a hierarchical document structure.

#### Scenario: Insert an uploaded image onto the board
- **WHEN** a user uploads an image asset and chooses to place it on the canvas
- **THEN** the system creates an image node on the board with position and size metadata

#### Scenario: Create a text node on the board
- **WHEN** a user invokes text creation and enters content
- **THEN** the system creates a text node that remains editable after placement

#### Scenario: Create a container node on the board
- **WHEN** a user invokes container creation from the editor
- **THEN** the system creates a container node that can later own supported child nodes within the board document

### Requirement: Canvas nodes remain directly editable
The system SHALL allow users to select supported canvas nodes and perform basic editing operations needed for layout composition, and SHALL keep those interactions responsive while preserving one committed undoable mutation per completed edit gesture. The system SHALL also distinguish between root-level editing and container-internal editing so node edits apply within the current navigation context.

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

#### Scenario: Edit a node inside a container context
- **WHEN** a user has entered a container editing context and drags or resizes a child node
- **THEN** the system applies that edit to the child node within the active container rather than treating it as a root-level board mutation

## ADDED Requirements

### Requirement: Canvas supports navigable editing containers
The system SHALL allow users to place supported nodes inside formal container nodes and navigate between root editing and container-internal editing contexts.

#### Scenario: Enter a container for internal editing
- **WHEN** a user selects a container and invokes enter-container editing
- **THEN** the system switches the active editing context from the board root to that container

#### Scenario: Exit a container back to root
- **WHEN** a user exits the active container editing context
- **THEN** the system restores the board root as the active editing context without losing the current document state

### Requirement: Container children use container-local geometry
The system SHALL represent child node geometry relative to the owning container so parent transforms can be resolved through the hierarchy.

#### Scenario: Move a container
- **WHEN** a user moves a container that owns child nodes
- **THEN** the system updates the container transform and preserves the child nodes' local geometry relative to that container

#### Scenario: Resolve a child for rendering in world space
- **WHEN** the renderer draws a child node that belongs to a container
- **THEN** the system resolves that child's world-space geometry from the container transform and the child node's local geometry

### Requirement: Selection and hit testing respect navigation context
The system SHALL scope hover, selection, and hit testing to the active editing context so users edit the intended layer of the hierarchy.

#### Scenario: Root context selects a container before its children
- **WHEN** a user is editing at the board root and clicks a visible container
- **THEN** the system selects the container as the top-level target instead of immediately selecting one of its child nodes

#### Scenario: Container context selects children inside the active container
- **WHEN** a user is editing inside a container and clicks a child node in that container
- **THEN** the system selects that child node within the active container context

### Requirement: Container structure remains compatible with persistence and history
The system SHALL persist container hierarchy in local project state while preserving undo/redo semantics and backward-readable loading for older flat projects.

#### Scenario: Restore a saved project with containers
- **WHEN** a user reloads a project that contains containers and child nodes
- **THEN** the system restores the same container hierarchy and editable child relationships from local persistence

#### Scenario: Load a legacy flat project after container support is introduced
- **WHEN** a user opens a project saved before container hierarchy existed
- **THEN** the system loads the project without requiring manual migration and treats existing nodes as root-level content

#### Scenario: Navigation does not create undo history entries
- **WHEN** a user enters or exits a container without changing document content
- **THEN** the system does not record that navigation step as a document mutation in undo/redo history

### Requirement: Connectors remain attached to concrete nodes across container boundaries
The system SHALL keep anchored connectors attached to specific nodes even when those nodes belong to containers, and SHALL resolve connector geometry through the hierarchy.

#### Scenario: Connected child node moves with its container
- **WHEN** a child node with anchored connectors is repositioned indirectly by moving its parent container
- **THEN** the system recomputes the connector endpoint world position from the child node's resolved geometry

#### Scenario: Connector spans nodes in different containers
- **WHEN** a connector attaches to nodes that belong to different containers or to different hierarchy levels
- **THEN** the system preserves the connector attachment to those concrete nodes and renders the connector using resolved world-space anchors
