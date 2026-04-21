## MODIFIED Requirements

### Requirement: Assets persist independently from board placement
The system SHALL track uploaded and generated images as reusable assets separate from their placement on the board, and generated assets SHALL reference application-owned stable media URLs when backend generation succeeds.

#### Scenario: Generated asset appears in asset storage
- **WHEN** an image or video generation job completes successfully
- **THEN** the resulting media is recorded as an asset that can be inserted into the board

#### Scenario: Generated asset uses stable media URL
- **WHEN** a generated image or video asset is recorded after a backend generation response
- **THEN** the asset `src` SHALL reference the Cloudflare-hosted media URL returned by the agent API rather than a provider temporary URL

#### Scenario: Asset remains available after refresh
- **WHEN** a user refreshes the application after uploading or generating an image or video
- **THEN** the asset remains available to reinsert or continue editing from persisted project state when its stored media URL remains reachable

### Requirement: Generation jobs expose user-visible lifecycle state
The system SHALL represent image and video generation as tracked jobs with visible status transitions, while using the right-side design conversation as the primary user-facing generation entry and the left-side asset sidebar as the result landing zone.

#### Scenario: Pending generation is visible
- **WHEN** a user submits a generation request
- **THEN** the system creates a job record marked as pending and surfaces that status in the interface

#### Scenario: Failed generation remains inspectable
- **WHEN** a generation request fails, including failure to store generated media in Cloudflare
- **THEN** the system records the job as failed without corrupting existing board or asset state

#### Scenario: Generation no longer depends on a dedicated left-side prompt panel
- **WHEN** a user starts a first-pass generation from the workspace
- **THEN** the interaction is initiated through the right-side design conversation flow rather than a dedicated left-side prompt form
