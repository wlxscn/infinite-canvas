## Why

The current project is a local-first infinite canvas focused on basic geometric drawing. It supports pan/zoom, selection, undo/redo, and local save/load, but it cannot yet host a lightweight AI-assisted design workflow centered on images and text.

To move toward a Lovart-style direction without overreaching, the first step is to establish a minimal design-canvas foundation: users can generate or import image assets, place them on the canvas, combine them with text and simple shapes, then continue editing, saving, and exporting their work.

## What Changes

- Expand the canvas document model beyond geometric shapes so it can represent design-oriented nodes.
- Add support for image nodes and text nodes on the infinite canvas.
- Introduce a minimal asset store for uploaded and generated images.
- Introduce a minimal generation job model with pending, success, and failed states.
- Allow generated or uploaded assets to be inserted into the canvas and edited with basic transforms.
- Extend local persistence so documents, assets, and job state can be restored.
- Add a minimal export path for current canvas output and project JSON.

## Capabilities

### New Capabilities
- `ai-design-canvas`: Support a minimal AI-assisted design canvas workflow with image/text nodes, asset handling, generation job tracking, persistence, and export.

### Modified Capabilities

## Impact

- Affected modules include `src/types`, `src/state`, `src/canvas`, `src/interaction`, and `src/persistence`.
- The canvas document schema will change and requires backward-compatible local document loading or migration behavior.
- Undo/redo semantics will need to account for richer document edits and clarify whether generation job transitions enter history.
- New UI surface area is expected for prompt entry, asset browsing, and object property editing.
