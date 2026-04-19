## Context

The current canvas project stores exactly one chat thread:

```ts
chat: {
  messages: ChatMessage[]
  conversationId?: string
  previousResponseId?: string | null
}
```

That structure is used end-to-end:
- `apps/web/src/types/canvas.ts` models chat as a single thread
- `apps/web/src/persistence/local.ts` persists exactly one message list plus one pair of backend conversation pointers
- `apps/web/src/App.tsx` renders one message list and always submits against one active thread
- service-backed assistant responses update the same single `conversationId / previousResponseId`

This makes the sidebar incapable of supporting multiple concurrent design discussions within the same board.

The desired behavior is narrower than a full branch/history system. We are not versioning the board per session. We are only allowing multiple independent chat threads to coexist around one shared canvas.

## Goals / Non-Goals

**Goals:**
- Support multiple chat sessions in the right sidebar.
- Allow the application to have zero sessions by default.
- Let users explicitly create a new empty session.
- Allow users to switch between sessions without changing the shared board state.
- Store `conversationId` and `previousResponseId` per session instead of at the project chat root.
- Ensure all new chat writes target the currently active session only.

**Non-Goals:**
- Do not turn chat sessions into full canvas branches or board snapshots.
- Do not migrate legacy single-thread history into an initial visible session.
- Do not add deletion, renaming, grouping, or branching of sessions in the first version.
- Do not change the current agent-service transport model beyond session-aware identifiers.

## Decisions

### 1. Use a session-based chat state with `activeSessionId`

The project chat state should move to:

```ts
type ChatSession = {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  messages: ChatMessage[]
  conversationId?: string
  previousResponseId?: string | null
}

type ChatState = {
  sessions: ChatSession[]
  activeSessionId: string | null
}
```

Why:
- Makes session identity explicit.
- Avoids implicit assumptions that a project always has one thread.
- Maps naturally to backend conversation pointers.

### 2. Adopt "scheme B": no legacy thread migration into a visible default session

Legacy project data may still contain old single-thread fields, but the new UI should not automatically wrap them into a visible session.

Why:
- Keeps the new model clean.
- Avoids silently presenting old data as if it were created under the new session semantics.
- Matches the requirement that a newly created session must have an empty message list.

Trade-off:
- Legacy chat history may remain stored but is no longer surfaced in the new multi-session UI.

### 3. Treat "no session" as a normal sidebar state

When `activeSessionId` is `null`, the sidebar should show an empty-state panel instead of a message list.

Why:
- Prevents the UI from needing a fake default conversation.
- Aligns the interaction model with explicit session creation.
- Keeps the session concept clear to the user.

### 4. New sessions start with an empty message list

Creating a new session should not inject a welcome message into `messages[]`.

Why:
- The product requirement is explicit: a new session should be empty.
- Welcome or guidance content should be rendered as empty-state UI, not persisted as chat history.

### 5. Session switching changes only the conversation context

Switching sessions changes:
- visible chat messages
- active `conversationId`
- active `previousResponseId`

It does not change:
- canvas nodes
- assets
- jobs
- viewport

Why:
- The board remains the shared design surface.
- The first version should support multiple discussion threads, not board branching.

### 6. Message-entry behavior in empty-state mode

The UI should allow one of two patterns:
- explicit "New Session" button, or
- sending the first user message creates a new session automatically

This change should prefer one consistent path in implementation, but the design should preserve the invariant that the created session starts empty before the user action is applied.

Recommended direction:
- Allow send-to-create for smoother UX, while still exposing an explicit "New Session" affordance.

## Risks / Trade-offs

- [Legacy chat history becomes hidden in the new UI] → This is an intentional product choice under scheme B and should be called out in the proposal/spec rather than treated as a bug.
- [Session-aware updates will touch many chat write paths] → Centralize active-session lookup and write helpers instead of letting UI code manipulate nested session state ad hoc.
- [Assistant event messages may accidentally write outside the active session] → Route all assistant-message insertion through one session-aware helper.
- [Session titles can become low-value placeholders] → Start with a simple placeholder title strategy and defer rename/title-generation improvements.

## Data Flow Sketch

```text
CanvasProject
  ├─ board
  ├─ assets
  ├─ jobs
  └─ chat
      ├─ activeSessionId
      └─ sessions[]
           ├─ Session A
           │   ├─ messages[]
           │   ├─ conversationId
           │   └─ previousResponseId
           ├─ Session B
           └─ Session C
```

Agent request flow:

```text
current board context
        +
active session messages
        +
active session conversation pointers
        ↓
     /chat request
        ↓
assistant response + updated pointers
        ↓
write back into active session only
```

## Migration Plan

1. Replace the single-thread chat type with session-based chat state.
2. Update local persistence normalization to support `sessions[]` and `activeSessionId`.
3. Keep legacy single-thread fields readable only as compatibility input, not as visible sessions.
4. Refactor sidebar rendering and chat submission to read/write through the active session abstraction.
5. Add UI affordances for new session creation and session switching.
6. Update assistant-event and service-backed response flows so they target the active session only.
7. Add tests for empty-state behavior, session creation, session switching, and per-session persistence of conversation pointers.

## Open Questions

- Should the first sent user message auto-create a session, or should the UI require explicit creation first?
- Should the initial session title always be `新会话`, or should it derive from the first user message immediately after creation?
- Should the sidebar keep a compact session list visible at all times, or collapse it behind a dedicated switcher control on smaller screens?
