## ADDED Requirements

### Requirement: Canvas objects expose consistent hover and selection feedback
The system SHALL provide a consistent visual feedback hierarchy for hover and selection across supported canvas object types so users can predict what will be selected before committing an action.

#### Scenario: Hover preview on a selectable object
- **WHEN** a user moves the pointer over a selectable canvas object while not actively dragging, resizing, or editing another object
- **THEN** the system shows a lightweight hover preview for the top-most hit object without entering full editing mode

#### Scenario: Hover leaves empty space
- **WHEN** a user moves the pointer away from selectable objects onto empty canvas space
- **THEN** the system clears the hover preview and returns to the resting visual state

### Requirement: Selection and editing feedback use distinct visual layers
The system SHALL distinguish between selected objects and actively editable objects so users can understand whether an object is merely selected or currently exposing editable controls.

#### Scenario: Selected object enters contextual editing state
- **WHEN** a user selects a supported canvas object
- **THEN** the system shows a stable selected-state chrome and may surface contextual controls near that object

#### Scenario: Editable handles only appear in editing state
- **WHEN** an object is selected but not in a handle-editing interaction
- **THEN** the system does not escalate hover preview into full editable handle exposure unless the object type requires explicit edit handles for the current interaction

### Requirement: Connector editing feedback participates in the same interaction hierarchy
The system SHALL keep connector-specific anchor and handle affordances while aligning them with the shared hover, selected, and editing feedback model.

#### Scenario: Connector segment hover preview
- **WHEN** a user hovers a selectable connector segment in the select tool
- **THEN** the system shows connector hover feedback before selection using the same visual hierarchy as other objects

#### Scenario: Connector handles appear only during editable selection
- **WHEN** a user selects a connector and enters endpoint or waypoint editing
- **THEN** the system shows endpoint and bend-point handles as editing affordances without replacing the selected-state chrome
