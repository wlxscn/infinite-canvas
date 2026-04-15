## Context

The current canvas stack implements rendering, bounds calculation, and hit testing through repeated node-type branching across `apps/web/src/canvas/render.ts`, `apps/web/src/canvas/bounds.ts`, and `apps/web/src/interaction/hitTest.ts`. `CanvasStage.tsx` then coordinates interaction flow around those helpers. This works for the current set of nodes, but each new node type requires edits in several disconnected places, which raises regression risk and makes engine-level improvements harder to deliver incrementally.

The user goal is to support canvas rendering through an abstract render engine that can cover current nodes such as freehand strokes and rectangles, while preserving the existing editing model. This change therefore needs to centralize node-specific behavior without rewriting the full application architecture or changing the persisted project schema.

Likely modules involved:
- `apps/web/src/types/canvas.ts`
- `apps/web/src/canvas/render.ts`
- `apps/web/src/canvas/bounds.ts`
- `apps/web/src/interaction/hitTest.ts`
- `apps/web/src/canvas/CanvasStage.tsx`
- new engine modules under `apps/web/src/canvas/engine` or similar
- unit tests for rendering, geometry, and hit testing

## Goals / Non-Goals

**Goals:**
- Introduce a shared render-engine contract for supported canvas node types.
- Move node-specific drawing, bounds, and hit-testing behavior behind a registry or adapter layer instead of repeating `node.type` branching across helpers.
- Preserve current persisted `CanvasProject` compatibility, undo/redo semantics, and interaction behavior while migrating internals.
- Support existing node types, including freehand strokes, rectangles, text, images, and videos, through the same engine abstraction.
- Create a runtime boundary for caches and resource lookup state that does not leak into persisted document data.

**Non-Goals:**
- Replace the current 2D canvas renderer with WebGL or a third-party scene graph.
- Rewrite the application state model or move ownership of committed project state away from React.
- Introduce dirty-region rendering, layered canvases, or a retained-mode renderer in the same change unless a small compatibility layer is required.
- Change user-facing canvas workflows or the saved project format.

## Decisions

### 1. Keep the persisted scene model and abstract runtime behavior around it

The existing document model remains the source of truth for saved projects, undo/redo, and external app state. The new engine layer will operate on that model rather than replacing it.

Why:
- It keeps migration risk low.
- It avoids creating parallel state sources for the same document.
- It preserves local persistence compatibility.

Alternative considered:
- Introduce a new retained scene graph as the main source of truth.
This was rejected because it would expand scope from an internal abstraction to a platform rewrite.

### 2. Introduce a node adapter registry as the main extension point

Each supported node type will provide a small adapter that defines how the node renders, computes bounds, participates in hit testing, and handles basic transforms such as translate and resize when applicable. The render engine and interaction helpers will dispatch through this registry rather than hard-coded branches.

Why:
- It centralizes node behavior.
- It makes adding future node types more predictable.
- It lets rendering, geometry, and hit testing share the same contract.

Alternative considered:
- Keep helper-specific branching and only extract shared utility functions.
This was rejected because it would reduce duplication only superficially and would not create a stable extension boundary.

### 3. Separate runtime caches and resource state from serialized document data

Geometry caches, asset lookup maps, prepared drawing primitives, and similar render-time helpers will live in the engine runtime, not on persisted nodes.

Why:
- Runtime data should be disposable and recomputable.
- Persisted schema stability is a goal of this change.
- It avoids leaking browser-specific state into local project storage.

Alternative considered:
- Attach cached bounds and render helpers directly to nodes.
This was rejected because it would mix document data with transient state and complicate persistence.

### 4. Migrate incrementally behind compatibility helpers

The first implementation will keep the current single-canvas rendering model and React ownership in place. Existing helpers such as `render.ts`, `bounds.ts`, and `hitTest.ts` can become thin facades over the new engine modules during migration.

Why:
- It allows the codebase to adopt the abstraction without a flag day rewrite.
- It keeps current tests and UI behavior easier to preserve.
- It leaves room for later rendering optimizations once the abstraction boundary is stable.

Alternative considered:
- Replace all canvas internals at once with a new engine entry point.
This was rejected because it would make debugging regressions significantly harder.

### 5. Treat freehand as a first-class adapter, not a special-case fallback

Freehand nodes have different geometry and hit-test characteristics from rectangular nodes. The engine contract needs to support that complexity directly rather than forcing all shapes into a simple box-oriented path.

Why:
- Freehand strokes are already present and performance-sensitive.
- A weak abstraction here would just preserve special cases in another form.

Alternative considered:
- Implement the engine around rectangular nodes first and leave freehand on the old path.
This was rejected because it would delay the hardest compatibility problem and reduce the value of the abstraction.

## Risks / Trade-offs

- [The abstraction improves structure more than performance at first] → Accept this as part of the migration; performance work becomes safer once behavior is centralized.
- [Adapters may still duplicate logic if the contract is too thin] → Define the registry around the concrete operations already repeated today: draw, bounds, hit test, translate, and resize.
- [Freehand may need richer geometry helpers than other nodes] → Keep shared geometry utilities separate from the adapter interface so complex node types are not forced into weak defaults.
- [Text and media nodes depend on runtime measurement and resource loading] → Add engine-owned caches and a resource lookup layer rather than embedding runtime state in document nodes.
- [Interaction code may remain coupled to old helpers during migration] → Allow compatibility facades short term, but require all supported node behavior to flow through the new registry.

## Migration Plan

- Create engine-level types and a registry contract for supported node adapters.
- Implement adapters for the current node types and route rendering, bounds calculation, and hit testing through the registry.
- Keep existing exported helpers as compatibility facades where needed so `CanvasStage` and related modules can migrate incrementally.
- Preserve the current project schema, persistence behavior, and history flow while replacing internal dispatch logic.
- Add unit coverage around adapter dispatch and regression coverage for existing interaction flows before layering in deeper renderer optimizations.

## Open Questions

- Should engine modules live under `src/canvas/engine` to stay close to the current canvas stack, or under a broader `src/engine` directory for future reuse?
- Do we want a shared transform contract for all node types in the first pass, or should resize remain optional for node types that already use bespoke logic?
- Is it worth introducing an overlay or layered canvas boundary now, or should that wait until after the adapter migration has stabilized?
