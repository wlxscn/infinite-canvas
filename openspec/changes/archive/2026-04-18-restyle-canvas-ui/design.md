## Context

The current UI exposes the editor through a top toolbar plus left and right side panels. This gives every subsystem persistent visual weight, which makes the app feel more like a dashboard than a design surface. The reference image suggests a different hierarchy: a near-empty canvas, small floating controls, and contextual editing surfaces that appear close to the object being manipulated.

The underlying data model and editor capabilities do not need to change for this work. The change is mostly presentation and layout, but it spans multiple modules because the current UI composition is concentrated in `src/App.tsx`, while selected-object rendering cues live in `src/canvas/render.ts` and `src/canvas/CanvasStage.tsx`.

Likely modules involved:
- `src/App.tsx`: restructure the visible editor chrome and move controls into floating surfaces
- `src/index.css`: replace the current application-shell styling with a quieter canvas-first visual system
- `src/canvas/CanvasStage.tsx`: expose or support any positional data needed for contextual controls if required
- `src/canvas/render.ts`: ensure selection visuals still feel coherent with the lighter interface
- `tests/e2e/canvas.spec.ts`: adjust selectors or expectations affected by UI relocation

## Goals / Non-Goals

**Goals:**
- Make the canvas visually dominant and reduce the sense of permanent panel chrome.
- Introduce a floating bottom tool dock that becomes the primary mode switcher.
- Provide a floating contextual toolbar for selected objects that surfaces the most relevant controls near the object.
- Keep prompt, assets, and lightweight properties accessible without reintroducing heavy sidebars.
- Preserve current editor capabilities, shortcuts, persistence, and export behavior.

**Non-Goals:**
- Redesign the board data model or editing engine
- Add new node types, new export formats, or new generation features
- Match the reference product pixel-for-pixel
- Remove existing capabilities from the UI altogether

## Decisions

### 1. Treat this as a layout and visual hierarchy change, not a capability change

The core implementation should preserve existing editing flows and only change how they are surfaced.

Why:
- The current functionality is already implemented and tested.
- Keeping behavior stable reduces the risk of coupling a visual refresh to deeper editor regressions.

Alternative considered:
- Combining the UI refresh with new canvas editing features.
This was rejected because it would make scope harder to review and blur whether regressions come from layout or behavior changes.

### 2. Replace persistent sidebars with compact floating cards

Prompt entry, asset access, and lightweight properties should remain available, but as smaller floating surfaces with less dominance than the canvas.

Why:
- The reference direction emphasizes visual quietness and open space.
- Floating cards preserve access to existing features without requiring a large navigation rewrite.

Alternative considered:
- Fully hiding these tools behind modal drawers.
This was rejected because it would make existing flows slower and could reduce discoverability.

### 3. Use a contextual object toolbar near the selection

Common object-level controls such as dimensions and ordering should appear adjacent to the selected node rather than only in a distant inspector.

Why:
- This better matches the reference interaction language.
- It reduces the eye travel required for object editing.

Alternative considered:
- Keep all object controls inside a dedicated right-side inspector.
This was rejected because it preserves the old dashboard feel the change is trying to remove.

### 4. Preserve existing labels and action affordances where practical

The UI should move controls and restyle them, but keep core actions recognizable so the current tests and user habits can be adapted incrementally.

Why:
- This reduces migration friction.
- It helps ensure that the change is a restyle rather than a functional rewrite.

Alternative considered:
- Rename or iconify all controls immediately.
This was rejected because it would unnecessarily increase change surface.

## Risks / Trade-offs

- [Floating controls may overlap important canvas content] → Keep cards compact and anchor contextual controls near the selection with safe offsets.
- [Minimal chrome can make features harder to discover] → Preserve clear labels for generation, upload, save, and export while reducing visual weight.
- [Responsive behavior may degrade on narrow screens] → Define explicit mobile fallbacks so floating groups can stack without covering the whole canvas.
- [E2E tests may become brittle after layout relocation] → Favor role/text selectors over container-specific assumptions and update tests alongside the UI.

## Migration Plan

- Implement the new floating layout in `src/App.tsx` and `src/index.css` without changing persistence or project data.
- Keep existing action handlers and tool wiring intact so rollback is largely a matter of reverting presentation files.
- Adjust tests after the new layout is stable.

## Open Questions

- Should the prompt composer remain always visible, or collapse when the user is actively editing on canvas?
- Should the asset surface be a compact strip or a small card with preview thumbnails?
- How much of the current properties inspector should move into the floating selection toolbar versus remain in a secondary card?
