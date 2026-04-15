import {
  clampScale,
  hitCanvasNodeResizeHandle,
  maybeAppendPoint,
  pickTopCanvasNode,
  resizeCanvasNode,
  scaleTolerance,
  screenToWorld,
  translateCanvasNode,
  zoomAtScreenPoint,
} from './index';
import {
  createInitialInteractionState,
  type CanvasInteractionState,
  isActiveInteractionMode,
  type DraftState,
  type PointerMode,
} from './controller-state';
import type { BoardDoc, CanvasNode, FreehandNode, Point, RectNode, TextNode } from './model';

const RESIZE_HANDLE_SIZE = 14;
const WHEEL_COMMIT_DELAY_MS = 80;

export interface CanvasProjectLike {
  board: BoardDoc;
  assets: Array<{
    id: string;
    src: string;
    name: string;
    posterSrc?: string | null;
  }>;
}

export type ToolLike = 'select' | 'rect' | 'freehand' | 'text' | 'pan';

export interface CanvasControllerPointerInput {
  screenPoint: Point;
  pointerId: number;
  pointerType: string;
  button?: number;
}

export interface CanvasControllerOptions<TProject extends CanvasProjectLike> {
  project: TProject;
  selectedId: string | null;
  getTool: () => ToolLike;
  isSpacePressed: () => boolean;
  createRectNode: (point: Point) => RectNode;
  createFreehandNode: (point: Point) => FreehandNode;
  createTextNode: (point: Point) => TextNode;
  getNodeById: (nodes: CanvasNode[], id: string | null) => CanvasNode | null;
  upsertNode: (nodes: CanvasNode[], node: CanvasNode) => CanvasNode[];
  onSelect: (id: string | null) => void;
  onReplaceProject: (project: TProject) => void;
  onCommitProject: (project: TProject) => void;
  onFinalizeMutation: (beforeProject: TProject, afterProject: TProject) => void;
  onStateChange?: (state: CanvasInteractionState) => void;
  requestAnimationFrame?: typeof window.requestAnimationFrame;
  cancelAnimationFrame?: typeof window.cancelAnimationFrame;
  setTimeout?: typeof window.setTimeout;
  clearTimeout?: typeof window.clearTimeout;
  render: (project: TProject, state: DraftState, selectedId: string | null) => void;
}

export interface CanvasInteractionController<TProject extends CanvasProjectLike> {
  getState: () => CanvasInteractionState;
  syncProject: (project: TProject) => void;
  syncSelectedId: (selectedId: string | null) => void;
  renderIfIdle: () => void;
  renderCurrent: () => void;
  handleResize: () => void;
  handlePointerDown: (input: CanvasControllerPointerInput) => void;
  handlePointerMove: (input: CanvasControllerPointerInput) => void;
  handlePointerUp: (input: CanvasControllerPointerInput) => void;
  handleWheel: (screenPoint: Point, deltaY: number) => void;
  dispose: () => void;
}

function isResizeHandleHit(node: CanvasNode, point: Point, scale: number): boolean {
  return hitCanvasNodeResizeHandle(node, point, scale, RESIZE_HANDLE_SIZE);
}

