## 1. Document And Persistence Foundation

- [ ] 1.1 Redesign `src/types/canvas.ts` from shape-first data to a node-oriented board/project model that includes image nodes, text nodes, assets, and generation jobs.
- [ ] 1.2 Update `src/persistence/local.ts` to save and load the richer project state with backward-compatible handling for legacy shape-only local data.
- [ ] 1.3 Update `src/state/store.ts` so history, selection state, and document mutations work with the new board model and defined job/asset semantics.

## 2. Rendering And Interaction

- [ ] 2.1 Extend `src/canvas/render.ts` to render image nodes and text nodes alongside existing geometric content.
- [ ] 2.2 Extend `src/interaction/hitTest.ts` and `src/canvas/CanvasStage.tsx` to support selection, movement, and resize interactions for the new node types.
- [ ] 2.3 Add minimal z-order manipulation support in the board interaction flow so overlapping nodes can be reordered.

## 3. Asset And Generation Workflow

- [ ] 3.1 Add a minimal asset management flow in `src/App.tsx` and supporting modules for uploading images and listing uploaded/generated assets.
- [ ] 3.2 Add a minimal generation job flow with visible pending, success, and failed states that can feed successful outputs into the asset store.
- [ ] 3.3 Add insertion flows that place an uploaded or generated asset onto the canvas as an image node.

## 4. Text Editing And Editing UI

- [ ] 4.1 Add a minimal text-node creation flow and basic text content editing UI.
- [ ] 4.2 Add a compact properties surface for editing selected node basics such as position, size, text content, or ordering where applicable.
- [ ] 4.3 Ensure existing pan/zoom, selection, and undo/redo behavior remain coherent after the new editing features are introduced.

## 5. Export And Validation

- [ ] 5.1 Add export support for current board output and project JSON.
- [ ] 5.2 Add or update unit tests for document migration, node mutations, history behavior, and render-adjacent helpers using `pnpm test`.
- [ ] 5.3 Add or update end-to-end coverage for upload/generate/insert/edit/export flows using `pnpm test:e2e`.
- [ ] 5.4 Validate the final change with `pnpm lint`, `pnpm test`, `pnpm build`, and `pnpm test:e2e`.
