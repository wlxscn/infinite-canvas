## Context

The editor currently supports direct prompt submission and object manipulation, but it does not maintain a visible conversational workflow. Users can create or upload content, yet they have no structured place to ask follow-up questions, request revisions, or continue iterating through assistant-guided actions. The reference layout solves this by dedicating the right side of the experience to a persistent agent/chat surface.

This change is primarily UI and state orchestration, but it spans multiple modules because the current floating layout fills the full canvas width, and chat interactions need to coexist with existing generation state and board editing. The design should avoid introducing a full backend dependency in the first pass; the sidebar can initially run on top of local mock assistant behavior while establishing the correct product structure.

Likely modules involved:
- `src/App.tsx`: add the right-side sidebar layout, chat timeline, composer, and action chips
- `src/index.css`: reserve layout space for the sidebar and style the conversation surface
- `src/state/store.ts` or adjacent state helpers: extend local UI state to represent chat messages or assistant suggestions
- `src/types/canvas.ts`: add lightweight assistant/chat types if they belong in persisted project state
- `src/persistence/local.ts`: persist chat state if the conversation should survive refresh
- `tests/e2e/canvas.spec.ts`: add coverage for the new sidebar interaction path

## Goals / Non-Goals

**Goals:**
- Add a persistent right-side conversational panel to the editor.
- Allow users to send follow-up requests through a chat composer without leaving the canvas.
- Render assistant messages with suggested next-step actions relevant to design workflows.
- Keep the canvas and existing editing controls fully usable while the sidebar is present.
- Allow assistant interactions to reference current canvas context, even if initial responses are mocked locally.

**Non-Goals:**
- Integrate a production remote model provider in the first pass
- Build a full multi-agent orchestration system
- Replace direct editing controls with chat-only interaction
- Introduce collaborative chat or shared sessions across users

## Decisions

### 1. Add the sidebar as persistent editor chrome, not a modal

The assistant should live as a dedicated right-side column that remains visible while users work on the canvas.

Why:
- The reference direction depends on continuity between design actions and conversation.
- A persistent panel better supports iterative prompting and follow-up edits.

Alternative considered:
- Show the assistant only in a drawer or popover.
This was rejected because it weakens the sense of the assistant being a continuous copilot.

### 2. Model conversation as local UI state first

The first implementation should represent messages, suggested actions, and composer state locally, with mocked assistant replies driving the experience.

Why:
- This allows the product workflow to be validated without blocking on backend integration.
- The sidebar structure can later connect to a real service without major UI redesign.

Alternative considered:
- Leave the sidebar static until backend integration exists.
This was rejected because the core value of the sidebar is conversational iteration, not static decoration.

### 3. Preserve direct action shortcuts inside assistant replies

Assistant messages should be able to surface compact suggestion chips such as “添加宣传文字”, “更换风格”, or “生成系列海报”.

Why:
- These chips bridge conversation and concrete editor actions.
- They reduce friction for common follow-up steps.

Alternative considered:
- Limit the sidebar to plain text responses only.
This was rejected because it would underserve the interactive workflow shown in the reference.

### 4. Keep the canvas context lightweight but explicit

The assistant does not need full semantic understanding in the first pass, but it should know enough about recent generation requests, selected assets, or current board state to produce plausible contextual responses.

Why:
- Contextual awareness is what separates an agent sidebar from a generic chat box.
- Lightweight context keeps the implementation incremental.

Alternative considered:
- Ignore current board context and respond generically.
This was rejected because it would make the sidebar feel detached from the canvas.

## Risks / Trade-offs

- [Sidebar reduces available canvas width] → Use responsive layout rules and constrain the sidebar width so the board remains usable.
- [Chat state can sprawl quickly] → Keep initial message schema small and support a limited set of suggested action types.
- [Mock assistant behavior may feel simplistic] → Focus the first pass on believable workflow continuity rather than broad intelligence.
- [Persisting chat may complicate project state] → Decide explicitly whether chat belongs in saved project state or only session UI state before implementation.

## Migration Plan

- Add the sidebar structure to the current floating canvas layout.
- Introduce local conversation state and mocked assistant response generation.
- Connect existing prompt/generation actions to the sidebar flow so future interactions can continue in one place.
- Extend tests after the layout and message flow stabilize.

## Open Questions

- Should chat history persist across refreshes as part of the project, or reset per session?
- Should the assistant be aware of the currently selected node, or only recent generation and asset actions in the first pass?
- Which assistant suggestion chips should trigger real editor actions versus placeholder responses in the initial version?
