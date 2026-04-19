## ADDED Requirements

### Requirement: Canvas nodes support unified groups
The system SHALL allow supported canvas nodes to be combined into a unified group object that can act both as a single editing unit and as an enterable hierarchy boundary.

#### Scenario: Group selected nodes
- **WHEN** a user invokes the group action on supported selected canvas nodes
- **THEN** the system creates a group object that contains those nodes and replaces direct individual manipulation with group-level selection

#### Scenario: Group multiple selected nodes in one action
- **WHEN** a user has multiple supported nodes selected within the same editing context and invokes the group action
- **THEN** the system creates one group containing all selected nodes from that context
- **AND** the resulting selection becomes the new group

#### Scenario: Group supports whole-object editing
- **WHEN** a user selects a group on the canvas without entering it
- **THEN** the system exposes move, resize, reorder, and delete behavior at the group level

### Requirement: Groups support internal editing context
The system SHALL allow users to enter a group and edit its child nodes within that group's hierarchy context, and SHALL allow them to exit back to the outer context.

#### Scenario: Enter a group
- **WHEN** a user invokes the enter-group action on a selected group
- **THEN** the system switches into that group's internal editing context and scopes hit-testing and selection to its child nodes

#### Scenario: Exit a group
- **WHEN** a user exits the active group editing context
- **THEN** the system returns to the outer editing context without changing the persisted document structure

### Requirement: Groups can be dissolved without losing child geometry
The system SHALL allow a previously created group to be dissolved back into its child nodes while preserving their visual placement and supported relationships.

#### Scenario: Ungroup restores child nodes
- **WHEN** a user invokes the ungroup action on a selected group
- **THEN** the system removes the group object and restores its child nodes as individually selectable nodes in the current editing context

#### Scenario: Ungroup preserves child world placement
- **WHEN** a user dissolves a group after moving or resizing it
- **THEN** the system restores each child node with world-space geometry that matches the visual result immediately before ungroup

### Requirement: Groups participate in persistence and history
The system SHALL persist groups in the local project document and include grouping mutations in undo and redo history while treating enter and exit as navigation state.

#### Scenario: Group survives reload
- **WHEN** a user creates a group and reloads the application
- **THEN** the system restores the group and its child structure from local persistence

#### Scenario: Undo grouping mutation
- **WHEN** a user creates or dissolves a group and then performs undo
- **THEN** the system restores the previous grouped or ungrouped document state as a single undoable mutation

### Requirement: Connectors and derived geometry remain stable across grouping
The system SHALL keep connector attachments and derived world-space geometry stable when child nodes move as part of a group or while editing inside a group.

#### Scenario: Group movement updates child-attached connectors
- **WHEN** a user moves a group containing one or more nodes with attached connectors
- **THEN** the system recomputes connector geometry from the moved child nodes without breaking the existing attachment relationships

#### Scenario: Grouped child still participates in derived overlays
- **WHEN** a grouped child node participates in hover, selection, snap, or anchor calculations
- **THEN** the system resolves its world-space geometry through the group hierarchy so visual feedback remains aligned with the rendered result
