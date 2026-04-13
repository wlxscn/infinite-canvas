import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from 'react';
import { getNodeBounds, normalizeBounds, pointInBounds } from './bounds';
import { maybeAppendPoint, renderScene, scaleTolerance } from './render';
import { clampScale, screenToWorld, zoomAtScreenPoint } from '../geometry/transform';
import { pickTopNode } from '../interaction/hitTest';
import { createId } from '../utils/id';
import type {
  BoardDoc,
  CanvasNode,
  CanvasProject,
  FreehandNode,
  ImageNode,
  Point,
  RectNode,
  TextNode,
  Tool,
} from '../types/canvas';
import { getNodeById, upsertNode } from '../state/store';

interface CanvasStageProps {
  project: CanvasProject;
  tool: Tool;
  selectedId: string | null;
  isSpacePressed: boolean;
  onSelect: (id: string | null) => void;
  onReplaceProject: (project: CanvasProject) => void;
  onCommitProject: (project: CanvasProject) => void;
  onFinalizeMutation: (beforeProject: CanvasProject, afterProject: CanvasProject) => void;
}

type PointerMode = 'idle' | 'panning' | 'dragging-node' | 'drawing-rect' | 'drawing-freehand' | 'resizing-node' | 'pinch';

const RESIZE_HANDLE_SIZE = 14;

function moveNode(node: CanvasNode, dx: number, dy: number): CanvasNode {
  if (node.type === 'freehand') {
    return {
      ...node,
      points: node.points.map((point) => ({
        x: point.x + dx,
        y: point.y + dy,
      })),
    };
  }

  return {
    ...node,
    x: node.x + dx,
    y: node.y + dy,
  };
}

function resizeNode(node: CanvasNode, pointer: Point): CanvasNode {
  if (node.type === 'freehand') {
    return node;
  }

  const nextWidth = Math.max(pointer.x - node.x, 24);
  const nextHeight = Math.max(pointer.y - node.y, 24);
  return {
    ...node,
    w: nextWidth,
    h: nextHeight,
  } satisfies RectNode | ImageNode | TextNode;
}

function isResizeHandleHit(node: CanvasNode, point: Point, scale: number): boolean {
  if (node.type === 'freehand') {
    return false;
  }

  const bounds = normalizeBounds(getNodeBounds(node));
  return pointInBounds(
    point,
    {
      x: bounds.x + bounds.w - RESIZE_HANDLE_SIZE / scale,
      y: bounds.y + bounds.h - RESIZE_HANDLE_SIZE / scale,
      w: RESIZE_HANDLE_SIZE / scale,
      h: RESIZE_HANDLE_SIZE / scale,
    },
    2 / scale,
  );
}

