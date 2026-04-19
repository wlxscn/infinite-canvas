## 1. Backend Transcription API

- [x] 1.1 Add shared transcription request/response contracts and any required environment/config entries for the chosen transcription provider.
- [x] 1.2 Implement `apps/agent-api` transcription route/controller/service flow, including multipart parsing, audio validation, provider call, and JSON error responses.
- [x] 1.3 Register the new transcription route in `apps/agent-api/src/app.mjs` without changing the existing `/chat` streaming flow.

## 2. Chat Composer Voice Input

- [x] 2.1 Update the sidebar composer in `apps/web/src/App.tsx` to render a recording control beside the send button with explicit idle, recording, and transcribing states.
- [x] 2.2 Add frontend recording/upload helpers in the chat client layer so recorded audio can be posted to the new backend transcription endpoint.
- [x] 2.3 Populate the returned transcript into the existing chat input as editable draft text and ensure no chat message is created until the user presses send.

## 3. Validation And Coverage

- [x] 3.1 Add unit tests for backend transcription validation and frontend composer state transitions, including failure handling.
- [x] 3.2 Add or extend end-to-end coverage for the record -> transcribe -> edit -> send flow in the sidebar chat experience.
- [x] 3.3 Run relevant verification commands such as `pnpm lint`, targeted unit tests, and applicable e2e tests before applying the change.
