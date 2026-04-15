# browser-use

This project includes a dedicated local stack for `browser-use`.

## Start the stack

```bash
pnpm dev:browser-use
```

That command starts:

- the web app on `http://127.0.0.1:45173`
- the agent API on `http://127.0.0.1:45188`

The ports match the existing Playwright E2E setup so browser automation and end-to-end testing hit the same local topology.

## Drive the app with browser-use

In another terminal:

```bash
browser-use --session infinite-canvas open http://127.0.0.1:45173
browser-use --session infinite-canvas state
browser-use --session infinite-canvas screenshot
```

Useful follow-ups:

```bash
browser-use --session infinite-canvas click 0
browser-use --session infinite-canvas wait text "Infinite Canvas"
browser-use --session infinite-canvas close
```

## Notes

- `browser-use doctor` should pass before using the stack.
- If the browser session gets into a bad state, run `browser-use close --all`.
- The stack uses `VITE_AGENT_API_URL=http://127.0.0.1:45188/chat` and `CORS_ORIGIN=http://127.0.0.1:45173`.
