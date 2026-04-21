## ADDED Requirements

### Requirement: Agent API stores generated media in Cloudflare
The system SHALL store generated image and video media in Cloudflare before returning a successful generation response to any frontend caller.

#### Scenario: Store generated image
- **WHEN** the agent API receives a successful image generation result from the configured media provider
- **THEN** the agent API SHALL download the generated image, upload it to Cloudflare storage with an image content type, and return the Cloudflare-hosted image URL

#### Scenario: Store generated video
- **WHEN** the agent API receives a successful video generation result and provider download URL
- **THEN** the agent API SHALL download the generated video, upload it to Cloudflare storage with a video content type, and return the Cloudflare-hosted video URL

### Requirement: Generated media URLs are stable application-owned URLs
The system SHALL expose generated media URLs that remain valid for persisted canvas projects without depending on provider temporary download URLs.

#### Scenario: Return application-owned media URL
- **WHEN** a generation request completes successfully
- **THEN** the returned `imageUrl` or `videoUrl` SHALL reference the configured Cloudflare media host rather than the provider source URL

#### Scenario: Persistable URL does not expire by default
- **WHEN** the frontend saves a generated asset URL inside project state
- **THEN** the URL SHALL be suitable for later project reload without requiring immediate URL re-signing

### Requirement: Media storage failures are recoverable generation failures
The system SHALL treat Cloudflare storage failures as generation failures instead of returning provider URLs as successful assets.

#### Scenario: Cloudflare storage is not configured
- **WHEN** a generated media request requires Cloudflare storage but the required Cloudflare configuration is missing
- **THEN** the agent API SHALL return a recoverable service error and SHALL NOT return the provider media URL as a successful result

#### Scenario: Cloudflare upload fails
- **WHEN** the provider generation succeeds but the Cloudflare upload fails
- **THEN** the agent API SHALL return a recoverable generation error and SHALL NOT expose the provider media URL to the frontend as a completed asset

### Requirement: Stored media objects carry usable metadata
The system SHALL store generated media objects with enough object metadata and headers for browser rendering, caching, and operational debugging.

#### Scenario: Store object headers
- **WHEN** the agent API uploads generated media to Cloudflare
- **THEN** it SHALL set the media content type and cache-related headers appropriate for browser rendering

#### Scenario: Store traceable object key
- **WHEN** the agent API creates a Cloudflare object key for generated media
- **THEN** the key SHALL distinguish image and video assets and include a collision-resistant identifier

### Requirement: Cloudflare-hosted media supports browser rendering
The system SHALL make Cloudflare-hosted generated media readable by the web application for image display, video playback, and video frame preview capture.

#### Scenario: Browser loads generated image
- **WHEN** the web app renders a generated image asset from the returned Cloudflare URL
- **THEN** the browser SHALL be able to load the image without requiring provider credentials

#### Scenario: Browser loads generated video for preview
- **WHEN** the web app loads a generated video asset from the returned Cloudflare URL
- **THEN** the browser SHALL be able to play the video and, when CORS policy allows, capture a frame for the canvas preview without requiring provider credentials
