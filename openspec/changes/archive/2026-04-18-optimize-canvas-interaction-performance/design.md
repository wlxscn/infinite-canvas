## Context

The current interaction path in `apps/web/src/canvas/CanvasStage.tsx` pushes a full `project` update through `App` on nearly every `pointermove` while dragging nodes, resizing, panning, pinching, and wheel-zooming. That causes `apps/web/src/App.tsx` to re-render non-canvas UI, recompute selection chrome, and trigger `saveProject(state.project)` via an effect in `apps/web/src/persistence/local.ts`, even though most of that work is irrelevant to the active pointer frame.

Rendering is also fully scene-based today: `apps/web/src/canvas/render.ts` clears and redraws the full canvas for each project change and resolves image/video assets with repeated linear `assets.find(...)` calls. Freehand nodes are relatively expensive because movement remaps every point and selection bounds recompute by scanning every point. These costs stack during interaction and make the board feel less direct as document size grows.

This change is intentionally incremental. The document schema, undo/redo model, local project format, and existing tool behaviors remain in place. The goal is to narrow the hot path so active manipulation is mostly local to the canvas stage and only commits durable project state when needed.

Likely modules involved:
- `apps/web/src/canvas/CanvasStage.tsx`: separate transient interaction state from committed project state and throttle visual updates to animation frames
- `apps/web/src/canvas/render.ts`: reduce per-frame work, reuse prepared lookups, and keep full-scene redraws as cheap as possible
- `apps/web/src/App.tsx`: stop app-wide React work from sitting directly on the drag path and narrow persistence triggers
- `apps/web/src/persistence/local.ts`: support deferred save scheduling without changing the saved schema
- `apps/web/src/state/store.ts`: preserve current history semantics while making sure live interaction updates do not create extra undo checkpoints
- `apps/web/tests/unit/*` and `apps/web/tests/e2e/canvas.spec.ts`: cover new scheduling and verify interaction behavior remains correct

## Goals / Non-Goals

**Goals:**
- Keep drag, resize, pan, pinch, and wheel zoom visually responsive under larger project payloads.
- Move high-frequency interaction updates off the app-wide React render path where practical.
- Ensure undo/redo still records a single committed mutation for a completed drag or resize interaction.
- Preserve local-first behavior while preventing synchronous whole-project persistence from running on every interaction frame.
- Reduce repeated render-time work such as asset lookups, repeated observer setup, and avoidable bounds recomputation in the interaction path.

**Non-Goals:**
- Replace the canvas renderer with WebGL, a retained-mode scene graph, or a third-party canvas engine
- Change the saved `CanvasProject` schema or require migration of existing local documents
- Introduce a new state management library or rewrite the entire app away from the current `App`-owned store
- Redesign the product UI or change user-facing workflows beyond improving responsiveness

## Decisions

### 1. Keep transient manipulation state inside `CanvasStage` and commit to the store on interaction completion

During active drag/pan/resize/zoom, the stage will maintain a transient view of the board in local refs/state and render directly from that interaction snapshot. The parent `App` store will only receive committed board updates when the interaction finishes or when a discrete action requires an externally visible state transition.

Why:
- It removes non-canvas React work from the most frequent pointer path.
- It preserves the existing store shape and undo/finalize flow instead of introducing a parallel document model.
- It gives the canvas a stable place to apply `requestAnimationFrame` throttling.

Alternative considered:
- Continue updating the global project on every frame and attempt to memoize the rest of the UI.
This was rejected because the current parent state shape makes broad invalidation the default, so memoization alone would still leave persistence and store churn on the hot path.

### 2. Use frame-based scheduling for interaction rendering

Pointer and wheel handlers will accumulate the latest interaction intent and flush visual updates via `requestAnimationFrame` rather than processing every raw event synchronously.

Why:
- Browser pointer and wheel events can outpace paint.
- Frame-based scheduling reduces redundant work while keeping visual output aligned with the display refresh rate.

Alternative considered:
- Debounce interaction updates with time-based delays.
This was rejected because debounce would improve throughput at the expense of direct manipulation feel.

### 3. Defer persistence outside active manipulation and keep manual save explicit

`saveProject` should no longer run synchronously for every transient board update. Instead, persistence will be scheduled after committed project changes with a short debounce or idle-style delay, while explicit save shortcuts can still force an immediate write.

Why:
- Serializing and writing the full project on every drag frame is wasted work.
- Deferred persistence preserves local-first recovery without coupling storage latency to pointer responsiveness.

Alternative considered:
- Remove auto-save entirely and rely only on explicit save.
This was rejected because it would regress the current recovery model.

### 4. Optimize render preparation before attempting deeper renderer changes

The renderer will stay full-scene and canvas-based for now, but it will receive cheaper inputs: precomputed asset maps, narrower rerender triggers, and cached geometry where possible.

Why:
- This is the smallest change that can materially improve cost without destabilizing rendering behavior.
- It matches the existing architecture and keeps risk low.

Alternative considered:
- Add retained display objects or dirty-rectangle invalidation.
This was rejected for this change because it would significantly expand scope and alter the rendering model.

### 5. Preserve existing undo/redo semantics by treating a drag as one finalized mutation

History will continue to record one committed change for a completed drag/resize interaction. Transient movement frames must not append extra history entries.

Why:
- Users expect one drag to undo in one step.
- The current store already has `replaceProjectNoHistory` and `finalizeMutation`, which can be retained with narrower committed entry points.

Alternative considered:
- Record intermediate frames in history to simplify implementation.
This was rejected because it would degrade usability and inflate memory use.

## Risks / Trade-offs

- [Transient stage state can drift from committed app state] → Keep one explicit synchronization path from parent project into stage refs when no interaction is active, and commit finalized mutations through existing store helpers.
- [Deferred persistence may lose the very latest frame if the tab closes mid-drag] → Persist promptly after commit and keep explicit save intact; this is an acceptable trade-off versus blocking every frame.
- [Frame scheduling can make tests flaky if assertions assume immediate state flush] → Update unit and E2E tests to wait for committed outcomes rather than intermediate pointer events.
- [Freehand movement may remain relatively expensive for very large paths] → Optimize the dominant app-wide costs first and add targeted freehand geometry caching where it gives clear benefit.
- [Canvas-only optimization may leave some overhead in selection chrome] → Keep selection UI derived from committed state and only refresh it when the committed interaction ends unless the feature requires live positioning.

## Migration Plan

- Implement the interaction-state split without changing the serialized `CanvasProject` structure.
- Roll out deferred persistence only for automatic saves; keep explicit save commands unchanged as a fallback.
- Update unit tests around store/persistence scheduling and E2E flows for drag, pan, and zoom correctness.
- If regressions appear, rollback is limited to the interaction scheduling and persistence changes because the document model and UI contracts remain the same.

## Open Questions

- Should live selection toolbar positioning follow the transient node position during drag, or only refresh on commit to keep non-canvas UI off the hot path?
- Is `requestIdleCallback` available and acceptable for deferred saves in the browser targets, or should the implementation use a plain timeout-based debounce for consistency?
- Do we want a dedicated cached bounds field for freehand nodes now, or defer that until profiling shows it is still a primary hotspot after the broader interaction changes?
