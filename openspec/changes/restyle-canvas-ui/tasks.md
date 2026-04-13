## 1. Layout Restructure

- [x] 1.1 Refactor `src/App.tsx` to replace the current three-column workspace shell with a canvas-first composition built around floating UI surfaces.
- [x] 1.2 Reposition primary actions such as save, export, upload, and generation into lighter floating groups without removing their current functionality.
- [x] 1.3 Move tool switching into a bottom-centered floating dock inspired by the reference composition.

## 2. Contextual Editing Chrome

- [x] 2.1 Add a floating selection toolbar near the selected object that shows compact object metadata and high-frequency controls.
- [x] 2.2 Reduce reliance on the current persistent right-side properties column by moving the most important controls into contextual or compact floating UI.
- [x] 2.3 Keep existing selection, resizing, and ordering behavior intact while updating their visual presentation.

## 3. Visual System

- [x] 3.1 Rewrite `src/index.css` to match the quieter reference direction with a brighter canvas, softer floating cards, and reduced dashboard framing.
- [x] 3.2 Adjust canvas container styling and spacing so the board feels nearly full-bleed while remaining responsive on smaller screens.
- [x] 3.3 Preserve accessibility and legibility for Chinese UI labels after the visual restyle.

## 4. Validation

- [x] 4.1 Update end-to-end checks in `tests/e2e/canvas.spec.ts` for the new control placement while keeping the same core workflows covered.
- [x] 4.2 Verify the refreshed UI with `pnpm lint`, `pnpm test`, `pnpm build`, and `pnpm test:e2e`.
