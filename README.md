# Infinite Canvas

Monorepo for the canvas editor UI and the agent chat service.

## Workspace

- `apps/web`: React + Vite canvas app
- `apps/agent-api`: agent service for chat orchestration
- `packages/shared`: shared chat and canvas contracts

## Commands

```bash
pnpm dev
pnpm build
pnpm lint
pnpm test
pnpm test:e2e
```

## Environment

Copy `.env.example` and configure:

- `VITE_AGENT_API_URL`
- `PORT`
- `CORS_ORIGIN`
- `OPENAI_API_KEY`

## Notes

- The legacy root-level frontend copy has been removed.
- End-to-end tests start the web app and agent API together from `apps/web/scripts/run-e2e.mjs`.
