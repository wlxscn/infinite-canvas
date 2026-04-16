import { describe, expect, it, vi } from 'vitest';
import {
  canDrawLoadedImage,
  computeDragSnap,
  createCanvasInteractionController,
  createCanvasRenderRuntime,
  getCanvasNodeBounds,
  getNodeAdapter,
  getNodeAdapterRegistry,
  hitCanvasNodeResizeHandle,
  hitTestCanvasNode,
  resizeCanvasNode,
  translateCanvasNode,
} from '@infinite-canvas/canvas-engine';
import { createEmptyProject, getNodeById, upsertNode } from '../../src/state/store';
import type { CanvasNode } from '../../src/types/canvas';

describe('canvas engine', () => {
  it('registers adapters for every supported node type', () => {
    const nodes: CanvasNode[] = [
      {
        id: 'rect_1',
        type: 'rect',
        x: 10,
        y: 20,
        w: 100,
        h: 80,
        stroke: '#000',
      },
      {
        id: 'freehand_1',
        type: 'freehand',
        points: [
          { x: 0, y: 0 },
          { x: 40, y: 20 },
        ],
        stroke: '#111',
        width: 2,
      },
      {
        id: 'text_1',
        type: 'text',
        x: 20,
        y: 30,
        w: 120,
        h: 60,
        text: 'Hello',
        color: '#222',
        fontSize: 18,
        fontFamily: 'sans-serif',
      },
      {
        id: 'image_1',
        type: 'image',
        x: 30,
        y: 40,
        w: 90,
        h: 70,
        assetId: 'asset_1',
      },
      {
        id: 'video_1',
        type: 'video',
        x: 40,
        y: 50,
        w: 140,
        h: 90,
        assetId: 'asset_2',
      },
    ];

    const registry = getNodeAdapterRegistry();

    expect(registry.size).toBe(5);
    expect(nodes.map((node) => getNodeAdapter(node).type)).toEqual(nodes.map((node) => node.type));
  });

  it('computes freehand bounds and hit testing through the shared adapter contract', () => {
    const freehand: CanvasNode = {
      id: 'freehand_1',
      type: 'freehand',
      points: [
        { x: 5, y: 10 },
        { x: 25, y: 30 },
        { x: 50, y: 20 },
      ],
      stroke: '#111',
      width: 4,
    };

    expect(getCanvasNodeBounds(freehand)).toEqual({
      x: 5,
      y: 10,
      w: 45,
      h: 20,
    });
    expect(hitTestCanvasNode(freehand, { x: 24, y: 28 }, 2)).toBe(true);
    expect(hitTestCanvasNode(freehand, { x: 80, y: 80 }, 2)).toBe(false);
  });

  it('translates and resizes supported nodes through shared engine helpers', () => {
    const rect: CanvasNode = {
      id: 'rect_1',
      type: 'rect',
      x: 10,
      y: 20,
      w: 100,
      h: 80,
      stroke: '#000',
    };
    const freehand: CanvasNode = {
      id: 'freehand_1',
      type: 'freehand',
      points: [
        { x: 1, y: 2 },
        { x: 5, y: 6 },
      ],
      stroke: '#111',
      width: 3,
    };

    expect(translateCanvasNode(rect, { x: 12, y: -4 })).toMatchObject({ x: 22, y: 16 });
    expect(resizeCanvasNode(rect, { x: 140, y: 120 })).toMatchObject({ w: 130, h: 100 });
    expect(translateCanvasNode(freehand, { x: 3, y: 4 })).toMatchObject({
      points: [
        { x: 4, y: 6 },
        { x: 8, y: 10 },
      ],
    });
    expect(resizeCanvasNode(freehand, { x: 100, y: 100 })).toEqual(freehand);
  });

  it('recreates runtime asset lookup data from project assets without mutating persisted project state', () => {
    const project = createEmptyProject();
    project.assets.push({
      id: 'asset_1',
      type: 'image',
      name: 'Hero',
      mimeType: 'image/png',
      src: 'data:image/png;base64,abc',
      width: 1200,
      height: 800,
      origin: 'generated',
      createdAt: 1,
    });

    const runtime = createCanvasRenderRuntime(project.assets);

    expect(runtime.assetMap.get('asset_1')?.name).toBe('Hero');
    expect('assetMap' in project).toBe(false);
  });

  it('only exposes resize handles for nodes whose adapters support resizing', () => {
    const image: CanvasNode = {
      id: 'image_1',
      type: 'image',
      x: 20,
      y: 30,
      w: 120,
      h: 90,
      assetId: 'asset_1',
    };
    const freehand: CanvasNode = {
      id: 'freehand_1',
      type: 'freehand',
      points: [
        { x: 20, y: 20 },
        { x: 40, y: 40 },
      ],
      stroke: '#111',
      width: 2,
    };

    expect(hitCanvasNodeResizeHandle(image, { x: 138, y: 118 }, 1, 14)).toBe(true);
    expect(hitCanvasNodeResizeHandle(freehand, { x: 40, y: 40 }, 1, 14)).toBe(false);
  });

  it('does not treat broken images as drawable canvas resources', () => {
    const brokenImage = {
      complete: true,
      naturalWidth: 0,
      naturalHeight: 0,
    } as HTMLImageElement;
    const readyImage = {
      complete: true,
      naturalWidth: 640,
      naturalHeight: 360,
    } as HTMLImageElement;

    expect(canDrawLoadedImage(brokenImage)).toBe(false);
    expect(canDrawLoadedImage(readyImage)).toBe(true);
  });

  it('keeps drag interaction state inside the controller and finalizes once on pointer up', () => {
    const base = createEmptyProject();
    const project = {
      ...base,
      board: {
        ...base.board,
        nodes: [
          {
            id: 'node_rect_1',
            type: 'rect' as const,
            x: 10,
            y: 20,
            w: 120,
            h: 90,
            stroke: '#000',
          },
        ],
      },
    };

    const onSelect = vi.fn();
    const onReplaceProject = vi.fn();
    const onCommitProject = vi.fn();
    const onFinalizeMutation = vi.fn();

    const controller = createCanvasInteractionController({
      project,
      selectedId: 'node_rect_1',
      getTool: () => 'select',
      isSpacePressed: () => false,
      createRectNode: (point) => ({
        id: 'draft_rect',
        type: 'rect',
        x: point.x,
        y: point.y,
        w: 0,
        h: 0,
        stroke: '#000',
      }),
      createFreehandNode: (point) => ({
        id: 'draft_line',
        type: 'freehand',
        points: [point],
        stroke: '#000',
        width: 2,
      }),
      createTextNode: (point) => ({
        id: 'draft_text',
        type: 'text',
        x: point.x,
        y: point.y,
        w: 100,
        h: 50,
        text: 'text',
        color: '#000',
        fontSize: 16,
        fontFamily: 'sans-serif',
      }),
      getNodeById,
      upsertNode,
      onSelect,
      onReplaceProject,
      onCommitProject,
      onFinalizeMutation,
      render: () => {},
      requestAnimationFrame: (() => 1) as typeof window.requestAnimationFrame,
      cancelAnimationFrame: (() => {}) as typeof window.cancelAnimationFrame,
    });

    controller.handlePointerDown({
      screenPoint: { x: 20, y: 30 },
      pointerId: 1,
      pointerType: 'mouse',
      button: 0,
    });

    controller.handlePointerMove({
      screenPoint: { x: 60, y: 70 },
      pointerId: 1,
      pointerType: 'mouse',
      button: 0,
    });

    controller.handlePointerUp({
      screenPoint: { x: 60, y: 70 },
      pointerId: 1,
      pointerType: 'mouse',
      button: 0,
    });

    expect(onSelect).toHaveBeenCalledWith('node_rect_1');
    expect(onReplaceProject).toHaveBeenCalledTimes(1);
    expect(onCommitProject).not.toHaveBeenCalled();
    expect(onFinalizeMutation).toHaveBeenCalledTimes(1);
    expect(onReplaceProject.mock.calls[0][0].board.nodes[0]).toMatchObject({ x: 50, y: 60 });

    controller.dispose();
  });

  it('snaps dragged nodes to nearby edges and centers within the screen threshold', () => {
    const node: CanvasNode = {
      id: 'drag_1',
      type: 'rect',
      x: 0,
      y: 0,
      w: 100,
      h: 80,
      stroke: '#000',
    };
    const target: CanvasNode = {
      id: 'target_1',
      type: 'rect',
      x: 180,
      y: 20,
      w: 120,
      h: 120,
      stroke: '#000',
    };

    const result = computeDragSnap({
      node,
      delta: { x: 78, y: 38 },
      nodes: [node, target],
      viewport: { tx: 0, ty: 0, scale: 1 },
    });

    expect(result.delta).toEqual({ x: 80, y: 40 });
    expect(result.matches.x?.target).toBe('start');
    expect(result.matches.y?.target).toBe('center');
    expect(result.guides).toHaveLength(2);
  });

  it('keeps freeform drag when candidates fall outside the snap threshold', () => {
    const node: CanvasNode = {
      id: 'drag_1',
      type: 'rect',
      x: 0,
      y: 0,
      w: 100,
      h: 80,
      stroke: '#000',
    };
    const target: CanvasNode = {
      id: 'target_1',
      type: 'rect',
      x: 180,
      y: 20,
      w: 120,
      h: 120,
      stroke: '#000',
    };

    const result = computeDragSnap({
      node,
      delta: { x: 70, y: 27 },
      nodes: [node, target],
      viewport: { tx: 0, ty: 0, scale: 1 },
    });

    expect(result.delta).toEqual({ x: 70, y: 27 });
    expect(result.guides).toEqual([]);
  });

  it('exposes snap guides during drag without creating extra finalize events', () => {
    const base = createEmptyProject();
    const project = {
      ...base,
      board: {
        ...base.board,
        nodes: [
          {
            id: 'node_rect_1',
            type: 'rect' as const,
            x: 10,
            y: 20,
            w: 120,
            h: 90,
            stroke: '#000',
          },
          {
            id: 'node_rect_2',
            type: 'rect' as const,
            x: 200,
            y: 30,
            w: 100,
            h: 120,
            stroke: '#000',
          },
        ],
      },
    };

    const onSelect = vi.fn();
    const onReplaceProject = vi.fn();
    const onCommitProject = vi.fn();
    const onFinalizeMutation = vi.fn();
    const onStateChange = vi.fn();

    const controller = createCanvasInteractionController({
      project,
      selectedId: 'node_rect_1',
      getTool: () => 'select',
      isSpacePressed: () => false,
      createRectNode: (point) => ({
        id: 'draft_rect',
        type: 'rect',
        x: point.x,
        y: point.y,
        w: 0,
        h: 0,
        stroke: '#000',
      }),
      createFreehandNode: (point) => ({
        id: 'draft_line',
        type: 'freehand',
        points: [point],
        stroke: '#000',
        width: 2,
      }),
      createTextNode: (point) => ({
        id: 'draft_text',
        type: 'text',
        x: point.x,
        y: point.y,
        w: 100,
        h: 50,
        text: 'text',
        color: '#000',
        fontSize: 16,
        fontFamily: 'sans-serif',
      }),
      getNodeById,
      upsertNode,
      onSelect,
      onReplaceProject,
      onCommitProject,
      onFinalizeMutation,
      onStateChange,
      render: () => {},
      requestAnimationFrame: (() => 1) as typeof window.requestAnimationFrame,
      cancelAnimationFrame: (() => {}) as typeof window.cancelAnimationFrame,
    });

    controller.handlePointerDown({
      screenPoint: { x: 20, y: 30 },
      pointerId: 1,
      pointerType: 'mouse',
      button: 0,
    });

    controller.handlePointerMove({
      screenPoint: { x: 96, y: 40 },
      pointerId: 1,
      pointerType: 'mouse',
      button: 0,
    });

    expect(controller.getState().snapGuides).toHaveLength(2);

    controller.handlePointerUp({
      screenPoint: { x: 96, y: 40 },
      pointerId: 1,
      pointerType: 'mouse',
      button: 0,
    });

    const draggedNode = onReplaceProject.mock.calls[0][0].board.nodes.find((node: CanvasNode) => node.id === 'node_rect_1');
    expect(draggedNode).toMatchObject({ x: 80, y: 30 });
    expect(controller.getState().snapGuides).toEqual([]);
    expect(onFinalizeMutation).toHaveBeenCalledTimes(1);
    expect(onCommitProject).not.toHaveBeenCalled();
    expect(onStateChange).toHaveBeenCalled();

    controller.dispose();
  });
});
