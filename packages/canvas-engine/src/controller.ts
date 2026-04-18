import {
  clampScale,
  findAnchorTarget,
  getAllDescendantNodes,
  getConnectorPathMode,
  getConnectorWaypointHandles,
  getDefaultConnectorWaypoints,
  getNodesInContext,
  hitCanvasNodeResizeHandle,
  isConnectorNode,
  maybeAppendPoint,
  pickTopCanvasNode,
  resizeCanvasNode,
  resolveConnectorEndpoint,
  resolveConnectorPoints,
  scaleTolerance,
  screenToWorld,
  translateCanvasNode,
  worldPointToContainerLocal,
  worldPointToNodeLocal,
  zoomAtScreenPoint,
} from './index';
import {
  createInitialInteractionState,
  type CanvasInteractionState,
  type ConnectorHandle,
  isActiveInteractionMode,
  type PointerMode,
} from './controller-state';
import type {
  AnchorId,
  BoardDoc,
  CanvasNode,
  ConnectorNode,
  ConnectorPathMode,
  FreehandNode,
  Point,
  RectNode,
  TextNode,
} from './model';
import { computeDragSnap } from './snap';

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

export type ToolLike = 'select' | 'rect' | 'freehand' | 'text' | 'connector' | 'pan';

export interface AnchorTargetLike {
  nodeId: string;
  anchor: AnchorId;
  point: Point;
}

export interface CanvasControllerPointerInput {
  screenPoint: Point;
  pointerId: number;
  pointerType: string;
  button?: number;
}