export function createCanvasInteractionController<TProject extends CanvasProjectLike>(
  options: CanvasControllerOptions<TProject>,
): CanvasInteractionController<TProject> {
  const requestFrame = options.requestAnimationFrame ?? window.requestAnimationFrame.bind(window);
  const cancelFrame = options.cancelAnimationFrame ?? window.cancelAnimationFrame.bind(window);
  const setTimer = options.setTimeout ?? window.setTimeout.bind(window);
  const clearTimer = options.clearTimeout ?? window.clearTimeout.bind(window);

  let state = createInitialInteractionState();
  let projectRef = options.project;
  let boardRef = options.project.board;
  let selectedIdRef = options.selectedId;
  let animationFrameId: number | null = null;
  let pendingReplaceProject: TProject | null = null;
  let wheelCommitTimeoutId: ReturnType<typeof window.setTimeout> | null = null;
  let activePointerId: number | null = null;
  let startScreen: Point | null = null;
  let startWorld: Point | null = null;
  let beforeMutation: TProject | null = null;
  let activeNodeId: string | null = null;
  const touchPoints = new Map<number, Point>();
  let pinch:
    | {
        distance: number;
        center: Point;
        viewport: BoardDoc['viewport'];
      }
    | null = null;

  function emitState(nextState: CanvasInteractionState): void {
    state = nextState;
    options.onStateChange?.(state);
  }

  function updateState(partial: Partial<CanvasInteractionState>): void {
    emitState({ ...state, ...partial });
  }

  function renderCurrent(): void {
    options.render(projectRef, { draftRect: state.draftRect, draftFreehand: state.draftFreehand }, selectedIdRef);
  }

  function setMode(mode: PointerMode): void {
    updateState({ pointerMode: mode });
  }

  function updateBoard(board: BoardDoc): TProject {
    return {
      ...projectRef,
      board,
    };
  }

  function flushScheduledReplace(): void {
    if (animationFrameId !== null) {
      cancelFrame(animationFrameId);
      animationFrameId = null;
    }

    const projectToCommit = pendingReplaceProject;
    pendingReplaceProject = null;
    if (projectToCommit) {
      options.onReplaceProject(projectToCommit);
    }
  }

  function scheduleReplaceProject(nextProject: TProject): void {
    projectRef = nextProject;
    boardRef = nextProject.board;
    pendingReplaceProject = nextProject;
    renderCurrent();

    if (animationFrameId !== null) {
      return;
    }

    animationFrameId = requestFrame(() => {
      animationFrameId = null;
      const projectToCommit = pendingReplaceProject;
      pendingReplaceProject = null;
      if (projectToCommit) {
        options.onReplaceProject(projectToCommit);
      }
    });
  }

  function flushWheelCommit(): void {
    if (wheelCommitTimeoutId !== null) {
      clearTimer(wheelCommitTimeoutId);
      wheelCommitTimeoutId = null;
    }

    const projectToCommit = pendingReplaceProject;
    pendingReplaceProject = null;
    if (projectToCommit) {
      options.onReplaceProject(projectToCommit);
    }
    updateState({ isWheelInteractionActive: false });
  }

  function scheduleWheelProject(nextProject: TProject): void {
    projectRef = nextProject;
    boardRef = nextProject.board;
    updateState({ isWheelInteractionActive: true });
    renderCurrent();
    options.onReplaceProject(nextProject);

    if (wheelCommitTimeoutId !== null) {
      clearTimer(wheelCommitTimeoutId);
    }

    wheelCommitTimeoutId = setTimer(() => {
      wheelCommitTimeoutId = null;
      updateState({ isWheelInteractionActive: false });
    }, WHEEL_COMMIT_DELAY_MS);
  }

  function endInteraction(): void {
    activePointerId = null;
    activeNodeId = null;
    startScreen = null;
    startWorld = null;
    beforeMutation = null;
    setMode('idle');
  }

  function beginPinchIfNeeded(): void {
    if (touchPoints.size < 2) {
      return;
    }

    const points = [...touchPoints.values()];
    pinch = {
      distance: Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y),
      center: {
        x: (points[0].x + points[1].x) / 2,
        y: (points[0].y + points[1].y) / 2,
      },
      viewport: boardRef.viewport,
    };

    beforeMutation = null;
    updateState({
      pointerMode: 'pinch',
      draftRect: null,
      draftFreehand: null,
    });
  }

  function startPan(screenPoint: Point): void {
    startScreen = screenPoint;
    setMode('panning');
  }

  function startNodeInteraction(mode: PointerMode, nodeId: string, worldPoint: Point): void {
    activeNodeId = nodeId;
    startWorld = worldPoint;
    beforeMutation = projectRef;
    setMode(mode);
  }

  return {
    getState() {
      return state;
    },
    syncProject(project) {
      if (isActiveInteractionMode(state.pointerMode) || state.isWheelInteractionActive || pendingReplaceProject) {
        return;
      }
      projectRef = project;
      boardRef = project.board;
    },
    syncSelectedId(selectedId) {
      selectedIdRef = selectedId;
    },
    renderIfIdle() {
      if (isActiveInteractionMode(state.pointerMode) || state.isWheelInteractionActive) {
        return;
      }
      renderCurrent();
    },
    renderCurrent,
    handleResize() {
      renderCurrent();
    },
    handlePointerDown(input) {
      const currentProject = projectRef;
      const currentBoard = currentProject.board;
      const worldPoint = screenToWorld(input.screenPoint, currentBoard.viewport);

      if (input.pointerType === 'touch') {
        touchPoints.set(input.pointerId, input.screenPoint);
        if (touchPoints.size >= 2) {
          beginPinchIfNeeded();
        }
      }

      if (state.pointerMode === 'pinch') {
        return;
      }

      activePointerId = input.pointerId;

      const shouldPan = options.getTool() === 'pan' || options.isSpacePressed() || input.button === 1;
      if (shouldPan) {
        startPan(input.screenPoint);
        return;
      }

      const tolerance = scaleTolerance(6, currentBoard.viewport.scale);

      if (options.getTool() === 'select') {
        const selectedNode = options.getNodeById(currentBoard.nodes, selectedIdRef);
        if (selectedNode && isResizeHandleHit(selectedNode, worldPoint, currentBoard.viewport.scale)) {
          startNodeInteraction('resizing-node', selectedNode.id, worldPoint);
          return;
        }

        const pickedId = pickTopCanvasNode(currentBoard.nodes, worldPoint, tolerance);
        options.onSelect(pickedId);

        if (pickedId) {
          startNodeInteraction('dragging-node', pickedId, worldPoint);
        }
        return;
      }

      if (options.getTool() === 'rect') {
        options.onSelect(null);
        updateState({
          pointerMode: 'drawing-rect',
          draftRect: options.createRectNode(worldPoint),
        });
        return;
      }

      if (options.getTool() === 'freehand') {
        options.onSelect(null);
        updateState({
          pointerMode: 'drawing-freehand',
          draftFreehand: options.createFreehandNode(worldPoint),
        });
        return;
      }

      if (options.getTool() === 'text') {
        const node = options.createTextNode(worldPoint);
        const nextProject = updateBoard({
          ...currentBoard,
          nodes: [...currentBoard.nodes, node],
        });
        options.onCommitProject(nextProject);
        options.onSelect(node.id);
      }
    },
    handlePointerMove(input) {
      const currentProject = projectRef;
      const currentBoard = currentProject.board;

      if (input.pointerType === 'touch') {
        touchPoints.set(input.pointerId, input.screenPoint);
      }

      if (state.pointerMode === 'pinch') {
        if (touchPoints.size < 2 || !pinch) {
          return;
        }

        const points = [...touchPoints.values()];
        const center = {
          x: (points[0].x + points[1].x) / 2,
          y: (points[0].y + points[1].y) / 2,
        };
        const distance = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
        if (distance <= 0) {
          return;
        }

        const ratio = distance / pinch.distance;
        const nextScale = clampScale(pinch.viewport.scale * ratio);
        const startCenterWorld = screenToWorld(pinch.center, pinch.viewport);

        scheduleReplaceProject(
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

      if (activePointerId !== input.pointerId) {
        return;
      }

      if (state.pointerMode === 'panning' && startScreen) {
        const dx = input.screenPoint.x - startScreen.x;
        const dy = input.screenPoint.y - startScreen.y;
        startScreen = input.screenPoint;
        scheduleReplaceProject(
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

      const worldPoint = screenToWorld(input.screenPoint, currentBoard.viewport);

      if (state.pointerMode === 'dragging-node' && startWorld && activeNodeId) {
        const dx = worldPoint.x - startWorld.x;
        const dy = worldPoint.y - startWorld.y;
        startWorld = worldPoint;

        const node = options.getNodeById(currentBoard.nodes, activeNodeId);
        if (!node) {
          return;
        }

        scheduleReplaceProject(
          updateBoard({
            ...currentBoard,
            nodes: options.upsertNode(currentBoard.nodes, translateCanvasNode(node, { x: dx, y: dy })),
          }),
        );
        return;
      }

      if (state.pointerMode === 'resizing-node' && activeNodeId) {
        const node = options.getNodeById(currentBoard.nodes, activeNodeId);
        if (!node) {
          return;
        }

        scheduleReplaceProject(
          updateBoard({
            ...currentBoard,
            nodes: options.upsertNode(currentBoard.nodes, resizeCanvasNode(node, worldPoint)),
          }),
        );
        return;
      }

      if (state.pointerMode === 'drawing-rect' && state.draftRect) {
        updateState({
          draftRect: {
            ...state.draftRect,
            w: worldPoint.x - state.draftRect.x,
            h: worldPoint.y - state.draftRect.y,
          },
        });
        renderCurrent();
        return;
      }

      if (state.pointerMode === 'drawing-freehand' && state.draftFreehand) {
        const points = maybeAppendPoint(
          state.draftFreehand.points,
          worldPoint,
          scaleTolerance(1.5, currentBoard.viewport.scale),
        );
        if (points !== state.draftFreehand.points) {
          updateState({
            draftFreehand: {
              ...state.draftFreehand,
              points,
            },
          });
          renderCurrent();
        }
      }
    },
    handlePointerUp(input) {
      const currentProject = projectRef;
      const currentBoard = currentProject.board;

      if (input.pointerType === 'touch') {
        touchPoints.delete(input.pointerId);
        if (touchPoints.size < 2) {
          pinch = null;
          if (state.pointerMode === 'pinch') {
            setMode('idle');
          }
        }
      }

      if ((state.pointerMode === 'dragging-node' || state.pointerMode === 'resizing-node') && beforeMutation) {
        flushScheduledReplace();
        options.onFinalizeMutation(beforeMutation, currentProject);
      }

      if (state.pointerMode === 'panning' || state.pointerMode === 'pinch') {
        flushScheduledReplace();
      }

      if (state.pointerMode === 'drawing-rect' && state.draftRect) {
        if (Math.abs(state.draftRect.w) > 1 && Math.abs(state.draftRect.h) > 1) {
          const nextProject = updateBoard({
            ...currentBoard,
            nodes: [...currentBoard.nodes, state.draftRect],
          });
          options.onCommitProject(nextProject);
          options.onSelect(state.draftRect.id);
        }
        updateState({ draftRect: null });
      }

      if (state.pointerMode === 'drawing-freehand' && state.draftFreehand) {
        if (state.draftFreehand.points.length > 1) {
          const nextProject = updateBoard({
            ...currentBoard,
            nodes: [...currentBoard.nodes, state.draftFreehand],
          });
          options.onCommitProject(nextProject);
          options.onSelect(state.draftFreehand.id);
        }
        updateState({ draftFreehand: null });
      }

      if (activePointerId === input.pointerId || input.pointerType === 'touch') {
        endInteraction();
      }
    },
    handleWheel(screenPoint, deltaY) {
      const currentBoard = boardRef;
      const zoomFactor = deltaY > 0 ? 0.92 : 1.08;
      const viewport = zoomAtScreenPoint(currentBoard.viewport, screenPoint, zoomFactor);
      scheduleWheelProject(updateBoard({ ...currentBoard, viewport }));
    },
    dispose() {
    if (animationFrameId !== null) {
      cancelFrame(animationFrameId);
    }
    if (wheelCommitTimeoutId !== null) {
      flushWheelCommit();
    }
  },
  };
}
