## 1. Interaction State Isolation

- [x] 1.1 Refactor `apps/web/src/canvas/CanvasStage.tsx` so drag, resize, pan, pinch, and wheel zoom use transient stage-local state instead of committing the full project through `App` on every raw input frame.
- [x] 1.2 Add paint-aligned scheduling in `apps/web/src/canvas/CanvasStage.tsx` so high-frequency pointer and wheel updates flush through `requestAnimationFrame` rather than running synchronously per event.
- [x] 1.3 Preserve the existing finalize path by committing one completed mutation for drag and resize gestures through `apps/web/src/state/store.ts` helpers and keeping current undo/redo behavior intact.

## 2. Persistence and Render Hot Path

- [x] 2.1 Update `apps/web/src/App.tsx` and `apps/web/src/persistence/local.ts` so automatic saves are deferred after committed project changes instead of serializing the whole project during active manipulation.
- [x] 2.2 Narrow effect dependencies in `apps/web/src/App.tsx` and `apps/web/src/canvas/CanvasStage.tsx` to avoid re-registering listeners and observers on every project change.
- [x] 2.3 Optimize `apps/web/src/canvas/render.ts` and related helpers to reduce per-frame work, including precomputed asset lookup structures and targeted geometry caching where it materially lowers drag cost.

## 3. Validation

- [x] 3.1 Add or update unit tests for deferred persistence, history semantics, and any new render/interaction scheduling helpers in `apps/web/tests/unit/`.
- [x] 3.2 Update `apps/web/tests/e2e/canvas.spec.ts` to verify drag, resize, pan, and zoom behaviors still work correctly after the interaction-path changes.
- [x] 3.3 Run `pnpm lint`, `pnpm test`, `pnpm build`, and `pnpm test:e2e` and resolve any regressions before marking the change complete.
