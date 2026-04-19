# Repository Guidelines

## Project Structure & Module Organization
This repository is a `pnpm` workspace with two apps and shared packages.

- `apps/web`: React 19 + Vite frontend, canvas UI, persistence, and tests.
- `apps/agent-api`: Node ESM service for chat, image, and video endpoints.
- `packages/shared`: shared API, chat, and canvas contract types.
- `packages/canvas-engine`: canvas model, geometry, transforms, and adapters.
- `docs/`: workflow notes such as `docs/browser-use.md`.

Place UI features under `apps/web/src/features`, route/controller logic under `apps/agent-api/src`, and any cross-app types in `packages/shared/src`.

## Build, Test, and Development Commands
- `pnpm dev`: start web and API together.
- `pnpm dev:web`: run only the Vite app.
- `pnpm dev:api`: run only the API with file watching.
- `pnpm build`: run workspace build checks.
- `pnpm lint`: run ESLint for the web app and verification for the API.
- `pnpm test`: run unit tests with Vitest.
- `pnpm test:e2e`: run Playwright end-to-end tests through `apps/web/scripts/run-e2e.mjs`.
- `pnpm preview`: serve the built frontend locally.

## Coding Style & Naming Conventions
Prefer TypeScript in the frontend and shared packages, and `.mjs` ESM modules in `apps/agent-api`. Follow existing file patterns: React components in `PascalCase` (`CanvasStage.tsx`), hooks as `use...`, utilities in `camelCase`, and tests as `*.test.ts` or `*.spec.ts`. Use the repo ESLint config in `eslint.config.js`; run `pnpm lint` before opening a PR.
For React code in `apps/web`, assume development runs under `StrictMode`. Effects and cleanups must be re-entrant: if cleanup flips refs or tears down stateful resources, the effect body must restore them on the next mount. Avoid one-way flags that are only set in cleanup, because `StrictMode` will intentionally run mount -> cleanup -> mount and can leave refs such as `isMountedRef` in an invalid state during normal local development.

## Testing Guidelines
Unit tests live in `apps/web/tests/unit` and use Vitest. End-to-end tests live in `apps/web/tests/e2e` and use Playwright with a local Chromium project. Add or update tests for behavior changes that affect canvas state, chat mapping, persistence, or API-driven flows. Keep test names descriptive, for example `history.test.ts` or `canvas.spec.ts`.

## Commit & Pull Request Guidelines
Recent history uses short Conventional Commit prefixes such as `docs:`, `chore:`, and similar imperative summaries. Continue that format, for example `feat: add video asset overlay`. PRs should explain user-visible behavior, list verification steps, link the relevant issue or spec when available, and include screenshots or recordings for frontend changes.
When completing an OpenSpec spec implementation, create a local git commit for the finished work before moving on.

## OpenSpec Guidelines
OpenSpec-generated artifacts should default to Chinese. When creating or updating OpenSpec `proposal.md`, `design.md`, `spec.md`, or `tasks.md`, write the content in Chinese unless the user explicitly asks for another language.

## Security & Configuration Tips
Copy `.env.example` for local setup. Required values include `VITE_AGENT_API_URL`, `PORT`, `CORS_ORIGIN`, `OPENAI_API_KEY`, and any MiniMax settings. Never commit secrets, generated local env files, or test artifacts from `dist/` and `test-results/`.
