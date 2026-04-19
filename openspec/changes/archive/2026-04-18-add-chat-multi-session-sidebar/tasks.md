## 1. Chat Session Data Model

- [x] 1.1 Replace the single-thread `project.chat` shape with a session-based structure that stores `sessions[]` and `activeSessionId`.
- [x] 1.2 Define a `ChatSession` type with per-session `messages`, `conversationId`, `previousResponseId`, timestamps, and title metadata.
- [x] 1.3 Update shared request/response handling so agent-service calls read and write conversation pointers from the active session rather than the project root.

## 2. Persistence And Compatibility

- [x] 2.1 Update local persistence normalization to read/write the new session-based chat structure.
- [x] 2.2 Keep legacy single-thread chat data readable as compatibility input without surfacing it as an auto-created visible session.
- [x] 2.3 Ensure a project can legitimately persist with zero sessions and `activeSessionId = null`.

## 3. Sidebar UI And Interaction

- [x] 3.1 Add empty-state UI for the sidebar when no session exists.
- [x] 3.2 Add a "new session" affordance in the sidebar and create a new empty session when invoked.
- [x] 3.3 Add session-switching UI in the right sidebar so users can move between sessions within the same board.
- [x] 3.4 Keep the composer pinned to the active session context and prevent messages from rendering against non-active sessions.

## 4. Session-Aware Message Flow

- [x] 4.1 Route all user chat submissions through the active session and create or select a session before writing user messages.
- [x] 4.2 Route all service-backed assistant responses into the active session only.
- [x] 4.3 Route assistant event messages (welcome/asset/generation/text feedback) through the active session model or empty-state model without reintroducing frontend hardcoded assistant text.
- [x] 4.4 Ensure session switching does not mutate the shared board, assets, jobs, or viewport state.

## 5. Validation

- [x] 5.1 Add unit coverage for session-state normalization and active-session message routing.
- [x] 5.2 Add end-to-end coverage for empty-state behavior, new-session creation, and multi-session switching in the sidebar.
- [x] 5.3 Verify the change with `pnpm lint`, `pnpm build`, `pnpm test`, and any sidebar-specific end-to-end checks.
