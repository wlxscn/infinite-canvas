## 1. Engine Scaffolding

- [x] 1.1 Add engine-level types and a node adapter contract for render, bounds, hit testing, and basic transforms under `apps/web/src/canvas/engine`
- [x] 1.2 Create a shared adapter registry that resolves supported node types without repeating `node.type` branching across canvas helpers
- [x] 1.3 Add engine runtime helpers for disposable caches and asset lookup state without changing the persisted `CanvasProject` schema

## 2. Migrate Existing Node Behavior

- [x] 2.1 Implement adapters for current rectangular and freehand node types and move their draw, bounds, and hit-test logic behind the new contract
- [x] 2.2 Implement adapters for text, image, and video nodes and preserve current rendering and selection behavior through the registry
- [x] 2.3 Convert `apps/web/src/canvas/render.ts`, `apps/web/src/canvas/bounds.ts`, and `apps/web/src/interaction/hitTest.ts` into engine-backed facades or dispatchers

## 3. Integrate With Canvas Interaction

- [x] 3.1 Update `apps/web/src/canvas/CanvasStage.tsx` to consume engine-backed render and hit-test entry points without changing existing interaction semantics
- [x] 3.2 Preserve current move, resize, pan/zoom, and undo/redo behavior while routing supported node edits through the shared engine boundary
- [x] 3.3 Verify runtime-only engine state is recreated from project data after load and is not persisted into local project storage

## 4. Validation

- [x] 4.1 Add unit tests for adapter registry dispatch, per-node bounds, and hit-testing behavior in the migrated engine path
- [x] 4.2 Add or update interaction regression coverage for freehand, rectangular, text, and media nodes so existing editing flows remain stable
- [x] 4.3 Run `pnpm --filter @infinite-canvas/web lint`, `pnpm --filter @infinite-canvas/web test`, and `pnpm --filter @infinite-canvas/web build`
