import {
  createCanvasInteractionController,
  createInitialInteractionState,
  getCanvasCursor,
  isInteractionActive,
  renderScene,
  type DraftState,
  type CanvasInteractionController,
} from '@infinite-canvas/canvas-engine';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { VideoOverlayLayer } from './VideoOverlayLayer';
import { createId } from '../utils/id';
import type { CanvasProject, Point, Tool } from '../types/canvas';
import { getNodeById, upsertNode } from '../state/store';

interface CanvasStageProps {
  project: CanvasProject;
  tool: Tool;
  selectedId: string | null;
  isSpacePressed: boolean;
  onInteractionActiveChange: (active: boolean) => void;
  onSelect: (id: string | null) => void;
  onReplaceProject: (project: CanvasProject) => void;
  onCommitProject: (project: CanvasProject) => void;
  onFinalizeMutation: (beforeProject: CanvasProject, afterProject: CanvasProject) => void;
}

export function CanvasStage({
  project,
  tool,
  selectedId,
  isSpacePressed,
  onInteractionActiveChange,
  onSelect,
  onReplaceProject,
  onCommitProject,
  onFinalizeMutation,
}: CanvasStageProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const controllerRef = useRef<CanvasInteractionController<CanvasProject> | null>(null);
  const initialProjectRef = useRef(project);
  const initialSelectedIdRef = useRef(selectedId);
  const toolRef = useRef(tool);
  const isSpacePressedRef = useRef(isSpacePressed);
  const onSelectRef = useRef(onSelect);
  const onReplaceProjectRef = useRef(onReplaceProject);
  const onCommitProjectRef = useRef(onCommitProject);
  const onFinalizeMutationRef = useRef(onFinalizeMutation);
  const [interactionState, setInteractionState] = useState(createInitialInteractionState());

  const renderProjectNow = useCallback(
    (nextProject: CanvasProject, selectedNodeId: string | null, state: DraftState): void => {
      const canvas = canvasRef.current;
      if (!canvas) {
        return;
      }

      renderScene({
        canvas,
        board: nextProject.board,
        assets: nextProject.assets,
        selectedId: selectedNodeId,
        draftRect: state.draftRect,
        draftFreehand: state.draftFreehand,
      });
    },
    [],
  );

  useEffect(() => {
    toolRef.current = tool;
  }, [tool]);

  useEffect(() => {
    isSpacePressedRef.current = isSpacePressed;
  }, [isSpacePressed]);

  useEffect(() => {
    onSelectRef.current = onSelect;
    onReplaceProjectRef.current = onReplaceProject;
    onCommitProjectRef.current = onCommitProject;
    onFinalizeMutationRef.current = onFinalizeMutation;
  }, [onCommitProject, onFinalizeMutation, onReplaceProject, onSelect]);

  useEffect(() => {
    const controller = createCanvasInteractionController({
      project: initialProjectRef.current,
      selectedId: initialSelectedIdRef.current,
      getTool: () => toolRef.current,
      isSpacePressed: () => isSpacePressedRef.current,
      createRectNode: (point) => ({
        id: createId('node'),
        type: 'rect',
        x: point.x,
        y: point.y,
        w: 0,
        h: 0,
        stroke: '#0f172a',
        fill: 'rgba(59, 130, 246, 0.2)',
      }),
      createFreehandNode: (point) => ({
        id: createId('node'),
        type: 'freehand',
        points: [point],
        stroke: '#0f172a',
        width: 2,
      }),
      createTextNode: (point) => ({
        id: createId('node'),
        type: 'text',
        x: point.x,
        y: point.y,
        w: 220,
        h: 72,
        text: '新建文本',
        color: '#0f172a',
        fontSize: 20,
        fontFamily: 'Space Grotesk, Avenir Next, Segoe UI, sans-serif',
      }),
      getNodeById,
      upsertNode,
      onSelect: (id) => onSelectRef.current(id),
      onReplaceProject: (nextProject) => onReplaceProjectRef.current(nextProject),
      onCommitProject: (nextProject) => onCommitProjectRef.current(nextProject),
      onFinalizeMutation: (beforeProject, afterProject) => onFinalizeMutationRef.current(beforeProject, afterProject),
      onStateChange: setInteractionState,
      render: (nextProject, state, nextSelectedId) => {
        renderProjectNow(nextProject, nextSelectedId, state);
      },
    });

    controllerRef.current = controller;
    controller.renderCurrent();

    return () => {
      controller.dispose();
      controllerRef.current = null;
    };
  }, [renderProjectNow]);

  useEffect(() => {
    controllerRef.current?.syncProject(project);
    controllerRef.current?.syncSelectedId(selectedId);
    controllerRef.current?.renderIfIdle();
  }, [project, selectedId]);

  useEffect(() => {
    onInteractionActiveChange(isInteractionActive(interactionState));
  }, [interactionState, onInteractionActiveChange]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const observer = new ResizeObserver(() => {
      controllerRef.current?.handleResize();
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const cursor = useMemo(() => getCanvasCursor(interactionState, tool, isSpacePressed), [interactionState, isSpacePressed, tool]);

  const getEventPoint = useCallback(
    (event: Pick<PointerEvent, 'clientX' | 'clientY'> | Pick<WheelEvent, 'clientX' | 'clientY'>): Point => {
      const rect = canvasRef.current?.getBoundingClientRect();
      return {
        x: event.clientX - (rect?.left ?? 0),
        y: event.clientY - (rect?.top ?? 0),
      };
    },
    [],
  );

  const handlePointerDown = useCallback((event: ReactPointerEvent<HTMLCanvasElement>): void => {
    event.currentTarget.setPointerCapture(event.pointerId);
    controllerRef.current?.handlePointerDown({
      screenPoint: getEventPoint(event),
      pointerId: event.pointerId,
      pointerType: event.pointerType,
      button: event.button,
    });
  }, [getEventPoint]);

  const handlePointerMove = useCallback((event: ReactPointerEvent<HTMLCanvasElement>): void => {
    controllerRef.current?.handlePointerMove({
      screenPoint: getEventPoint(event),
      pointerId: event.pointerId,
      pointerType: event.pointerType,
      button: event.button,
    });
  }, [getEventPoint]);

  const handlePointerUp = useCallback((event: ReactPointerEvent<HTMLCanvasElement>): void => {
    controllerRef.current?.handlePointerUp({
      screenPoint: getEventPoint(event),
      pointerId: event.pointerId,
      pointerType: event.pointerType,
      button: event.button,
    });
  }, [getEventPoint]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    function handleWheel(event: WheelEvent): void {
      event.preventDefault();
      controllerRef.current?.handleWheel(getEventPoint(event), event.deltaY);
    }

    canvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      canvas.removeEventListener('wheel', handleWheel);
    };
  }, [getEventPoint]);

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
      />
      <VideoOverlayLayer board={project.board} assets={project.assets} selectedId={selectedId} />
    </div>
  );
}
