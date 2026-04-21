## MODIFIED Requirements

### Requirement: Agent service returns structured tool effects
The system SHALL allow the design agent to return structured tool-effect intents that the frontend can apply without giving the backend direct ownership of the board document, and media-generation effects SHALL reference Cloudflare-hosted generated media when media generation succeeds.

#### Scenario: Agent requests text insertion
- **WHEN** the design agent determines that the next step is to add text to the canvas
- **THEN** the service returns a tool effect describing the requested text insertion action in a machine-readable format

#### Scenario: Agent requests a style or generation follow-up
- **WHEN** the design agent determines that a style change or generation follow-up should occur
- **THEN** the service returns a structured effect describing the next action and any prompt payload needed by the frontend

#### Scenario: Agent returns generated image effect
- **WHEN** the design agent tool workflow completes image generation successfully
- **THEN** the service returns an `insert-image` effect whose `imageUrl` references the Cloudflare-hosted image URL

#### Scenario: Agent returns generated video effect
- **WHEN** the design agent tool workflow completes video generation successfully
- **THEN** the service returns an `insert-video` effect whose `videoUrl` references the Cloudflare-hosted video URL

### Requirement: Agent service keeps tool execution on the server
The system SHALL route model-invoked tool decisions and generated-media storage through the agent service instead of exposing model, provider, storage, or tool orchestration directly to the frontend.

#### Scenario: Service executes the tool-routing workflow
- **WHEN** the design agent decides that a supported tool should be used
- **THEN** the backend orchestration layer resolves that tool decision and returns the resulting assistant output and effect payload to the frontend

#### Scenario: Frontend does not receive model credentials
- **WHEN** the web app interacts with the design agent
- **THEN** all model credentials and orchestration remain confined to the agent service runtime

#### Scenario: Frontend does not receive Cloudflare credentials
- **WHEN** the web app receives a generated media effect
- **THEN** all Cloudflare storage credentials and upload operations SHALL remain confined to the agent service runtime