export function CanvasStage({
  project,
  tool,
  selectedId,
  isSpacePressed,
  onSelect,
  onReplaceProject,
  onCommitProject,
  onFinalizeMutation,
}: CanvasStageProps) {
  const boardRef = useRef(project.board);
  const projectRef = useRef(project);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [draftRect, setDraftRect] = useState<RectNode | null>(null);
  const [draftFreehand, setDraftFreehand] = useState<FreehandNode | null>(null);
  const [pointerMode, setPointerMode] = useState<PointerMode>('idle');

  const pointerModeRef = useRef<PointerMode>('idle');
  const activePointerIdRef = useRef<number | null>(null);
  const startScreenRef = useRef<Point | null>(null);
  const startWorldRef = useRef<Point | null>(null);
  const beforeMutationRef = useRef<CanvasProject | null>(null);
  const activeNodeIdRef = useRef<string | null>(null);

  const touchPointsRef = useRef<Map<number, Point>>(new Map());
  const pinchRef = useRef<{
    distance: number;
    center: Point;
    viewport: BoardDoc['viewport'];
  } | null>(null);

  const cursor = useMemo(() => {
    if (pointerMode === 'panning' || pointerMode === 'pinch') {
      return 'grabbing';
    }
    if (pointerMode === 'resizing-node') {
      return 'nwse-resize';
    }
    if (tool === 'pan' || isSpacePressed) {
      return 'grab';
    }
    if (tool === 'rect' || tool === 'freehand' || tool === 'text') {
      return 'crosshair';
    }
    return 'default';
  }, [isSpacePressed, pointerMode, tool]);

  useEffect(() => {
    boardRef.current = project.board;
    projectRef.current = project;
  }, [project]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    renderScene({
      canvas,
      board: project.board,
      assets: project.assets,
      selectedId,
      draftRect,
      draftFreehand,
    });
  }, [project, selectedId, draftRect, draftFreehand]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const observer = new ResizeObserver(() => {
      const canvas = canvasRef.current;
      if (!canvas) {
        return;
      }
      renderScene({
        canvas,
        board: project.board,
        assets: project.assets,
        selectedId,
        draftRect,
        draftFreehand,
      });
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, [project, selectedId, draftRect, draftFreehand]);

  function getEventPoint(
    event: PointerEvent | ReactPointerEvent<HTMLCanvasElement> | ReactWheelEvent<HTMLCanvasElement>,
  ): Point {
    const rect = canvasRef.current?.getBoundingClientRect();
    return {
      x: event.clientX - (rect?.left ?? 0),
      y: event.clientY - (rect?.top ?? 0),
    };
  }

  function updateBoard(board: BoardDoc): CanvasProject {
    return {
      ...projectRef.current,
      board,
    };
  }

  function setMode(mode: PointerMode): void {
    pointerModeRef.current = mode;
    setPointerMode(mode);
  }

  function startPan(screenPoint: Point): void {
    setMode('panning');
    startScreenRef.current = screenPoint;
  }

  function startNodeInteraction(mode: PointerMode, nodeId: string, worldPoint: Point): void {
    setMode(mode);
    activeNodeIdRef.current = nodeId;
    startWorldRef.current = worldPoint;
    beforeMutationRef.current = projectRef.current;
  }

  function startRect(worldPoint: Point): void {
    setMode('drawing-rect');
    setDraftRect({
      id: createId('node'),
      type: 'rect',
      x: worldPoint.x,
      y: worldPoint.y,
      w: 0,
      h: 0,
      stroke: '#0f172a',
      fill: 'rgba(59, 130, 246, 0.2)',
    });
  }

  function startFreehand(worldPoint: Point): void {
    setMode('drawing-freehand');
    setDraftFreehand({
      id: createId('node'),
      type: 'freehand',
      points: [worldPoint],
      stroke: '#0f172a',
      width: 2,
    });
  }

  function endInteraction(): void {
    setMode('idle');
    activePointerIdRef.current = null;
    activeNodeIdRef.current = null;
    startScreenRef.current = null;
    startWorldRef.current = null;
    beforeMutationRef.current = null;
  }

  function beginPinchIfNeeded(): void {
    if (touchPointsRef.current.size < 2) {
      return;
    }

    const points = [...touchPointsRef.current.values()];
    const center = {
      x: (points[0].x + points[1].x) / 2,
      y: (points[0].y + points[1].y) / 2,
    };

    const distance = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);

    setMode('pinch');
    pinchRef.current = {
      distance,
      center,
      viewport: boardRef.current.viewport,
    };

    setDraftRect(null);
    setDraftFreehand(null);
    beforeMutationRef.current = null;
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLCanvasElement>): void {
    const currentProject = projectRef.current;
    const currentBoard = currentProject.board;
    const screenPoint = getEventPoint(event);
    const worldPoint = screenToWorld(screenPoint, currentBoard.viewport);

    if (event.pointerType === 'touch') {
      touchPointsRef.current.set(event.pointerId, screenPoint);
      if (touchPointsRef.current.size >= 2) {
        beginPinchIfNeeded();
      }
    }

    if (pointerModeRef.current === 'pinch') {
      event.currentTarget.setPointerCapture(event.pointerId);
      return;
    }

    activePointerIdRef.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);

    const shouldPan = tool === 'pan' || isSpacePressed || event.button === 1;
    if (shouldPan) {
      startPan(screenPoint);
      return;
    }

    const tolerance = scaleTolerance(6, currentBoard.viewport.scale);

    if (tool === 'select') {
      const selectedNode = getNodeById(currentBoard.nodes, selectedId);
      if (selectedNode && isResizeHandleHit(selectedNode, worldPoint, currentBoard.viewport.scale)) {
        startNodeInteraction('resizing-node', selectedNode.id, worldPoint);
        return;
      }

      const pickedId = pickTopNode(currentBoard.nodes, worldPoint, tolerance);
      onSelect(pickedId);

      if (pickedId) {
        startNodeInteraction('dragging-node', pickedId, worldPoint);
      }
      return;
    }

    if (tool === 'rect') {
      onSelect(null);
      startRect(worldPoint);
      return;
    }

    if (tool === 'freehand') {
      onSelect(null);
      startFreehand(worldPoint);
      return;
    }

    if (tool === 'text') {
      const node: TextNode = {
        id: createId('node'),
        type: 'text',
        x: worldPoint.x,
        y: worldPoint.y,
        w: 220,
        h: 72,
        text: '新建文本',
        color: '#0f172a',
        fontSize: 20,
        fontFamily: 'Space Grotesk, Avenir Next, Segoe UI, sans-serif',
      };
      const nextProject = updateBoard({
        ...currentBoard,
        nodes: [...currentBoard.nodes, node],
      });
      onCommitProject(nextProject);
      onSelect(node.id);
    }
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLCanvasElement>): void {
    const currentProject = projectRef.current;
    const currentBoard = currentProject.board;
    const screenPoint = getEventPoint(event);

    if (event.pointerType === 'touch') {
      touchPointsRef.current.set(event.pointerId, screenPoint);
    }

    if (pointerModeRef.current === 'pinch') {
      if (touchPointsRef.current.size < 2 || !pinchRef.current) {
        return;
      }

      const points = [...touchPointsRef.current.values()];
      const center = {
        x: (points[0].x + points[1].x) / 2,
        y: (points[0].y + points[1].y) / 2,
      };
      const distance = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
      if (distance <= 0) {
        return;
      }

      const ratio = distance / pinchRef.current.distance;
      const nextScale = clampScale(pinchRef.current.viewport.scale * ratio);
      const startCenterWorld = screenToWorld(pinchRef.current.center, pinchRef.current.viewport);

      onReplaceProject(
        updateBoard({
          ...currentBoard,
          viewport: {
            tx: center.x - startCenterWorld.x * nextScale,
            ty: center.y - startCenterWorld.y * nextScale,
            scale: nextScale,
          },
        }),
      );
      return;
    }

    if (activePointerIdRef.current !== event.pointerId) {
      return;
    }

    if (pointerModeRef.current === 'panning' && startScreenRef.current) {
      const dx = screenPoint.x - startScreenRef.current.x;
      const dy = screenPoint.y - startScreenRef.current.y;
      startScreenRef.current = screenPoint;
      onReplaceProject(
        updateBoard({
          ...currentBoard,
          viewport: {
            ...currentBoard.viewport,
            tx: currentBoard.viewport.tx + dx,
            ty: currentBoard.viewport.ty + dy,
          },
        }),
      );
      return;
    }

    const worldPoint = screenToWorld(screenPoint, currentBoard.viewport);

    if (pointerModeRef.current === 'dragging-node' && startWorldRef.current && activeNodeIdRef.current) {
      const dx = worldPoint.x - startWorldRef.current.x;
      const dy = worldPoint.y - startWorldRef.current.y;
      startWorldRef.current = worldPoint;

      const node = getNodeById(currentBoard.nodes, activeNodeIdRef.current);
      if (!node) {
        return;
      }

      onReplaceProject(
        updateBoard({
          ...currentBoard,
          nodes: upsertNode(currentBoard.nodes, moveNode(node, dx, dy)),
        }),
      );
      return;
    }

    if (pointerModeRef.current === 'resizing-node' && activeNodeIdRef.current) {
      const node = getNodeById(currentBoard.nodes, activeNodeIdRef.current);
      if (!node) {
        return;
      }

      onReplaceProject(
        updateBoard({
          ...currentBoard,
          nodes: upsertNode(currentBoard.nodes, resizeNode(node, worldPoint)),
        }),
      );
      return;
    }

    if (pointerModeRef.current === 'drawing-rect' && draftRect) {
      setDraftRect({
        ...draftRect,
        w: worldPoint.x - draftRect.x,
        h: worldPoint.y - draftRect.y,
      });
      return;
    }

    if (pointerModeRef.current === 'drawing-freehand' && draftFreehand) {
      const points = maybeAppendPoint(
        draftFreehand.points,
        worldPoint,
        scaleTolerance(1.5, currentBoard.viewport.scale),
      );
      if (points !== draftFreehand.points) {
        setDraftFreehand({
          ...draftFreehand,
          points,
        });
      }
    }
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLCanvasElement>): void {
    const currentProject = projectRef.current;
    const currentBoard = currentProject.board;

    if (event.pointerType === 'touch') {
      touchPointsRef.current.delete(event.pointerId);
      if (touchPointsRef.current.size < 2) {
        pinchRef.current = null;
        if (pointerModeRef.current === 'pinch') {
          setMode('idle');
        }
      }
    }

    if ((pointerModeRef.current === 'dragging-node' || pointerModeRef.current === 'resizing-node') && beforeMutationRef.current) {
      onFinalizeMutation(beforeMutationRef.current, currentProject);
    }

    if (pointerModeRef.current === 'drawing-rect' && draftRect) {
      if (Math.abs(draftRect.w) > 1 && Math.abs(draftRect.h) > 1) {
        const nextProject = updateBoard({
          ...currentBoard,
          nodes: [...currentBoard.nodes, draftRect],
        });
        onCommitProject(nextProject);
        onSelect(draftRect.id);
      }
      setDraftRect(null);
    }

    if (pointerModeRef.current === 'drawing-freehand' && draftFreehand) {
      if (draftFreehand.points.length > 1) {
        const nextProject = updateBoard({
          ...currentBoard,
          nodes: [...currentBoard.nodes, draftFreehand],
        });
        onCommitProject(nextProject);
        onSelect(draftFreehand.id);
      }
      setDraftFreehand(null);
    }

    if (activePointerIdRef.current === event.pointerId || event.pointerType === 'touch') {
      endInteraction();
    }
  }

  function handleWheel(event: ReactWheelEvent<HTMLCanvasElement>): void {
    event.preventDefault();
    const currentBoard = boardRef.current;
    const point = getEventPoint(event);
    const zoomFactor = event.deltaY > 0 ? 0.92 : 1.08;
    const viewport = zoomAtScreenPoint(currentBoard.viewport, point, zoomFactor);
    onReplaceProject(updateBoard({ ...currentBoard, viewport }));
  }

  return (
    <div className="canvas-stage" ref={containerRef}>
      <canvas
        ref={canvasRef}
        className="canvas-surface"
        style={{ cursor }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onWheel={handleWheel}
      />
    </div>
  );
}
