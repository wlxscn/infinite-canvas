## 1. Workspace And Shared Contracts

- [x] 1.1 Finalize the monorepo wiring so `apps/web`, `apps/agent-api`, and `packages/shared` have working package scripts, build entrypoints, and documented environment setup.
- [x] 1.2 Move chat protocol types into `packages/shared/src/` for agent requests, agent responses, canvas context payloads, and structured tool effects.
- [x] 1.3 Update `apps/web` and `apps/agent-api` imports to consume the shared contracts instead of maintaining duplicate local chat protocol definitions.

## 2. Agent Service Foundation

- [x] 2.1 Implement the real `apps/agent-api` HTTP chat route and controller flow to accept user messages plus canvas context and return structured assistant responses.
- [x] 2.2 Replace the current stub `openai.service` with a LangChain/LangGraph-backed orchestration flow using the design-agent prompt and conversation state handling.
- [x] 2.3 Implement server-side tool routing in `apps/agent-api/src/tools/` and `tool-runner.service` for text insertion, style variation, and generation-follow-up intents.
- [x] 2.4 Add environment handling and startup validation for required agent-service configuration such as API keys and allowed frontend origin.

## 3. Frontend Chat Integration

- [x] 3.1 Refactor `apps/web/src/App.tsx` chat logic into frontend chat-specific modules/hooks so local mock reply generation is removed from the main UI component.
- [x] 3.2 Integrate Vercel AI SDK in `apps/web` so the sidebar sends chat requests to `apps/agent-api` and renders real agent responses.
- [x] 3.3 Build canvas-context payload mapping from the current board state, selected node, recent assets, and latest prompt before each chat request.
- [x] 3.4 Interpret structured agent effect payloads in the frontend and apply them through the existing board state helpers so undo/redo and local persistence continue to work.

## 4. Persistence And Compatibility

- [x] 4.1 Extend `apps/web/src/types/canvas.ts` and `apps/web/src/persistence/local.ts` to persist optional service-backed conversation metadata alongside chat history.
- [x] 4.2 Add normalization or migration handling so older locally saved projects without service conversation metadata still load successfully.

## 5. Validation

- [x] 5.1 Add unit coverage for shared protocol mapping, agent effect handling, and persistence compatibility in `apps/web/tests/unit/` and any new service-side tests as needed.
- [x] 5.2 Update end-to-end coverage in `apps/web/tests/e2e/canvas.spec.ts` to verify service-backed sidebar messaging and returned assistant behavior.
- [x] 5.3 Verify the change with `pnpm lint`, `pnpm build`, `pnpm test`, and any app-specific checks needed for `apps/web` and `apps/agent-api`.
