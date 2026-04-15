## ADDED Requirements

### Requirement: Sidebar chat composer supports voice transcription as a draft input path
The system SHALL let users create chat input from a recorded voice clip inside the sidebar composer without automatically sending a message to the assistant.

#### Scenario: User records a voice prompt from the chat composer
- **WHEN** the user taps the recording control beside the send button and grants microphone access
- **THEN** the system starts recording audio from the sidebar composer and shows that recording is in progress

#### Scenario: Transcript is editable before send
- **WHEN** the user stops recording and the backend transcription request succeeds
- **THEN** the system inserts the transcript into the existing chat input and leaves it editable until the user explicitly sends the message

#### Scenario: Transcription failure does not create chat history
- **WHEN** a transcription request fails because of upload validation, provider failure, or microphone issues
- **THEN** the system surfaces a recoverable error in the composer and does not append a new user message or assistant response to the active chat session

### Requirement: Agent API supports audio transcription for chat input
The system SHALL expose a backend endpoint that accepts recorded audio and returns transcribed text for the sidebar chat workflow.

#### Scenario: Valid audio upload returns transcript text
- **WHEN** the client submits a supported audio recording to the transcription endpoint
- **THEN** the system returns a successful response containing the transcribed text and no assistant chat side effects

#### Scenario: Unsupported upload is rejected
- **WHEN** the client submits an empty payload, an unsupported media type, or an invalid multipart request
- **THEN** the system rejects the request with a non-success response that explains the validation failure
