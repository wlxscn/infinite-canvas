import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from 'react';
import { maybeAppendPoint, renderScene, scaleTolerance } from './render';
import { clampScale, screenToWorld, zoomAtScreenPoint } from '../geometry/transform';
import { pickTopShape } from '../interaction/hitTest';
import { createId } from '../utils/id';
import type { CanvasDoc, FreehandShape, Point, RectShape, Tool } from '../types/canvas';
import { upsertShape } from '../state/store';

interface CanvasStageProps {
  doc: CanvasDoc;
  tool: Tool;
  selectedId: string | null;
  isSpacePressed: boolean;
  onSelect: (id: string | null) => void;
  onReplaceDoc: (doc: CanvasDoc) => void;
  onCommitDoc: (doc: CanvasDoc) => void;
  onFinalizeMutation: (beforeDoc: CanvasDoc, afterDoc: CanvasDoc) => void;
}

type PointerMode = 'idle' | 'panning' | 'dragging-shape' | 'drawing-rect' | 'drawing-freehand' | 'pinch';

export function CanvasStage({
  doc,
  tool,
  selectedId,
  isSpacePressed,
  onSelect,
  onReplaceDoc,
  onCommitDoc,
  onFinalizeMutation,
}: CanvasStageProps) {
  const docRef = useRef(doc);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [draftRect, setDraftRect] = useState<RectShape | null>(null);
  const [draftFreehand, setDraftFreehand] = useState<FreehandShape | null>(null);

  const pointerModeRef = useRef<PointerMode>('idle');
  const activePointerIdRef = useRef<number | null>(null);
  const startScreenRef = useRef<Point | null>(null);
  const startWorldRef = useRef<Point | null>(null);
  const beforeMutationRef = useRef<CanvasDoc | null>(null);
  const dragShapeIdRef = useRef<string | null>(null);

  const touchPointsRef = useRef<Map<number, Point>>(new Map());
  const pinchRef = useRef<{
    distance: number;
    center: Point;
    viewport: CanvasDoc['viewport'];
  } | null>(null);

  const cursor = useMemo(() => {
    if (pointerModeRef.current === 'panning' || pointerModeRef.current === 'pinch') {
      return 'grabbing';
    }
    if (tool === 'pan' || isSpacePressed) {
      return 'grab';
    }
    if (tool === 'rect' || tool === 'freehand') {
      return 'crosshair';
    }
    return 'default';
  }, [isSpacePressed, tool, doc]);

  useEffect(() => {
    docRef.current = doc;
  }, [doc]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    renderScene({
      canvas,
      doc,
      selectedId,
      draftRect,
      draftFreehand,
    });
  }, [doc, selectedId, draftRect, draftFreehand]);

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
        doc,
        selectedId,
        draftRect,
        draftFreehand,
      });
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, [doc, selectedId, draftRect, draftFreehand]);

  function getEventPoint(
    event: PointerEvent | ReactPointerEvent<HTMLCanvasElement> | ReactWheelEvent<HTMLCanvasElement>,
  ): Point {
    const rect = canvasRef.current?.getBoundingClientRect();
    return {
      x: event.clientX - (rect?.left ?? 0),
      y: event.clientY - (rect?.top ?? 0),
    };
  }

  function startPan(screenPoint: Point): void {
    pointerModeRef.current = 'panning';
    startScreenRef.current = screenPoint;
  }

  function startDragShape(shapeId: string, worldPoint: Point): void {
    pointerModeRef.current = 'dragging-shape';
    dragShapeIdRef.current = shapeId;
    startWorldRef.current = worldPoint;
    beforeMutationRef.current = docRef.current;
  }

  function startRect(worldPoint: Point): void {
    pointerModeRef.current = 'drawing-rect';
    setDraftRect({
      id: createId(),
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
    pointerModeRef.current = 'drawing-freehand';
    setDraftFreehand({
      id: createId(),
      type: 'freehand',
      points: [worldPoint],
      stroke: '#0f172a',
      width: 2,
    });
  }

  function endInteraction(): void {
    pointerModeRef.current = 'idle';
    activePointerIdRef.current = null;
    dragShapeIdRef.current = null;
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

    pointerModeRef.current = 'pinch';
    pinchRef.current = {
      distance,
      center,
      viewport: docRef.current.viewport,
    };

    setDraftRect(null);
    setDraftFreehand(null);
    beforeMutationRef.current = null;
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLCanvasElement>): void {
    const currentDoc = docRef.current;
    const screenPoint = getEventPoint(event);
    const worldPoint = screenToWorld(screenPoint, currentDoc.viewport);

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

    const tolerance = scaleTolerance(6, currentDoc.viewport.scale);

    if (tool === 'select') {
      const pickedId = pickTopShape(currentDoc.shapes, worldPoint, tolerance);
      onSelect(pickedId);

      if (pickedId) {
        startDragShape(pickedId, worldPoint);
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
    }
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLCanvasElement>): void {
    const currentDoc = docRef.current;
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

      const nextViewport = {
        tx: center.x - startCenterWorld.x * nextScale,
        ty: center.y - startCenterWorld.y * nextScale,
        scale: nextScale,
      };

      onReplaceDoc({
        ...currentDoc,
        viewport: nextViewport,
      });
      return;
    }

    if (activePointerIdRef.current !== event.pointerId) {
      return;
    }

    if (pointerModeRef.current === 'panning' && startScreenRef.current) {
      const dx = screenPoint.x - startScreenRef.current.x;
      const dy = screenPoint.y - startScreenRef.current.y;
      startScreenRef.current = screenPoint;
      onReplaceDoc({
        ...currentDoc,
        viewport: {
          ...currentDoc.viewport,
          tx: currentDoc.viewport.tx + dx,
          ty: currentDoc.viewport.ty + dy,
        },
      });
      return;
    }

    const worldPoint = screenToWorld(screenPoint, currentDoc.viewport);

    if (pointerModeRef.current === 'dragging-shape' && startWorldRef.current && dragShapeIdRef.current) {
      const dx = worldPoint.x - startWorldRef.current.x;
      const dy = worldPoint.y - startWorldRef.current.y;
      startWorldRef.current = worldPoint;

      const shape = currentDoc.shapes.find((item) => item.id === dragShapeIdRef.current);
      if (!shape) {
        return;
      }

      const nextShape =
        shape.type === 'rect'
          ? { ...shape, x: shape.x + dx, y: shape.y + dy }
          : {
              ...shape,
              points: shape.points.map((point) => ({
                x: point.x + dx,
                y: point.y + dy,
              })),
            };

      onReplaceDoc({
        ...currentDoc,
        shapes: upsertShape(currentDoc.shapes, nextShape),
      });
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
        scaleTolerance(1.5, currentDoc.viewport.scale),
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
    const currentDoc = docRef.current;
    if (event.pointerType === 'touch') {
      touchPointsRef.current.delete(event.pointerId);
      if (touchPointsRef.current.size < 2) {
        pinchRef.current = null;
        if (pointerModeRef.current === 'pinch') {
          pointerModeRef.current = 'idle';
        }
      }
    }

    if (pointerModeRef.current === 'dragging-shape' && beforeMutationRef.current) {
      onFinalizeMutation(beforeMutationRef.current, currentDoc);
    }

    if (pointerModeRef.current === 'drawing-rect' && draftRect) {
      if (Math.abs(draftRect.w) > 1 && Math.abs(draftRect.h) > 1) {
        onCommitDoc({
          ...currentDoc,
          shapes: [...currentDoc.shapes, draftRect],
        });
        onSelect(draftRect.id);
      }
      setDraftRect(null);
    }

    if (pointerModeRef.current === 'drawing-freehand' && draftFreehand) {
      if (draftFreehand.points.length > 1) {
        onCommitDoc({
          ...currentDoc,
          shapes: [...currentDoc.shapes, draftFreehand],
        });
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
    const currentDoc = docRef.current;
    const point = getEventPoint(event);
    const zoomFactor = event.deltaY > 0 ? 0.92 : 1.08;
    const viewport = zoomAtScreenPoint(currentDoc.viewport, point, zoomFactor);
    onReplaceDoc({
      ...currentDoc,
      viewport,
    });
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
