## ADDED Requirements

### Requirement: Editor chrome is canvas-first and visually lightweight
The system SHALL present the AI design canvas with a visually lightweight interface where the board remains the dominant surface and primary controls are expressed as compact floating chrome rather than heavy fixed panels.

#### Scenario: Open the editor
- **WHEN** a user loads the canvas editor
- **THEN** the interface presents a largely unobstructed board with compact floating controls for navigation and primary actions

#### Scenario: Access prompt and asset actions without full sidebars
- **WHEN** a user wants to generate content or insert existing assets
- **THEN** the system exposes those actions through compact floating surfaces that do not visually dominate the canvas

### Requirement: Object editing controls appear contextually near the selection
The system SHALL surface common object editing controls near the currently selected node so users can inspect and adjust the selection without relying solely on a distant full-height inspector.

#### Scenario: Select an object on the canvas
- **WHEN** a user selects a supported node
- **THEN** the interface shows a contextual floating toolbar near that selection with relevant controls or object metadata

#### Scenario: Edit dimensions from contextual controls
- **WHEN** a user adjusts object sizing or ordering from the contextual selection chrome
- **THEN** the system applies those changes while preserving the current editing behavior
