## 1. Sidebar Layout

- [x] 1.1 Refactor `src/App.tsx` and `src/index.css` to reserve a persistent right-side area for an agent chat sidebar while keeping the canvas usable.
- [x] 1.2 Ensure the new sidebar layout works with the current floating header, bottom tool dock, and existing canvas controls.
- [x] 1.3 Add responsive behavior so the sidebar remains usable on narrower screens without making the board inaccessible.

## 2. Chat State And UI

- [x] 2.1 Add local chat message state and lightweight assistant message types for user messages, assistant replies, and suggested actions.
- [x] 2.2 Build the sidebar UI with a scrollable conversation thread, timestamp or message grouping treatment, and a bottom composer.
- [x] 2.3 Seed the conversation with a contextual assistant message when generation or design actions occur, so the sidebar feels connected to the current board.

## 3. Agent Interaction Flow

- [x] 3.1 Implement a mock assistant reply flow that can respond to user messages with context-aware text and suggested follow-up actions.
- [x] 3.2 Wire suggestion chips in assistant replies to meaningful existing behaviors such as generation, text editing prompts, or style-variation flows.
- [x] 3.3 Decide and implement whether chat state persists through `src/persistence/local.ts`, and keep the behavior consistent after refresh.

## 4. Validation

- [x] 4.1 Add or update end-to-end coverage in `tests/e2e/canvas.spec.ts` for opening the editor, sending a chat request, and receiving an assistant reply in the sidebar.
- [x] 4.2 Verify the full change with `pnpm lint`, `pnpm test`, `pnpm build`, and `pnpm test:e2e`.
