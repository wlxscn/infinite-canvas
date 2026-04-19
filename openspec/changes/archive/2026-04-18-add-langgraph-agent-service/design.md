## Context

The repo has started moving toward a monorepo layout with `apps/web`, `apps/agent-api`, and `packages/shared`, but the actual chat behavior in the canvas app is still generated entirely in `apps/web/src/App.tsx` through mock helper functions. That means the sidebar cannot maintain a real service-backed conversation, call tools safely on the server, or evolve into an actual design copilot without rewriting the current frontend-only flow.

This change is cross-cutting because it introduces a new runtime surface (`apps/agent-api`), new shared protocol contracts, and a new frontend integration pattern through Vercel AI SDK. It also touches chat persistence because the current local project state stores chat messages only, while a real service-backed conversation will also need service-side conversation identifiers or response pointers.

Likely modules and areas involved:
- `apps/agent-api/src/routes`, `controllers`, `services`, `tools`, `prompts`: new service entrypoint, LangChain/LangGraph orchestration, and tool execution
- `apps/web/src/App.tsx`: remove inline mock reply generation and delegate chat requests to the service
- `apps/web/src/persistence/local.ts`: extend local persisted chat state with service-backed conversation metadata while keeping existing project documents readable
- `apps/web/src/types/canvas.ts`: update chat-related project types or move them to shared contracts where appropriate
- `packages/shared/src/*`: canonical request/response, tool-effect, and canvas-context types shared between frontend and service
- `apps/web/tests/e2e/*` and `tests/unit/*`: verify service-backed chat flows, persistence compatibility, and structured effect handling

## Goals / Non-Goals

**Goals:**
- Introduce a real agent backend in `apps/agent-api` using LangChain/LangGraph.
- Define a stable typed protocol between frontend and backend for chat input, canvas context, assistant output, and tool effects.
- Update the frontend chat sidebar to talk to the agent service through Vercel AI SDK instead of local mock logic.
- Keep the current canvas editing model, render loop, and undo/redo behavior intact while allowing agent responses to trigger structured follow-up actions.
- Preserve local project compatibility by making persisted chat state extensible rather than replacing the whole project document model.

**Non-Goals:**
- Rebuild the canvas renderer, hit-testing model, or editing engine
- Introduce multi-user collaboration or shared server-side project storage
- Replace all local generation mocks with production image generation in the same change
- Build a full autonomous multi-agent system beyond a single design-copilot workflow

## Decisions

### 1. Use `apps/agent-api` as the single orchestration boundary

The frontend should never call model APIs directly. Instead, `apps/agent-api` will own LangChain/LangGraph graphs, prompt assembly, tool execution, and model credentials.

Why:
- Keeps secrets and tool execution off the client.
- Provides one place to manage conversation state, retries, and observability.
- Avoids duplicating orchestration logic across UI components.

Alternative considered:
- Call the model directly from the frontend with only a thin proxy.
This was rejected because it weakens security and still leaves orchestration logic in the wrong layer.

### 2. Use `packages/shared` for protocol contracts, not duplicated frontend/service types

Chat request/response payloads, tool effects, and canvas context summaries will live in `packages/shared`.

Why:
- Frontend and backend must agree on structured tool effects such as `insert-text`, `style-variation`, or `start-generation`.
- Shared types reduce drift during migration from mock chat to service-backed chat.

Alternative considered:
- Keep separate types in `apps/web` and `apps/agent-api`.
This was rejected because the change introduces a formal boundary that will otherwise drift quickly.

### 3. Keep the frontend as the source of truth for canvas document mutations

The agent service should not mutate the board document directly. It should return structured effects and assistant messages; the frontend remains responsible for applying those effects to the local project state.

Why:
- Preserves current undo/redo and local persistence semantics.
- Minimizes disruption to the existing canvas architecture.
- Keeps browser interaction and rendering concerns in the frontend where they already work.

Alternative considered:
- Let the backend own the full board document and return a rewritten project.
This was rejected because it would expand the scope into a broad state-management redesign.

### 4. Persist conversation metadata alongside local chat messages

The local project should remain readable after refresh, but chat persistence should grow to include service-backed metadata such as `conversationId` and `previousResponseId` (or equivalent response pointers).

Why:
- Real multi-turn service conversations need stable identifiers across refreshes.
- Keeping metadata alongside current chat state provides incremental migration without abandoning local-first behavior.

Alternative considered:
- Do not persist service conversation pointers and restart chat each refresh.
This was rejected because it would make the agent feel detached from the current board session.

### 5. Use Vercel AI SDK on the frontend as the chat transport abstraction

The frontend should use Vercel AI SDK to manage chat requests, streaming UI integration, and response handling against `apps/agent-api`.

Why:
- It gives a cleaner chat integration layer than hand-rolling request state in `App.tsx`.
- It makes future streaming and partial-response UX easier to add.

Alternative considered:
- Keep custom fetch logic in `App.tsx`.
This was rejected because the current file already carries too much UI and state responsibility.

## Risks / Trade-offs

- [Dual source of truth between chat state and board state] → Keep the board local and restrict the agent response format to explicit effect objects instead of arbitrary project rewrites.
- [Persistence migration could break saved local documents] → Make new chat metadata optional in the schema and normalize missing fields during load.
- [LangGraph orchestration may be heavier than the current app needs] → Keep the first graph simple: one design agent, a small tool set, and a narrow prompt contract.
- [Frontend migration may leave `App.tsx` overly large] → Introduce chat-specific hooks/components as part of the migration instead of adding more inline service code.
- [Service-backed chat increases test complexity] → Split coverage into unit tests for protocol/tool mapping and end-to-end tests for the sidebar request/response flow.

## Migration Plan

1. Finalize the monorepo skeleton so `apps/web`, `apps/agent-api`, and `packages/shared` build independently.
2. Define shared protocol types for chat requests, chat responses, canvas context, and tool effects.
3. Replace the frontend mock reply path with a Vercel AI SDK-based client that calls `apps/agent-api`.
4. Add a first LangGraph flow in `apps/agent-api` that accepts canvas context, runs a design-copilot prompt, and returns assistant output plus tool effects.
5. Wire a small server-side tool set for text insertion, style changes, and generation-follow-up intents.
6. Extend local persistence to store conversation metadata and keep older saved projects readable.
7. Update tests for service-backed chat and effect application.

Rollback strategy:
- Keep the old mock path isolated behind a feature branch or removable integration layer during development.
- If needed, revert frontend chat requests to the previous local mock flow without touching the board model.

## Open Questions

- Should the first service-backed version stream partial assistant text to the sidebar immediately, or start with non-streaming responses while keeping the Vercel AI SDK abstraction?
- Which LangGraph memory strategy should own conversation state first: in-memory session storage, file-backed storage, or an external data store?
- Should suggestion chips map one-to-one to server-declared tool intents, or remain a frontend presentation layer over assistant text plus effects?
- When the agent proposes text insertion, should the backend return finalized copy only, or also placement hints tied to selected canvas nodes?
