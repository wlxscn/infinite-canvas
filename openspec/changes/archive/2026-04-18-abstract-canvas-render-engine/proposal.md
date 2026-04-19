## Why

The current canvas implementation spreads node-specific behavior across multiple files and repeated type branches. Drawing, bounds calculation, and hit testing for shapes such as freehand strokes, rectangles, text, images, and videos are handled separately in `render.ts`, `bounds.ts`, and `hitTest.ts`, which makes the rendering pipeline harder to extend and easier to regress.

This structure is already creating friction for current node types and will become more expensive as additional tools and shapes are added. The project needs a rendering abstraction that keeps the persisted document model stable while centralizing how supported node types render, compute bounds, and participate in interaction logic.

## What Changes

- Introduce an abstract canvas render engine layer that routes supported node behavior through a shared registry or adapter contract instead of repeated `node.type` branching across rendering and geometry code.
- Migrate existing supported node types, including freehand strokes and rectangular content, onto that shared contract while preserving current editing behavior and local document compatibility.
- Separate runtime-only rendering concerns such as geometry caches and resource lookups from the persisted canvas project schema.
- Keep the initial migration incremental: preserve the current React/state ownership and canvas rendering model while creating a cleaner boundary for future rendering and interaction optimizations.

## Capabilities

### Modified Capabilities

- `ai-design-canvas`: the canvas internals will use an abstract render engine so supported node types share a consistent rendering, bounds, and hit-testing contract without changing the user-facing editing model.

## Impact

- Affected spec: `ai-design-canvas`
- Affected code:
  - `apps/web/src/canvas/render.ts`
  - `apps/web/src/canvas/bounds.ts`
  - `apps/web/src/interaction/hitTest.ts`
  - `apps/web/src/canvas/CanvasStage.tsx`
  - new engine or adapter modules under `apps/web/src/canvas` or `apps/web/src/engine`
- Affected tests:
  - unit tests covering render dispatch, geometry, and hit testing
  - interaction tests that verify existing node editing behavior remains unchanged
- No persisted project schema migration is expected in this change
