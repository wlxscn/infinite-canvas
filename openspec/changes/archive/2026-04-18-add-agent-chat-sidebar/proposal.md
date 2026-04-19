## Why

The current canvas supports generation, asset insertion, and direct editing, but it still treats prompt entry as a lightweight utility instead of an ongoing conversational workflow. The reference direction shows a more capable interaction model where users can talk to an assistant on the right side, receive suggestions, and continue iterating on the current design without leaving the board.

Adding a persistent agent chat sidebar now will turn the canvas from a single-action generator into a guided editing workspace where users can issue follow-up requests, inspect generated suggestions, and continue design operations through conversation.

## What Changes

- Add a right-side agent chat sidebar to the infinite canvas interface.
- Support a threaded conversation area with user messages and assistant responses.
- Add an input composer for ongoing chat requests tied to the current canvas session.
- Support assistant reply affordances for common next actions such as adding text, changing style, or generating variants.
- Connect assistant interactions to the current canvas context so responses can reference selected or recent content.
- Preserve existing canvas editing and generation behavior while introducing a persistent conversational workflow.

## Capabilities

### New Capabilities

### Modified Capabilities
- `ai-design-canvas`: Extend the editor so users can interact with a persistent agent chat sidebar that supports iterative design assistance alongside the canvas.

## Impact

- Affected code will likely include `src/App.tsx`, `src/index.css`, state helpers, and any modules used to represent assistant messages or action suggestions.
- The editor layout will change to reserve space for a right-side conversational surface.
- End-to-end coverage will need to expand from single-step generation flows to sidebar-based conversational interaction.