export interface CanvasControllerOptions<TProject extends CanvasProjectLike> {
  project: TProject;
  selectedId: string | null;
  getActiveContainerId: () => string | null;
  getTool: () => ToolLike;
  isSpacePressed: () => boolean;
  getConnectorPathMode: () => ConnectorPathMode;
  createRectNode: (point: Point) => RectNode;
  createFreehandNode: (point: Point) => FreehandNode;
  createTextNode: (point: Point) => TextNode;
  createConnectorNode: (anchor: AnchorTargetLike, point: Point, pathMode: ConnectorPathMode) => ConnectorNode;
  getNodeById: (nodes: CanvasNode[], id: string | null) => CanvasNode | null;
  upsertNode: (nodes: CanvasNode[], node: CanvasNode) => CanvasNode[];
  insertNodeIntoContainer: (nodes: CanvasNode[], containerId: string, node: CanvasNode) => CanvasNode[];
  onSelect: (id: string | null) => void;
  onReplaceProject: (project: TProject) => void;
  onCommitProject: (project: TProject) => void;
  onFinalizeMutation: (beforeProject: TProject, afterProject: TProject) => void;
  onStateChange?: (state: CanvasInteractionState) => void;
  requestAnimationFrame?: typeof window.requestAnimationFrame;
  cancelAnimationFrame?: typeof window.cancelAnimationFrame;
  setTimeout?: typeof window.setTimeout;
  clearTimeout?: typeof window.clearTimeout;
  render: (project: TProject, state: CanvasInteractionState, selectedId: string | null) => void;
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

function isResizeHandleHit(node: CanvasNode, point: Point, scale: number, board: BoardDoc): boolean {
  return hitCanvasNodeResizeHandle(node, point, scale, RESIZE_HANDLE_SIZE, board);
}

function hitConnectorHandle(
  node: ConnectorNode,
  point: Point,
  scale: number,
  board: BoardDoc,
): ConnectorHandle | null {
  const points = resolveConnectorPoints(node, board);
  if (!points) {
    return null;
  }

  const tolerance = scaleTolerance(10, scale);
  if (Math.hypot(points.start.x - point.x, points.start.y - point.y) <= tolerance) {
    return { kind: 'endpoint', endpoint: 'start' };
  }
  if (Math.hypot(points.end.x - point.x, points.end.y - point.y) <= tolerance) {
    return { kind: 'endpoint', endpoint: 'end' };
  }

  const waypoints = getConnectorWaypointHandles(node);
  for (let index = 0; index < waypoints.length; index += 1) {
    const waypoint = waypoints[index];
    if (Math.hypot(waypoint.x - point.x, waypoint.y - point.y) <= tolerance) {
      return { kind: 'waypoint', index };
    }
  }
  return null;
}

function findConnectorHandleTarget(
  board: BoardDoc,
  point: Point,
): { node: ConnectorNode; handle: ConnectorHandle } | null {
  const connectors = getAllDescendantNodes(board.nodes).filter(isConnectorNode);
  for (let index = connectors.length - 1; index >= 0; index -= 1) {
    const node = connectors[index];
    const handle = hitConnectorHandle(node, point, board.viewport.scale, board);
    if (handle) {
      return { node, handle };
    }
  }
  return null;
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
  let activeConnectorHandle: ConnectorHandle | null = null;
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
    options.render(projectRef, state, selectedIdRef);
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

  function selectNode(id: string | null): void {
    selectedIdRef = id;
    options.onSelect(id);
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
    activeConnectorHandle = null;
    startScreen = null;
    startWorld = null;
    beforeMutation = null;
    updateState({
      pointerMode: 'idle',
      snapGuides: [],
      draftConnector: null,
      hoveredNodeId: null,
      hoveredAnchor: null,
      activeConnectorHandle: null,
    });
  }

  function updateHoveredNode(nodeId: string | null): void {
    if (state.hoveredNodeId === nodeId) {
      return;
    }
    updateState({ hoveredNodeId: nodeId });
    renderCurrent();
  }

  function updateHoveredAnchor(nodeId: string | null, anchor: AnchorId | null): void {
    const nextHoveredAnchor = nodeId && anchor ? { nodeId, anchor } : null;
    if (
      state.hoveredAnchor?.nodeId === nextHoveredAnchor?.nodeId &&
      state.hoveredAnchor?.anchor === nextHoveredAnchor?.anchor
    ) {
      return;
    }
    updateState({ hoveredAnchor: nextHoveredAnchor });
    renderCurrent();
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
      draftConnector: null,
      hoveredNodeId: null,
      hoveredAnchor: null,
      activeConnectorHandle: null,
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

  function withConnectorPreviewPath(node: ConnectorNode, board: BoardDoc): ConnectorNode {
    if (getConnectorPathMode(node) !== 'polyline') {
      return {
        ...node,
        pathMode: 'straight',
        waypoints: [],
      };
    }

    const start = resolveConnectorEndpoint(node.start, board);
    const end = resolveConnectorEndpoint(node.end, board);
    if (!start || !end) {
      return {
        ...node,
        pathMode: 'polyline',
      };
    }

    const endAnchor = node.end.kind === 'attached' ? node.end.anchor : undefined;

    return {
      ...node,
      pathMode: 'polyline',
      waypoints: getDefaultConnectorWaypoints(
        start,
        end,
        node.start.kind === 'attached' ? node.start.anchor : undefined,
        endAnchor,
      ),
    };
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
      const contextNodes = getNodesInContext(currentBoard, options.getActiveContainerId());

      if (options.getTool() === 'select') {
        const selectedNode = options.getNodeById(currentBoard.nodes, selectedIdRef);
        if (selectedNode && isConnectorNode(selectedNode)) {
          const connectorHandle = hitConnectorHandle(selectedNode, worldPoint, currentBoard.viewport.scale, currentBoard);
          if (connectorHandle) {
            activeNodeId = selectedNode.id;
            activeConnectorHandle = connectorHandle;
            beforeMutation = currentProject;
            updateState({
              pointerMode:
                connectorHandle.kind === 'endpoint' ? 'editing-connector-end' : 'editing-connector-waypoint',
              draftConnector: selectedNode,
              hoveredNodeId: null,
              hoveredAnchor: null,
              activeConnectorHandle: connectorHandle,
            });
            return;
          }
        }

        if (selectedNode && !isConnectorNode(selectedNode) && isResizeHandleHit(selectedNode, worldPoint, currentBoard.viewport.scale, currentBoard)) {
          startNodeInteraction('resizing-node', selectedNode.id, worldPoint);
          return;
        }

        const pickedId = pickTopCanvasNode(contextNodes, worldPoint, tolerance, currentBoard);
        const pickedNode = options.getNodeById(currentBoard.nodes, pickedId);

        const globalConnectorHandle = findConnectorHandleTarget(currentBoard, worldPoint);
        if (globalConnectorHandle) {
          activeNodeId = globalConnectorHandle.node.id;
          activeConnectorHandle = globalConnectorHandle.handle;
          beforeMutation = currentProject;
          selectNode(globalConnectorHandle.node.id);
          updateState({
            pointerMode:
              globalConnectorHandle.handle.kind === 'endpoint' ? 'editing-connector-end' : 'editing-connector-waypoint',
            draftConnector: globalConnectorHandle.node,
            hoveredNodeId: null,
            hoveredAnchor: null,
            activeConnectorHandle: globalConnectorHandle.handle,
          });
          return;
        }

        if (pickedNode && isConnectorNode(pickedNode)) {
          const connectorHandle = hitConnectorHandle(pickedNode, worldPoint, currentBoard.viewport.scale, currentBoard);
          if (connectorHandle) {
            activeNodeId = pickedNode.id;
            activeConnectorHandle = connectorHandle;
            beforeMutation = currentProject;
            selectNode(pickedNode.id);
            updateState({
              pointerMode:
                connectorHandle.kind === 'endpoint' ? 'editing-connector-end' : 'editing-connector-waypoint',
              draftConnector: pickedNode,
              hoveredNodeId: null,
              hoveredAnchor: null,
              activeConnectorHandle: connectorHandle,
            });
            return;
          }
        }

        selectNode(pickedId);

        if (pickedId && pickedNode && !isConnectorNode(pickedNode)) {
          startNodeInteraction('dragging-node', pickedId, worldPoint);
        }
        return;
      }

      if (options.getTool() === 'rect') {
        selectNode(null);
        const localPoint = worldPointToContainerLocal(currentBoard, options.getActiveContainerId(), worldPoint);
        updateState({
          pointerMode: 'drawing-rect',
          draftRect: options.createRectNode(localPoint),
          hoveredNodeId: null,
          hoveredAnchor: null,
        });
        return;
      }

      if (options.getTool() === 'freehand') {
        selectNode(null);
        const localPoint = worldPointToContainerLocal(currentBoard, options.getActiveContainerId(), worldPoint);
        updateState({
          pointerMode: 'drawing-freehand',
          draftFreehand: options.createFreehandNode(localPoint),
          hoveredNodeId: null,
          hoveredAnchor: null,
        });
        return;
      }

      if (options.getTool() === 'text') {
        const localPoint = worldPointToContainerLocal(currentBoard, options.getActiveContainerId(), worldPoint);
        const node = options.createTextNode(localPoint);
        const activeContainerId = options.getActiveContainerId();
        const nextProject = updateBoard({
          ...currentBoard,
          nodes: activeContainerId
            ? options.insertNodeIntoContainer(currentBoard.nodes, activeContainerId, node)
            : [...currentBoard.nodes, node],
        });
        options.onCommitProject(nextProject);
        selectNode(node.id);
        return;
      }

      if (options.getTool() === 'connector') {
        selectNode(null);
        const anchor = findAnchorTarget(currentBoard.nodes, worldPoint, scaleTolerance(12, currentBoard.viewport.scale));
        updateState({
          hoveredNodeId: null,
          hoveredAnchor: anchor ? { nodeId: anchor.nodeId, anchor: anchor.anchor } : null,
        });
        if (!anchor) {
          return;
        }

        updateState({
          pointerMode: 'drawing-connector',
          draftConnector: options.createConnectorNode(anchor, anchor.point, options.getConnectorPathMode()),
          hoveredNodeId: null,
          hoveredAnchor: { nodeId: anchor.nodeId, anchor: anchor.anchor },
          activeConnectorHandle: { kind: 'endpoint', endpoint: 'end' },
        });
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

      const worldPoint = screenToWorld(input.screenPoint, currentBoard.viewport);

      if (
        input.pointerType !== 'touch' &&
        state.pointerMode === 'idle' &&
        !state.isWheelInteractionActive &&
        !options.isSpacePressed()
      ) {
        if (options.getTool() === 'select') {
          const contextNodes = getNodesInContext(currentBoard, options.getActiveContainerId());
          const hoveredId = pickTopCanvasNode(
            contextNodes,
            worldPoint,
            scaleTolerance(6, currentBoard.viewport.scale),
            currentBoard,
          );
          if (state.hoveredAnchor) {
            updateState({ hoveredAnchor: null });
          }
          updateHoveredNode(hoveredId);
        } else {
          if (state.hoveredNodeId) {
            updateHoveredNode(null);
          }

          if (options.getTool() === 'connector') {
            const hoveredAnchor = findAnchorTarget(
              currentBoard.nodes,
              worldPoint,
              scaleTolerance(12, currentBoard.viewport.scale),
            );
            updateHoveredAnchor(hoveredAnchor?.nodeId ?? null, hoveredAnchor?.anchor ?? null);
          } else if (state.hoveredAnchor) {
            updateHoveredAnchor(null, null);
          }
        }
      }

      if (activePointerId !== input.pointerId) {
        return;
      }

      if (state.hoveredNodeId) {
        updateState({ hoveredNodeId: null });
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

      if (state.pointerMode === 'drawing-connector' && state.draftConnector) {
        const startNodeId = state.draftConnector.start.kind === 'attached' ? state.draftConnector.start.nodeId : undefined;
        const anchor = findAnchorTarget(currentBoard.nodes, worldPoint, scaleTolerance(12, currentBoard.viewport.scale), {
          excludeNodeId: startNodeId,
        });
        const draftConnector = withConnectorPreviewPath(
          {
            ...state.draftConnector,
            end: anchor
              ? {
                  kind: 'attached',
                  nodeId: anchor.nodeId,
                  anchor: anchor.anchor,
                }
              : {
                  kind: 'free',
                  x: worldPoint.x,
                  y: worldPoint.y,
                },
          },
          currentBoard,
        );
        updateState({
          draftConnector,
          hoveredAnchor: anchor ? { nodeId: anchor.nodeId, anchor: anchor.anchor } : null,
        });
        renderCurrent();
        return;
      }

      if (
        state.pointerMode === 'editing-connector-end' &&
        state.draftConnector &&
        activeConnectorHandle?.kind === 'endpoint'
      ) {
        const stationaryEndpoint =
          activeConnectorHandle.endpoint === 'start' ? state.draftConnector.end : state.draftConnector.start;
        const anchor = findAnchorTarget(currentBoard.nodes, worldPoint, scaleTolerance(12, currentBoard.viewport.scale), {
          excludeNodeId: stationaryEndpoint.kind === 'attached' ? stationaryEndpoint.nodeId : undefined,
          excludeConnectorId: state.draftConnector.id,
        });
        const nextEndpoint = anchor
          ? ({
              kind: 'attached',
              nodeId: anchor.nodeId,
              anchor: anchor.anchor,
            } as const)
          : ({
              kind: 'free',
              x: worldPoint.x,
              y: worldPoint.y,
            } as const);

        let draftConnector =
          activeConnectorHandle.endpoint === 'start'
            ? { ...state.draftConnector, start: nextEndpoint }
            : { ...state.draftConnector, end: nextEndpoint };
        if (getConnectorPathMode(draftConnector) === 'polyline' && getConnectorWaypointHandles(draftConnector).length === 0) {
          draftConnector = withConnectorPreviewPath(draftConnector, currentBoard);
        }

        updateState({
          draftConnector,
          hoveredAnchor: anchor ? { nodeId: anchor.nodeId, anchor: anchor.anchor } : null,
        });
        renderCurrent();
        return;
      }

      if (
        state.pointerMode === 'editing-connector-waypoint' &&
        state.draftConnector &&
        activeConnectorHandle?.kind === 'waypoint'
      ) {
        const waypoints = getConnectorWaypointHandles(state.draftConnector);
        if (!waypoints[activeConnectorHandle.index]) {
          return;
        }

        const nextWaypoints = waypoints.slice();
        nextWaypoints[activeConnectorHandle.index] = worldPoint;
        updateState({
          draftConnector: {
            ...state.draftConnector,
            pathMode: 'polyline',
            waypoints: nextWaypoints,
          },
          hoveredAnchor: null,
        });
        renderCurrent();
        return;
      }

      if (state.pointerMode === 'dragging-node' && startWorld && activeNodeId) {
        const dx = worldPoint.x - startWorld.x;
        const dy = worldPoint.y - startWorld.y;
        const node = beforeMutation ? options.getNodeById(beforeMutation.board.nodes, activeNodeId) : null;
        if (!node) {
          return;
        }
        const activeContainerId = options.getActiveContainerId();
        const snapNodes = getNodesInContext(currentBoard, activeContainerId);

        const snapResult = computeDragSnap({
          node,
          delta: { x: dx, y: dy },
          nodes: snapNodes,
          viewport: currentBoard.viewport,
        });

        updateState({ snapGuides: snapResult.guides });

        scheduleReplaceProject(
          updateBoard({
            ...currentBoard,
            nodes: options.upsertNode(currentBoard.nodes, translateCanvasNode(node, snapResult.delta)),
          }),
        );
        return;
      }

      if (state.pointerMode === 'resizing-node' && activeNodeId) {
        const node = options.getNodeById(currentBoard.nodes, activeNodeId);
        if (!node) {
          return;
        }
        const localPointer = worldPointToNodeLocal(currentBoard, activeNodeId, worldPoint);

        scheduleReplaceProject(
          updateBoard({
            ...currentBoard,
            nodes: options.upsertNode(currentBoard.nodes, resizeCanvasNode(node, localPointer)),
          }),
        );
        return;
      }

      if (state.pointerMode === 'drawing-rect' && state.draftRect) {
        const localPoint = worldPointToContainerLocal(currentBoard, options.getActiveContainerId(), worldPoint);
        updateState({
          draftRect: {
            ...state.draftRect,
            w: localPoint.x - state.draftRect.x,
            h: localPoint.y - state.draftRect.y,
          },
        });
        renderCurrent();
        return;
      }

      if (state.pointerMode === 'drawing-freehand' && state.draftFreehand) {
        const localPoint = worldPointToContainerLocal(currentBoard, options.getActiveContainerId(), worldPoint);
        const points = maybeAppendPoint(
          state.draftFreehand.points,
          localPoint,
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

      if (state.pointerMode === 'drawing-connector' && state.draftConnector) {
        if (state.draftConnector.start.kind === 'attached' && state.draftConnector.end.kind === 'attached') {
          const nextProject = updateBoard({
            ...currentBoard,
            nodes: [...currentBoard.nodes, state.draftConnector],
          });
          options.onCommitProject(nextProject);
          selectNode(state.draftConnector.id);
        }
      }

      if (
        state.pointerMode === 'editing-connector-end' &&
        state.draftConnector &&
        activeNodeId &&
        beforeMutation &&
        activeConnectorHandle?.kind === 'endpoint'
      ) {
        const endpoint =
          activeConnectorHandle.endpoint === 'start' ? state.draftConnector.start : state.draftConnector.end;
        if (endpoint?.kind === 'attached') {
          const nextProject = updateBoard({
            ...currentBoard,
            nodes: options.upsertNode(currentBoard.nodes, state.draftConnector),
          });
          options.onCommitProject(nextProject);
          selectNode(state.draftConnector.id);
        } else {
          options.onReplaceProject(beforeMutation);
          selectNode(activeNodeId);
        }
      }

      if (state.pointerMode === 'editing-connector-waypoint' && state.draftConnector && activeNodeId) {
        const nextProject = updateBoard({
          ...currentBoard,
          nodes: options.upsertNode(currentBoard.nodes, state.draftConnector),
        });
        options.onCommitProject(nextProject);
        selectNode(activeNodeId);
      }

      if (state.pointerMode === 'drawing-rect' && state.draftRect) {
        if (Math.abs(state.draftRect.w) > 1 && Math.abs(state.draftRect.h) > 1) {
          const activeContainerId = options.getActiveContainerId();
          const nextProject = updateBoard({
            ...currentBoard,
            nodes: activeContainerId
              ? options.insertNodeIntoContainer(currentBoard.nodes, activeContainerId, state.draftRect)
              : [...currentBoard.nodes, state.draftRect],
          });
          options.onCommitProject(nextProject);
          selectNode(state.draftRect.id);
        }
        updateState({ draftRect: null });
      }

      if (state.pointerMode === 'drawing-freehand' && state.draftFreehand) {
        if (state.draftFreehand.points.length > 1) {
          const activeContainerId = options.getActiveContainerId();
          const nextProject = updateBoard({
            ...currentBoard,
            nodes: activeContainerId
              ? options.insertNodeIntoContainer(currentBoard.nodes, activeContainerId, state.draftFreehand)
              : [...currentBoard.nodes, state.draftFreehand],
          });
          options.onCommitProject(nextProject);
          selectNode(state.draftFreehand.id);
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
