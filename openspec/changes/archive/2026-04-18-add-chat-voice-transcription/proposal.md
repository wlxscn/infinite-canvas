## Why

The current chat sidebar only accepts typed text, which makes prompt entry slower on mobile and less natural during rapid design iteration. Adding a backend-backed transcription flow now lets users speak requests into the existing chat model without turning the product into a real-time voice assistant.

## What Changes

- Add a dedicated backend transcription endpoint in `agent-api` for uploaded chat recordings.
- Extend the chat composer with a recording button placed next to the send button.
- Support tap-to-start recording in the sidebar composer and a clear recording/transcribing state before the request returns.
- Insert the returned transcript into the existing chat input after transcription completes, keeping the text editable before the user sends it.
- Preserve the current `/chat` request flow, session model, and assistant streaming behavior; transcription prepares chat text but does not auto-send a message.
- Keep scope narrow: no assistant voice output, no full duplex voice chat, and no always-on/live transcription.

## Capabilities

### New Capabilities

### Modified Capabilities
- `ai-design-canvas`: Extend the sidebar chat workflow so users can capture speech, transcribe it through the backend, and edit the resulting text before sending a normal chat message.

## Impact

- Affected backend code will include `apps/agent-api/src/app.mjs`, a new transcription route/controller/service flow, request validation, and environment/config wiring for the transcription provider.
- Affected frontend code will include the sidebar composer in `apps/web/src/App.tsx`, chat-related client utilities, and any shared request/response contracts needed for transcription.
- Tests will need to cover browser recording states, transcription success/failure handling, and the invariant that transcripts do not create chat history until the user explicitly sends them.
- The change introduces a new media-upload API surface and likely a new dependency or helper for multipart parsing on the backend.
