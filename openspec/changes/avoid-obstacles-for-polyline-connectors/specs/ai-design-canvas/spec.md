## MODIFIED Requirements

### Requirement: Anchored connectors support polyline paths
The system SHALL allow anchored connectors to be represented and edited as polyline paths with one or more intermediate bend points, and SHALL generate an obstacle-aware default path when a polyline connector is first created between valid anchors.

#### Scenario: Create a polyline connector
- **WHEN** a user creates a connector using the polyline path mode between two valid anchors
- **THEN** the system creates a connector whose rendered path includes intermediate bend points between the attached endpoints

#### Scenario: New polyline connector avoids middle elements by default
- **WHEN** a user creates a polyline connector between two valid anchors and there are other supported canvas elements between those endpoints in the current context
- **THEN** the system prefers a default orthogonal path whose intermediate bend points avoid intersecting those middle elements

#### Scenario: Polyline route falls back when obstacle-aware routing cannot produce a valid path
- **WHEN** a user creates a polyline connector and the obstacle-aware default routing step cannot produce a valid route
- **THEN** the system still creates the connector by falling back to the baseline default bend-point behavior instead of cancelling connector creation

#### Scenario: Edit polyline bend point
- **WHEN** a user selects a polyline connector and drags one of its bend point handles
- **THEN** the system updates that bend point and rerenders the connector path without breaking endpoint attachments

#### Scenario: Polyline connector survives reload
- **WHEN** a user saves or reloads a board containing polyline connectors
- **THEN** the system restores the connector path mode and bend points together with its endpoint attachments
