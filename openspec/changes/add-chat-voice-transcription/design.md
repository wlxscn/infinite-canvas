## Context

The current sidebar chat flow is strictly text-based. In the web app, the composer is a `textarea` plus send button, and the frontend submits JSON requests to `POST /chat`. In the agent API, `chat.controller.mjs` reads the full request body as UTF-8 JSON and there is no route that accepts audio uploads or performs speech-to-text conversion.

This change is cross-cutting because it touches browser media capture, a new backend upload endpoint, shared contracts, and composer interaction states. It also introduces a new external dependency surface: multipart parsing plus a transcription provider call.

## Goals / Non-Goals

**Goals:**
- Add a dedicated backend transcription endpoint that accepts recorded audio for chat input.
- Place a recording button beside the existing send button in the sidebar composer.
- Support a tap-driven recording flow that starts from the composer, stops explicitly, sends audio for transcription, and returns transcript text to the composer.
- Keep the transcript editable before send, so the user remains in control of the final chat message.
- Preserve the current multi-session chat architecture and `/chat` streaming protocol.
- Keep persisted chat history unchanged until the user actually sends the composed text.

**Non-Goals:**
- Do not implement full real-time voice conversation or streaming speech recognition.
- Do not auto-send transcribed text to the assistant.
- Do not add synthesized assistant speech output.
- Do not redesign chat sessions, canvas persistence, or the existing `/chat` request contract beyond any minimal shared typing needed for the new endpoint.

## Decisions

### 1. Add a dedicated `POST /transcribe` endpoint instead of overloading `/chat`

The backend should expose a separate transcription route that accepts audio upload and returns `{ text }` JSON.

Why:
- Keeps `/chat` as a pure text conversation API.
- Avoids mixing streaming assistant responses with upload-oriented request handling.
- Makes transcription independently testable and reusable by the composer.

Alternative considered:
- Accept audio directly on `/chat` and transcribe internally before agent execution. Rejected because it blurs responsibilities and makes the request protocol significantly more complex.

### 2. Use backend-managed transcription rather than browser-native speech recognition

The frontend should record audio in the browser, but transcription should happen server-side through the agent API.

Why:
- Produces more consistent behavior across browsers.
- Centralizes model/provider selection and error handling.
- Keeps the product open to future language/model tuning without redesigning the UI contract.

Alternative considered:
- Browser-native transcription APIs. Rejected for the first version because support and accuracy vary by browser, especially for mixed Chinese/English design prompts.

### 3. Keep recording and transcription as a pre-send draft workflow

The recording button should only help produce input text. After transcription completes, the returned text is inserted into the existing composer and remains editable until the user presses send.

Why:
- Matches the current mental model of the sidebar as a text chat.
- Gives users a correction step for style terms, brand names, and mixed-language prompts.
- Avoids accidental message creation from low-confidence transcripts.

Alternative considered:
- Auto-send the transcript immediately after recognition. Rejected because it reduces user control and makes transcription errors user-visible in chat history.

### 4. Treat transcription state as ephemeral UI state, not persisted chat session data

Recording, transcribing, and draft transcript text should live in composer-local UI state. Only a sent message enters session history and persistence.

Why:
- Keeps existing session and persistence schemas stable.
- Avoids saving incomplete or abandoned transcript drafts into chat history.
- Limits compatibility risk with `sessions[]`, `conversationId`, and `previousResponseId`.

### 5. Accept uploaded audio as multipart form-data and validate narrow input constraints

The endpoint should accept multipart form-data with a single audio file field and return structured errors for unsupported media types, oversized payloads, empty audio, or upstream transcription failures.

Why:
- Multipart is the natural browser upload format for recorded blobs.
- Explicit validation prevents the chat service from receiving malformed data and keeps error handling user-visible.
- Narrow accepted formats reduce ambiguity around browser recorder output.

Alternative considered:
- Base64 audio inside JSON. Rejected because it bloats payloads and complicates frontend handling.

### 6. Extend existing modules instead of introducing a parallel chat subsystem

Frontend changes should stay close to the existing composer in `apps/web/src/App.tsx` and chat client utilities. Backend changes should mirror the current route/controller/service shape already used by `/chat`, `/generate-image`, and `/generate-video`.

Why:
- Fits the repository's current organization.
- Minimizes architectural churn for a focused product change.
- Keeps unit and e2e coverage aligned with the current app structure.

## Risks / Trade-offs

- [Browser recording formats differ across environments] -> Normalize supported MIME types in the frontend and validate them explicitly in the backend, with a clear unsupported-format error.
- [Transcription latency makes the composer feel stalled] -> Show distinct `recording` and `transcribing` states and keep manual send available only after text insertion.
- [Transcripts can mis-hear design terminology] -> Insert editable draft text instead of auto-sending and preserve the user's ability to revise before submit.
- [Multipart uploads add new attack/error surface] -> Enforce file size limits, accept one audio part only, and reject malformed requests early.
- [Local persistence could accidentally start storing half-finished transcripts] -> Keep draft transcript state outside session history until explicit send.
- [Provider outages or missing credentials block the feature] -> Return recoverable UI errors and leave the manual text composer usable as fallback.

## Migration Plan

1. Add shared transcription request/response typing and backend route wiring without touching `/chat`.
2. Implement multipart parsing and a transcription service abstraction that can call the chosen provider.
3. Add sidebar composer states for idle, recording, transcribing, and transcript-ready editing.
4. Wire the recording flow so the returned transcript populates the existing chat input without sending.
5. Add unit tests for request validation and composer state transitions, then e2e coverage for the full record-to-edit flow.
6. Roll out behind normal deployment; rollback is straightforward by removing the UI affordance and disabling the route because no persisted data migration is required.

## Open Questions

- Which transcription provider and model should be the default in this repo: OpenAI speech-to-text, another vendor, or an existing internal service?
- What maximum recording duration and upload size should the first version enforce?
- Which browser MIME types must be supported on day one, especially for Safari/iOS?
- Should tapping the record button a second time stop recording, or should the UI expose a separate stop action while keeping the control in the same composer area?
