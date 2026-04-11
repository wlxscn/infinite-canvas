## Context

The existing app is structured around a small `CanvasDoc` containing `viewport` and `shapes[]`, rendered through a single canvas stage and persisted to local storage. This is sufficient for a whiteboard-like experience, but not for a design workflow where images, text, and generated assets must coexist on the board and remain editable.

This change is cross-cutting because it touches the document model, rendering, hit testing, state transitions, persistence, and UI composition. The goal is not to implement a full Lovart-like agent system, but to establish the smallest architecture that can host generated image assets inside the infinite canvas and allow users to arrange them with text.

Likely modules involved:
- `src/types/canvas.ts`: evolve document and node types
- `src/state/store.ts`: support richer document updates, selection, and history semantics
- `src/canvas/CanvasStage.tsx`: expand pointer interactions for image/text nodes and frame-aware insertion
- `src/canvas/render.ts`: render heterogeneous node types instead of only geometric shapes
- `src/interaction/hitTest.ts`: support node hit testing and bounds-based selection
- `src/persistence/local.ts`: load/save richer project state with compatibility handling
- `src/App.tsx`: host prompt, asset, and property editing UI

## Goals / Non-Goals

**Goals:**
- Introduce a minimal node-based canvas model that supports image and text content.
- Add a lightweight asset store for uploaded and generated images.
- Add a lightweight generation job model that can surface async status in the UI.
- Preserve existing infinite-canvas behavior such as pan/zoom and undo/redo where possible.
- Keep the implementation local-first and incremental so the current architecture remains recognizable.

**Non-Goals:**
- Full agentic planning, reference retrieval, or multi-step AI orchestration
- Real-time collaboration or cloud project sync
- Advanced image editing such as inpainting, masking, or region replacement
- Advanced typography, template systems, or full design-system authoring
- Multi-board project management beyond what is needed to support one board and its assets

## Decisions

### 1. Evolve the document from shape-first to node-first

The document should move from a pure `shapes[]` model to a richer board model centered on `nodes[]`, while still allowing simple geometric nodes to remain part of the board.

Why:
- Image and text objects do not fit cleanly into the current `Shape` union without overloading geometry-specific assumptions.
- A node-first model creates a stable base for future frame, group, and component support.

Alternative considered:
- Extend `Shape` with image and text variants.
This was rejected because it would blur the difference between geometric drawing primitives and design objects, and make later evolution harder.

### 2. Keep generation jobs separate from canvas nodes

Generation jobs should live alongside the document model rather than inside `nodes[]`. Successful jobs produce assets, and assets can then be inserted as image nodes.

Why:
- Job lifecycle state is operational metadata, not a renderable board object by default.
- Separating jobs from nodes keeps undo/redo semantics clearer and avoids polluting render logic with async task state.

Alternative considered:
- Represent each job as a placeholder node on the canvas.
This may become useful later, but is unnecessary for the first phase and would complicate interaction design.

### 3. Introduce project-level local persistence

Persistence should evolve from saving only `CanvasDoc` to saving a project-shaped object that includes document, assets, and generation job records.

Why:
- The minimal workflow needs assets and job state to survive refresh.
- This keeps restore behavior aligned with the intended user experience of continuing design work later.

Alternative considered:
- Persist only the canvas and rebuild assets/jobs externally.
This was rejected because it would break the local-first editing loop and make generated content unreliable after refresh.

### 4. Reuse the existing rendering and store flow before introducing a new framework

The first phase should extend the current React + canvas rendering pipeline and store helper approach rather than introducing a new editor engine or state library.

Why:
- The current codebase is small and understandable.
- Incremental extension reduces migration risk and keeps the change reviewable.

Alternative considered:
- Introduce a dedicated scene graph or external editor framework immediately.
This was rejected for phase 1 because it increases complexity before the minimal workflow is proven.

### 5. Keep editing scope intentionally narrow

Phase 1 editing should cover insertion, selection, move, resize, ordering, and basic text editing only.

Why:
- These operations are sufficient to validate the design-canvas direction.
- Expanding to rotation, snapping, masking, and advanced typography would broaden the change too much.

Alternative considered:
- Include a fuller Figma-like editing model from the start.
This was rejected because it would delay the first usable milestone and obscure the minimal product objective.

## Risks / Trade-offs

- [Document schema migration complexity] -> Add a compatibility layer or migration path when loading old locally stored documents.
- [Undo/redo becomes ambiguous across canvas edits, assets, and jobs] -> Define history scope explicitly so board edits are reversible while operational job transitions can be excluded if needed.
- [Single-canvas rendering becomes harder to maintain with mixed node types] -> Keep node rendering modular and bounds-driven so new node kinds do not sprawl across the stage component.
- [UI surface area grows quickly] -> Limit phase 1 UI to a prompt entry point, a minimal asset list, and a compact property panel.
- [AI generation integration may be unstable or delayed] -> Design the job/asset flow so uploaded assets and mocked job results can exercise the same canvas insertion path.

## Migration Plan

- Introduce versioned project persistence that can detect old shape-only documents.
- On load, convert legacy stored data into the new project/document format when possible.
- Keep legacy geometric content renderable so existing local drawings are not discarded.
- Rollback strategy: if the richer project format proves unstable, preserve a fallback path that loads a default empty project instead of crashing the app.

## Open Questions

- Should selection be single-select only in the first delivery, or is lightweight multi-select necessary for the workflow to feel credible?
- Should successful generation automatically insert an image node into the board, or only add it to the asset list for user-driven placement?
- Is a `FrameNode` required in phase 1, or can the first version rely on a freeform board with image and text placement only?
- Should text editing happen inline on canvas, or via a property panel first to reduce implementation complexity?
