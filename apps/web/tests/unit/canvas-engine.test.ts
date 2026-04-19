import { describe, expect, it, vi } from 'vitest';
import {
  canDrawLoadedImage,
  computeDragSnap,
  createCanvasInteractionController,
  createCanvasRenderRuntime,
  getAllDescendantNodes,
  getCanvasNodeBounds,
  getNodeAdapter,
  getNodeAdapterRegistry,
  getNodeParentGroupId,
  hitCanvasNodeResizeHandle,
  hitTestCanvasNode,
  moveNodeOutOfGroup,
  resizeCanvasNode,
  resolveConnectorPathPoints,
  resolveConnectorPoints,
  translateCanvasNode,
} from '@infinite-canvas/canvas-engine';
import { createEmptyProject, getNodeById, removeNodeById, upsertNode } from '../../src/state/store';
import { dissolveGroupNode, wrapNodeInNewGroup } from '../../src/state/store';
import type { CanvasNode } from '../../src/types/canvas';

function createDraftConnector(
  anchor: { nodeId: string; anchor: 'north' | 'east' | 'south' | 'west'; point: { x: number; y: number } },
  point = anchor.point,
  pathMode: 'straight' | 'polyline' = 'straight',
) {
  return {
    id: 'draft_connector',
    type: 'connector' as const,
    start: {
      kind: 'attached' as const,
      nodeId: anchor.nodeId,
      anchor: anchor.anchor,
    },
    end: {
      kind: 'free' as const,
      x: point.x,
      y: point.y,
    },
    pathMode,
    waypoints: pathMode === 'polyline' ? [{ x: point.x, y: anchor.point.y }] : [],
    stroke: '#c44e1c',
    width: 2,
  };
}

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
      {
        id: 'connector_1',
        type: 'connector',
        start: {
          kind: 'free',
          x: 30,
          y: 30,
        },
        end: {
          kind: 'free',
          x: 120,
          y: 90,
        },
        stroke: '#c44e1c',
        width: 2,
      },
      {
        id: 'group_1',
        type: 'group',
        x: 10,
        y: 10,
        w: 220,
        h: 160,
        children: [],
      },
    ];

    const registry = getNodeAdapterRegistry();

    expect(registry.size).toBe(7);
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

  it('stores group children in local coordinates and restores them to root world space when dissolved', () => {
    const base = createEmptyProject();
    const rootNode: CanvasNode = {
      id: 'node_rect_1',
      type: 'rect',
      x: 120,
      y: 80,
      w: 140,
      h: 100,
      stroke: '#000',
    };

    const wrappedNodes = wrapNodeInNewGroup([rootNode], rootNode.id);
    expect(wrappedNodes).toHaveLength(1);
    const group = wrappedNodes[0];
    expect(group.type).toBe('group');
    if (group.type !== 'group') {
      return;
    }

    expect(group.children[0]).toMatchObject({
      id: 'node_rect_1',
      x: 24,
      y: 24,
    });
    expect(getNodeParentGroupId(wrappedNodes, 'node_rect_1')).toBe(group.id);
    expect(getAllDescendantNodes(wrappedNodes)).toHaveLength(2);
    expect(
      getCanvasNodeBounds(group.children[0], {
        ...base.board,
        nodes: wrappedNodes,
      }),
    ).toMatchObject({
      x: 120,
      y: 80,
      w: 140,
      h: 100,
    });

    const movedOutNodes = moveNodeOutOfGroup(wrappedNodes, 'node_rect_1');
    expect(getNodeById(movedOutNodes, 'node_rect_1')).toMatchObject({
      x: 120,
      y: 80,
    });

    const dissolvedNodes = dissolveGroupNode(wrappedNodes, group.id);
    expect(dissolvedNodes).toHaveLength(1);
    expect(dissolvedNodes[0]).toMatchObject({
      id: 'node_rect_1',
      x: 120,
      y: 80,
    });
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

  it('derives connector geometry from attached endpoints and removes dependent connectors on delete', () => {
    const rectA: CanvasNode = {
      id: 'rect_a',
      type: 'rect',
      x: 40,
      y: 60,
      w: 120,
      h: 80,
      stroke: '#000',
    };
    const rectB: CanvasNode = {
      id: 'rect_b',
      type: 'rect',
      x: 280,
      y: 90,
      w: 140,
      h: 100,
      stroke: '#000',
    };
    const connector: CanvasNode = {
      id: 'connector_1',
      type: 'connector',
      start: {
        kind: 'attached',
        nodeId: 'rect_a',
        anchor: 'east',
      },
      end: {
        kind: 'attached',
        nodeId: 'rect_b',
        anchor: 'west',
      },
      stroke: '#c44e1c',
      width: 2,
    };
    const board = {
      version: 2 as const,
      viewport: { tx: 0, ty: 0, scale: 1 },
      nodes: [rectA, rectB, connector],
    };

    expect(getCanvasNodeBounds(connector, board)).toEqual({
      x: 160,
      y: 100,
      w: 120,
      h: 40,
    });
    expect(hitTestCanvasNode(connector, { x: 220, y: 120 }, 4, board)).toBe(true);
    expect(hitTestCanvasNode(connector, { x: 220, y: 170 }, 4, board)).toBe(false);
    expect(removeNodeById(board.nodes, 'rect_a').map((node) => node.id)).toEqual(['rect_b']);
  });

  it('resolves polyline connector paths and supports multi-segment hit testing', () => {
    const connector: CanvasNode = {
      id: 'connector_polyline',
      type: 'connector',
      start: {
        kind: 'free',
        x: 40,
        y: 40,
      },
      end: {
        kind: 'free',
        x: 220,
        y: 180,
      },
      pathMode: 'polyline',
      waypoints: [{ x: 220, y: 40 }],
      stroke: '#c44e1c',
      width: 2,
    };
    const board = {
      version: 2 as const,
      viewport: { tx: 0, ty: 0, scale: 1 },
      nodes: [connector],
    };

    expect(resolveConnectorPathPoints(connector, board)).toEqual([
      { x: 40, y: 40 },
      { x: 220, y: 40 },
      { x: 220, y: 180 },
    ]);
    expect(getCanvasNodeBounds(connector, board)).toEqual({
      x: 40,
      y: 40,
      w: 180,
      h: 140,
    });
    expect(hitTestCanvasNode(connector, { x: 160, y: 40 }, 4, board)).toBe(true);
    expect(hitTestCanvasNode(connector, { x: 220, y: 120 }, 4, board)).toBe(true);
    expect(hitTestCanvasNode(connector, { x: 150, y: 120 }, 4, board)).toBe(false);
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
      getActiveGroupId: () => null,
      getTool: () => 'select',
      isSpacePressed: () => false,
      getConnectorPathMode: () => 'straight',
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
      createConnectorNode: createDraftConnector,
      getNodeById,
      upsertNode,
      insertNodeIntoGroup: (nodes, _groupId, node) => [...nodes, node],
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
      getActiveGroupId: () => null,
      getTool: () => 'select',
      isSpacePressed: () => false,
      getConnectorPathMode: () => 'straight',
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
      createConnectorNode: createDraftConnector,
      getNodeById,
      upsertNode,
      insertNodeIntoGroup: (nodes, _groupId, node) => [...nodes, node],
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

  it('tracks hovered top-hit nodes only while idle in select mode', () => {
    const base = createEmptyProject();
    const project = {
      ...base,
      board: {
        ...base.board,
        nodes: [
          {
            id: 'node_rect_back',
            type: 'rect' as const,
            x: 40,
            y: 40,
            w: 180,
            h: 120,
            stroke: '#000',
          },
          {
            id: 'node_rect_front',
            type: 'rect' as const,
            x: 80,
            y: 70,
            w: 140,
            h: 100,
            stroke: '#000',
          },
        ],
      },
    };

    const controller = createCanvasInteractionController({
      project,
      selectedId: null,
      getActiveGroupId: () => null,
      getTool: () => 'select',
      isSpacePressed: () => false,
      getConnectorPathMode: () => 'straight',
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
      createConnectorNode: createDraftConnector,
      getNodeById,
      upsertNode,
      insertNodeIntoGroup: (nodes, _groupId, node) => [...nodes, node],
      onSelect: vi.fn(),
      onReplaceProject: vi.fn(),
      onCommitProject: vi.fn(),
      onFinalizeMutation: vi.fn(),
      render: vi.fn(),
      requestAnimationFrame: (() => 1) as typeof window.requestAnimationFrame,
      cancelAnimationFrame: (() => {}) as typeof window.cancelAnimationFrame,
    });

    controller.handlePointerMove({
      screenPoint: { x: 120, y: 100 },
      pointerId: 1,
      pointerType: 'mouse',
      button: 0,
    });
    expect(controller.getState().hoveredNodeId).toBe('node_rect_front');

    controller.handlePointerDown({
      screenPoint: { x: 120, y: 100 },
      pointerId: 1,
      pointerType: 'mouse',
      button: 0,
    });
    controller.handlePointerMove({
      screenPoint: { x: 140, y: 120 },
      pointerId: 1,
      pointerType: 'mouse',
      button: 0,
    });
    expect(controller.getState().hoveredNodeId).toBeNull();

    controller.handlePointerUp({
      screenPoint: { x: 140, y: 120 },
      pointerId: 1,
      pointerType: 'mouse',
      button: 0,
    });
    controller.handlePointerMove({
      screenPoint: { x: 10, y: 10 },
      pointerId: 2,
      pointerType: 'mouse',
      button: 0,
    });
    expect(controller.getState().hoveredNodeId).toBeNull();

    controller.dispose();
  });

  it('scopes selection to the active group context', () => {
    const base = createEmptyProject();
    const project = {
      ...base,
      board: {
        ...base.board,
        nodes: [
          {
            id: 'group_1',
            type: 'group' as const,
            x: 80,
            y: 60,
            w: 240,
            h: 180,
            children: [
              {
                id: 'node_rect_child',
                type: 'rect' as const,
                x: 24,
                y: 24,
                w: 120,
                h: 90,
                stroke: '#000',
              },
            ],
          },
        ],
      },
    };

    const onSelect = vi.fn();
    const rootController = createCanvasInteractionController({
      project,
      selectedId: null,
      getActiveGroupId: () => null,
      getTool: () => 'select',
      isSpacePressed: () => false,
      getConnectorPathMode: () => 'straight',
      createRectNode: (point) => ({ id: 'draft_rect', type: 'rect', x: point.x, y: point.y, w: 0, h: 0, stroke: '#000' }),
      createFreehandNode: (point) => ({ id: 'draft_line', type: 'freehand', points: [point], stroke: '#000', width: 2 }),
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
      createConnectorNode: createDraftConnector,
      getNodeById,
      upsertNode,
      insertNodeIntoGroup: (nodes, _groupId, node) => [...nodes, node],
      onSelect,
      onReplaceProject: vi.fn(),
      onCommitProject: vi.fn(),
      onFinalizeMutation: vi.fn(),
      render: vi.fn(),
      requestAnimationFrame: (() => 1) as typeof window.requestAnimationFrame,
      cancelAnimationFrame: (() => {}) as typeof window.cancelAnimationFrame,
    });

    rootController.handlePointerDown({
      screenPoint: { x: 130, y: 100 },
      pointerId: 1,
      pointerType: 'mouse',
      button: 0,
    });
    expect(onSelect).toHaveBeenCalledWith('group_1');
    rootController.dispose();

    const insideController = createCanvasInteractionController({
      project,
      selectedId: null,
      getActiveGroupId: () => 'group_1',
      getTool: () => 'select',
      isSpacePressed: () => false,
      getConnectorPathMode: () => 'straight',
      createRectNode: (point) => ({ id: 'draft_rect', type: 'rect', x: point.x, y: point.y, w: 0, h: 0, stroke: '#000' }),
      createFreehandNode: (point) => ({ id: 'draft_line', type: 'freehand', points: [point], stroke: '#000', width: 2 }),
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
      createConnectorNode: createDraftConnector,
      getNodeById,
      upsertNode,
      insertNodeIntoGroup: (nodes, _groupId, node) => [...nodes, node],
      onSelect,
      onReplaceProject: vi.fn(),
      onCommitProject: vi.fn(),
      onFinalizeMutation: vi.fn(),
      render: vi.fn(),
      requestAnimationFrame: (() => 1) as typeof window.requestAnimationFrame,
      cancelAnimationFrame: (() => {}) as typeof window.cancelAnimationFrame,
    });

    insideController.handlePointerDown({
      screenPoint: { x: 130, y: 100 },
      pointerId: 2,
      pointerType: 'mouse',
      button: 0,
    });
    expect(onSelect).toHaveBeenLastCalledWith('node_rect_child');
    insideController.dispose();
  });

  it('creates and reattaches connectors through the controller interaction state', () => {
    const base = createEmptyProject();
    const project = {
      ...base,
      board: {
        ...base.board,
        nodes: [
          {
            id: 'node_rect_a',
            type: 'rect' as const,
            x: 40,
            y: 40,
            w: 120,
            h: 80,
            stroke: '#000',
          },
          {
            id: 'node_rect_b',
            type: 'rect' as const,
            x: 300,
            y: 60,
            w: 140,
            h: 100,
            stroke: '#000',
          },
          {
            id: 'node_rect_c',
            type: 'rect' as const,
            x: 300,
            y: 240,
            w: 140,
            h: 100,
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
      selectedId: null,
      getActiveGroupId: () => null,
      getTool: () => 'connector',
      isSpacePressed: () => false,
      getConnectorPathMode: () => 'straight',
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
      createConnectorNode: createDraftConnector,
      getNodeById,
      upsertNode,
      insertNodeIntoGroup: (nodes, _groupId, node) => [...nodes, node],
      onSelect,
      onReplaceProject,
      onCommitProject,
      onFinalizeMutation,
      render: () => {},
      requestAnimationFrame: (() => 1) as typeof window.requestAnimationFrame,
      cancelAnimationFrame: (() => {}) as typeof window.cancelAnimationFrame,
    });

    controller.handlePointerDown({
      screenPoint: { x: 160, y: 80 },
      pointerId: 1,
      pointerType: 'mouse',
      button: 0,
    });
    controller.handlePointerMove({
      screenPoint: { x: 300, y: 110 },
      pointerId: 1,
      pointerType: 'mouse',
      button: 0,
    });
    controller.handlePointerUp({
      screenPoint: { x: 300, y: 110 },
      pointerId: 1,
      pointerType: 'mouse',
      button: 0,
    });

    const createdProject = onCommitProject.mock.calls[0][0];
    const connector = createdProject.board.nodes.find((node: CanvasNode) => node.type === 'connector');
    expect(connector).toBeTruthy();
    expect(connector).toMatchObject({
      start: { kind: 'attached', nodeId: 'node_rect_a', anchor: 'east' },
      end: { kind: 'attached', nodeId: 'node_rect_b', anchor: 'west' },
    });
    expect(onSelect).toHaveBeenLastCalledWith('draft_connector');

    const reattachController = createCanvasInteractionController({
      project: createdProject,
      selectedId: 'draft_connector',
      getActiveGroupId: () => null,
      getTool: () => 'select',
      isSpacePressed: () => false,
      getConnectorPathMode: () => 'straight',
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
      createConnectorNode: createDraftConnector,
      getNodeById,
      upsertNode,
      insertNodeIntoGroup: (nodes, _groupId, node) => [...nodes, node],
      onSelect,
      onReplaceProject,
      onCommitProject,
      onFinalizeMutation,
      render: () => {},
      requestAnimationFrame: (() => 1) as typeof window.requestAnimationFrame,
      cancelAnimationFrame: (() => {}) as typeof window.cancelAnimationFrame,
    });

    reattachController.handlePointerDown({
      screenPoint: { x: 300, y: 110 },
      pointerId: 2,
      pointerType: 'mouse',
      button: 0,
    });
    reattachController.handlePointerMove({
      screenPoint: { x: 300, y: 290 },
      pointerId: 2,
      pointerType: 'mouse',
      button: 0,
    });
    reattachController.handlePointerUp({
      screenPoint: { x: 300, y: 290 },
      pointerId: 2,
      pointerType: 'mouse',
      button: 0,
    });

    const reattachedProject = onCommitProject.mock.calls[1][0];
    const reattachedConnector = reattachedProject.board.nodes.find((node: CanvasNode) => node.id === 'draft_connector');
    expect(reattachedConnector).toMatchObject({
      end: { kind: 'attached', nodeId: 'node_rect_c', anchor: 'west' },
    });
    expect(resolveConnectorPoints(reattachedConnector, reattachedProject.board)?.end).toEqual({ x: 300, y: 290 });

    controller.dispose();
    reattachController.dispose();
  });

  it('creates polyline connectors and updates waypoint handles through the controller', () => {
    const base = createEmptyProject();
    const project = {
      ...base,
      board: {
        ...base.board,
        nodes: [
          {
            id: 'node_rect_a',
            type: 'rect' as const,
            x: 40,
            y: 40,
            w: 120,
            h: 80,
            stroke: '#000',
          },
          {
            id: 'node_rect_b',
            type: 'rect' as const,
            x: 300,
            y: 60,
            w: 140,
            h: 100,
            stroke: '#000',
          },
          {
            id: 'node_rect_c',
            type: 'rect' as const,
            x: 300,
            y: 240,
            w: 140,
            h: 100,
            stroke: '#000',
          },
        ],
      },
    };

    const onSelect = vi.fn();
    const onReplaceProject = vi.fn();
    const onCommitProject = vi.fn();
    const onFinalizeMutation = vi.fn();

    const createController = (nextProject: typeof project, selectedId: string | null, tool: 'select' | 'connector') =>
      createCanvasInteractionController({
        project: nextProject,
        selectedId,
        getActiveGroupId: () => null,
        getTool: () => tool,
        isSpacePressed: () => false,
        getConnectorPathMode: () => 'polyline',
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
        createConnectorNode: createDraftConnector,
        getNodeById,
        upsertNode,
        insertNodeIntoGroup: (nodes, _groupId, node) => [...nodes, node],
        onSelect,
        onReplaceProject,
        onCommitProject,
        onFinalizeMutation,
        render: () => {},
        requestAnimationFrame: (() => 1) as typeof window.requestAnimationFrame,
        cancelAnimationFrame: (() => {}) as typeof window.cancelAnimationFrame,
      });

    const controller = createController(project, null, 'connector');

    controller.handlePointerDown({
      screenPoint: { x: 160, y: 80 },
      pointerId: 1,
      pointerType: 'mouse',
      button: 0,
    });
    controller.handlePointerMove({
      screenPoint: { x: 300, y: 110 },
      pointerId: 1,
      pointerType: 'mouse',
      button: 0,
    });
    controller.handlePointerUp({
      screenPoint: { x: 300, y: 110 },
      pointerId: 1,
      pointerType: 'mouse',
      button: 0,
    });

    const createdProject = onCommitProject.mock.calls[0][0];
    const polylineConnector = createdProject.board.nodes.find((node: CanvasNode) => node.id === 'draft_connector');
    expect(polylineConnector).toMatchObject({
      pathMode: 'polyline',
      waypoints: [{ x: 300, y: 80 }],
    });

    const waypointController = createController(createdProject, 'draft_connector', 'select');
    waypointController.handlePointerDown({
      screenPoint: { x: 300, y: 80 },
      pointerId: 2,
      pointerType: 'mouse',
      button: 0,
    });
    waypointController.handlePointerMove({
      screenPoint: { x: 240, y: 180 },
      pointerId: 2,
      pointerType: 'mouse',
      button: 0,
    });
    waypointController.handlePointerUp({
      screenPoint: { x: 240, y: 180 },
      pointerId: 2,
      pointerType: 'mouse',
      button: 0,
    });

    const waypointEditedProject = onCommitProject.mock.calls[1][0];
    const waypointEditedConnector = waypointEditedProject.board.nodes.find((node: CanvasNode) => node.id === 'draft_connector');
    expect(waypointEditedConnector).toMatchObject({
      waypoints: [{ x: 240, y: 180 }],
    });

    const reattachController = createController(waypointEditedProject, 'draft_connector', 'select');
    reattachController.handlePointerDown({
      screenPoint: { x: 300, y: 110 },
      pointerId: 3,
      pointerType: 'mouse',
      button: 0,
    });
    reattachController.handlePointerMove({
      screenPoint: { x: 300, y: 290 },
      pointerId: 3,
      pointerType: 'mouse',
      button: 0,
    });
    reattachController.handlePointerUp({
      screenPoint: { x: 300, y: 290 },
      pointerId: 3,
      pointerType: 'mouse',
      button: 0,
    });

    const reattachedProject = onCommitProject.mock.calls[2][0];
    const reattachedConnector = reattachedProject.board.nodes.find((node: CanvasNode) => node.id === 'draft_connector');
    expect(reattachedConnector).toMatchObject({
      end: { kind: 'attached', nodeId: 'node_rect_c', anchor: 'west' },
      waypoints: [{ x: 240, y: 180 }],
    });

    controller.dispose();
    waypointController.dispose();
    reattachController.dispose();
  });
});
