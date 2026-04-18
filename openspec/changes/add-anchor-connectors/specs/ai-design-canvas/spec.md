## ADDED Requirements

### Requirement: Canvas nodes support anchored connectors
The system SHALL allow supported canvas nodes to be connected through anchored connectors so users can express stable relationships between elements on the board.

#### Scenario: Create a connector between two supported nodes
- **WHEN** a user uses the connector tool and drags from a valid anchor on one supported node to a valid anchor on another supported node
- **THEN** the system creates a connector object that remains attached to both nodes through those anchors

#### Scenario: Connector creation requires valid anchors
- **WHEN** a user starts connector creation but releases on empty space or an unsupported target
- **THEN** the system does not create a connector and exits the connector preview state without modifying the board

### Requirement: Anchored connectors stay synchronized with node geometry
The system SHALL recompute anchored connector endpoints from the connected nodes so connectors remain visually attached when node geometry changes.

#### Scenario: Connected node moves
- **WHEN** a user drags a node that has one or more anchored connectors
- **THEN** the connector endpoints update to the node's current anchor positions without breaking the attachment relationship

#### Scenario: Connected node resizes
- **WHEN** a user resizes a node that has one or more anchored connectors
- **THEN** the connector endpoints update to the resized node's current anchor positions

### Requirement: Anchored connectors are directly editable
The system SHALL allow users to select a connector and reattach its endpoints through anchor-based editing.

#### Scenario: Reattach a connector endpoint
- **WHEN** a user selects a connector and drags one endpoint handle to a valid anchor on another supported node
- **THEN** the system updates that endpoint attachment to the new node and anchor

#### Scenario: Invalid endpoint reattachment reverts
- **WHEN** a user drags a selected connector endpoint but releases without hitting a valid anchor
- **THEN** the system keeps the original endpoint attachment unchanged

### Requirement: Anchored connectors participate in persistence and history
The system SHALL persist anchored connectors in the local project document and include their mutations in undo/redo history.

#### Scenario: Connector survives reload
- **WHEN** a user creates one or more connectors and reloads the application
- **THEN** the system restores the connectors and their endpoint attachments from local persistence

#### Scenario: Undo connector creation
- **WHEN** a user creates a connector and then performs undo
- **THEN** the system removes the connector from the board and restores the previous board state

### Requirement: Connector relationships remain valid when nodes are removed
The system SHALL prevent dangling anchored connectors by removing connectors whose attached nodes are deleted.

#### Scenario: Delete a connected node
- **WHEN** a user deletes a node that is referenced by one or more connector endpoints
- **THEN** the system removes those connectors as part of the same mutation so no invalid attachment remains
