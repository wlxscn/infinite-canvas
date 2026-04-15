## Why

The current canvas interaction path updates the full project state on every drag frame, re-renders non-canvas UI, and persists the whole project synchronously during movement. As node count, assets, and chat history grow, dragging and panning start to feel sticky instead of direct.

This should be addressed now because pointer responsiveness is a core editor quality bar, and the current architecture already has clear hotspots that can be optimized without changing the document model or removing existing editing features.

## What Changes

- Optimize drag, pan, resize, and zoom interaction paths so they avoid unnecessary app-wide React work during pointer movement.
- Decouple high-frequency canvas interaction updates from synchronous whole-project persistence.
- Reduce avoidable full-scene rendering costs during canvas interaction, including repeated lookups and repeated setup work.
- Preserve current editing behavior, undo/redo semantics, persistence format, and visible tool set while improving responsiveness.
- Add validation coverage for interaction performance-sensitive flows and ensure the optimized paths still preserve correctness.

## Capabilities

### New Capabilities

### Modified Capabilities
- `ai-design-canvas`: Update canvas interaction requirements so moving, resizing, panning, and zooming remain responsive while preserving existing editing and persistence behavior.

## Impact

- Affected code will primarily be in `apps/web/src/canvas/CanvasStage.tsx`, `apps/web/src/canvas/render.ts`, `apps/web/src/App.tsx`, `apps/web/src/persistence/local.ts`, and related helpers in `apps/web/src/state` and `apps/web/src/canvas`.
- The change modifies `ai-design-canvas` requirements around interaction responsiveness, render isolation, and persistence behavior during active manipulation.
- No API or document schema changes are planned; saved project compatibility should remain intact.
- Non-goals: replacing the canvas renderer, introducing a new state management library, or redesigning the editor UI while doing this performance pass.
