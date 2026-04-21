# Supabase Project Persistence

The first backend persistence layer stores complete `CanvasProject` snapshots in Supabase Postgres. Chat sessions remain project-scoped inside `project.chat.sessions[]`; this is not a global conversation history.

## Setup

1. Create the `projects` table by running [supabase-project-persistence.sql](./supabase-project-persistence.sql) in the Supabase SQL editor.
2. Add these values to `.env` for `apps/agent-api`:

```sh
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

The service role key must stay on the backend. The browser calls `agent-api`; it does not talk directly to Supabase.

## Data Flow

```text
apps/web
  -> apps/agent-api /projects/:projectId
  -> Supabase public.projects.data
```

The frontend creates a stable browser-local project id and uses it for:

- `GET /projects/:projectId`
- `PUT /projects/:projectId`
- `/chat` request metadata

## Local Fallback

The web app still saves the project to `localStorage`. On startup it renders from local cache first, then attempts remote hydration. If Supabase is missing, unavailable, or the project does not exist yet, the editor remains usable from local cache and the next successful save can seed the backend snapshot.

The initial conflict strategy is last-write-wins. Multi-client editing and merge conflict handling are out of scope for this persistence layer.
