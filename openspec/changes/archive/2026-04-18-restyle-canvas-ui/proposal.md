## Why

The current UI works functionally, but it still reads like a three-column application shell rather than a canvas-first design surface. The reference direction calls for a calmer, lighter interface where the canvas dominates and controls appear as sparse floating chrome around the work.

Refining the UI now will make the editor feel closer to the intended Lovart-inspired experience without changing the underlying board, asset, and editing model that was just established.

## What Changes

- Restyle the main editor layout from a panel-heavy workspace to a canvas-first composition with floating chrome.
- Replace the current full-width top toolbar with a lighter header treatment and compact status/actions.
- Rework the primary tool affordances into a floating bottom dock inspired by the reference composition.
- Introduce a contextual floating selection toolbar near the selected object for common editing controls and dimensions.
- Convert prompt, asset, and lightweight property controls into smaller floating surfaces instead of dominant side columns.
- Preserve all current editing behavior and feature availability while changing visual hierarchy and placement.

## Capabilities

### New Capabilities

### Modified Capabilities
- `ai-design-canvas`: Refine the editor’s interface chrome and object editing presentation so the canvas remains the dominant visual surface while existing actions stay accessible.

## Impact

- Affected code will primarily be in `src/App.tsx`, `src/index.css`, and supporting canvas presentation logic.
- Existing `ai-design-canvas` requirements will gain UI-specific behavior around control presentation and contextual editing.
- Interaction affordances for existing tools, assets, and properties will move visually, so end-to-end tests will likely need updates.
