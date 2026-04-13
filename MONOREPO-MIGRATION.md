# Monorepo Migration Notes

The repository now runs as a workspace with three active packages:

- `apps/web`: the primary React/Vite canvas app
- `apps/agent-api`: the LangGraph-backed agent service used by the chat sidebar
- `packages/shared`: shared chat contracts, canvas context payloads, and agent effect types

Current status:

- The legacy root-level frontend copy has been removed
- `apps/web` now imports shared chat protocol contracts from `packages/shared`
- `apps/agent-api` exposes `/health` and `/chat`, validates startup env, and routes requests through the service/tool layer
- `apps/web` uses the Vercel AI SDK transport to call `apps/agent-api`
- `apps/web` persistence stores conversation metadata alongside chat history
- `apps/web/scripts/run-e2e.mjs` starts the web app and agent service together for end-to-end checks

Recommended next steps:

1. Point local development and CI only at the workspace packages under `apps/`
2. Replace the heuristic LangGraph planner with real model/tool execution once the external agent backend is ready
3. Add service-side tests when the agent orchestration grows beyond the current lightweight graph
