## Why

The current sidebar chat model assumes exactly one conversation thread per canvas project. That keeps the implementation simple, but it prevents users from exploring multiple design directions in parallel inside the same board. Once a conversation becomes long, there is no clean way to branch into a new discussion, compare alternative prompts, or preserve separate agent contexts for different design goals.

We want the right-side chat panel to support explicit multi-session workflows. In this change, the product should move to a session-based model where the sidebar can have no session at all, users can create a new empty session on demand, and switching sessions changes only the visible conversation context, not the shared canvas document.

## What Changes

- Redesign the sidebar chat state from a single thread into a session-based structure with `sessions[]` and `activeSessionId`.
- Add sidebar UI for creating a new session and switching between multiple sessions inside the same canvas project.
- Adopt "scheme B" for compatibility: do not migrate legacy single-thread chat history into a visible default session.
- Treat the empty sidebar state as a first-class UI state when no session exists.
- Keep the canvas, assets, and jobs shared across sessions; only chat history and backend conversation pointers are session-specific.
- Ensure all sidebar chat writes, including assistant system messages and service-backed responses, target the active session only.

## Capabilities

### Modified Capabilities
- `ai-design-canvas`: The sidebar chat evolves from a single-thread conversation model to multi-session chat with explicit session creation and switching.

## Impact

- Affected code spans `apps/web/src/App.tsx`, local persistence, chat-related project types, and shared protocol contracts.
- The agent-service request flow remains in place, but conversation identifiers move from project-level chat state to session-level chat state.
- Backward-compatibility impact is intentional: legacy single-thread chat data remains readable in storage but is not surfaced as an auto-created visible session in the new UI.
