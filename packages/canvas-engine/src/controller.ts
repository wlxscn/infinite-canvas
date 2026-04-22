import {
  getCanvasNodeBounds,
  clampScale,
  findAnchorTarget,
  findProximateConnectorNode,
  getAllDescendantNodes,
  getConnectorCurveControlHandle,
  getConnectorPathMode,
  getConnectorWaypointHandles,
  getDefaultConnectorCurveControl,
  getDefaultConnectorWaypoints,
  getNodesInContext,
  getNodeParentGroupId,
  hitCanvasNodeResizeHandle,
  hitCanvasNodeRotateHandle,
  isConnectorNode,
  maybeAppendPoint,
  normalizeBounds,
  pickTopCanvasNode,
  rotateCanvasNode,
  resizeCanvasNode,
  resolveConnectorEndpoint,
  resolveConnectorPoints,
  resolveNodeToWorld,
  scaleTolerance,
  screenToWorld,
  translateCanvasNode,
  worldDeltaToGroupLocal,
  worldPointToGroupLocal,
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
const ROTATE_HANDLE_SIZE = 14;
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
  shiftKey?: boolean;
  metaKey?: boolean;
  ctrlKey?: boolean;
}

export interface SelectOptions {
  append?: boolean;
  toggle?: boolean;
  selectionIds?: string[];
  primaryId?: string | null;
}

export interface CanvasControllerOptions<TProject extends CanvasProjectLike> {
  project: TProject;
  selectedId: string | null;
  getActiveGroupId?: () => string | null;
  getTool: () => ToolLike;
  isSpacePressed: () => boolean;
  getConnectorPathMode: () => ConnectorPathMode;
  createRectNode: (point: Point) => RectNode;
  createFreehandNode: (point: Point) => FreehandNode;
  createTextNode: (point: Point) => TextNode;
  createConnectorNode: (anchor: AnchorTargetLike, point: Point, pathMode: ConnectorPathMode) => ConnectorNode;
  getNodeById: (nodes: CanvasNode[], id: string | null) => CanvasNode | null;
  upsertNode: (nodes: CanvasNode[], node: CanvasNode) => CanvasNode[];
  insertNodeIntoGroup?: (nodes: CanvasNode[], groupId: string, node: CanvasNode) => CanvasNode[];
  onSelect: (id: string | null, options?: SelectOptions) => void;
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
  syncSelectedIds: (selectedIds: string[]) => void;
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

function isRotateHandleHit(node: CanvasNode, point: Point, scale: number, board: BoardDoc): boolean {
  return hitCanvasNodeRotateHandle(node, point, scale, ROTATE_HANDLE_SIZE, board);
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

  const curveControl = getConnectorCurveControlHandle(node, board);
  if (curveControl && Math.hypot(curveControl.x - point.x, curveControl.y - point.y) <= tolerance) {
    return { kind: 'curve-control' };
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

function mergeSelectionIds(currentIds: string[], nextIds: string[]): string[] {
  return [...new Set([...currentIds, ...nextIds])];
}

function getSelectionBounds(start: Point, current: Point) {
  return normalizeBounds({
    x: start.x,
    y: start.y,
    w: current.x - start.x,
    h: current.y - start.y,
  });
}

function intersectsBounds(a: ReturnType<typeof normalizeBounds>, b: ReturnType<typeof normalizeBounds>): boolean {
  return a.x <= b.x + b.w && a.x + a.w >= b.x && a.y <= b.y + b.h && a.y + a.h >= b.y;
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
  let selectedIdsRef = options.selectedId ? [options.selectedId] : [];
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

  const getActiveGroupId = options.getActiveGroupId ?? (() => null);
  const insertNodeIntoGroup = options.insertNodeIntoGroup ?? ((nodes) => nodes);

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

  function commitProject(nextProject: TProject): void {
    projectRef = nextProject;
    boardRef = nextProject.board;
    options.onCommitProject(nextProject);
  }

  function selectNode(id: string | null, selectOptions?: SelectOptions): void {
    if (selectOptions?.selectionIds) {
      selectedIdRef = selectOptions.primaryId ?? selectOptions.selectionIds[0] ?? null;
      selectedIdsRef = selectOptions.selectionIds;
      options.onSelect(selectedIdRef, selectOptions);
      return;
    }

    selectedIdRef = id;
    selectedIdsRef = id ? [id] : [];
    if (selectOptions) {
      options.onSelect(id, selectOptions);
      return;
    }

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
      proximateConnectorNodeId: null,
      hoveredAnchor: null,
      activeConnectorHandle: null,
      selectionBox: null,
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

  function updateProximateConnectorNode(nodeId: string | null): void {
    if (state.proximateConnectorNodeId === nodeId) {
      return;
    }
    updateState({ proximateConnectorNodeId: nodeId });
    renderCurrent();
  }

  function getConnectorContextNodes(board: BoardDoc): CanvasNode[] {
    return getNodesInContext(board, getActiveGroupId());
  }

  function getConnectorTargets(
    board: BoardDoc,
    worldPoint: Point,
    options: { excludeNodeId?: string; excludeConnectorId?: string } = {},
  ): { proximateNodeId: string | null; anchor: AnchorTargetLike | null } {
    const contextNodes = getConnectorContextNodes(board);
    const proximateNode = findProximateConnectorNode(
      contextNodes,
      worldPoint,
      scaleTolerance(24, board.viewport.scale),
      board,
      options,
    );
    const anchor = findAnchorTarget(contextNodes, worldPoint, scaleTolerance(12, board.viewport.scale), {
      ...options,
      boardNodes: board.nodes,
    });

    return {
      proximateNodeId: proximateNode?.id ?? null,
      anchor,
    };
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
      proximateConnectorNodeId: null,
      hoveredAnchor: null,
      activeConnectorHandle: null,
      selectionBox: null,
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

  function getParentGroupRotation(board: BoardDoc, nodeId: string): number {
    const parentGroupId = getNodeParentGroupId(board.nodes, nodeId);
    if (!parentGroupId) {
      return 0;
    }
    const parentGroup = options.getNodeById(board.nodes, parentGroupId);
    return parentGroup && parentGroup.type === 'group' ? (parentGroup.rotation ?? 0) : 0;
  }

  function getResolvedNodeRotationInfo(board: BoardDoc, node: CanvasNode): { center: Point; rotation: number } | null {
    if (isConnectorNode(node) || node.type === 'freehand') {
      return null;
    }

    const resolved = resolveNodeToWorld(node, board);
    return {
      center: {
        x: resolved.x + resolved.w / 2,
        y: resolved.y + resolved.h / 2,
      },
      rotation: resolved.rotation ?? 0,
    };
  }

  function withConnectorPreviewPath(node: ConnectorNode, board: BoardDoc): ConnectorNode {
    if (getConnectorPathMode(node) === 'straight') {
      return {
        ...node,
        pathMode: 'straight',
        waypoints: [],
        curveControl: undefined,
      };
    }

    const start = resolveConnectorEndpoint(node.start, board);
    const end = resolveConnectorEndpoint(node.end, board);
    if (!start || !end) {
      return {
        ...node,
        pathMode: getConnectorPathMode(node),
      };
    }

    const endAnchor = node.end.kind === 'attached' ? node.end.anchor : undefined;

    if (getConnectorPathMode(node) === 'curve') {
      return {
        ...node,
        pathMode: 'curve',
        waypoints: [],
        curveControl:
          node.curveControl ??
          getDefaultConnectorCurveControl(
            start,
            end,
            node.start.kind === 'attached' ? node.start.anchor : undefined,
          ),
      };
    }

    return {
      ...node,
      pathMode: 'polyline',
      curveControl: undefined,
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
      selectedIdsRef = selectedId ? [selectedId] : [];
    },
    syncSelectedIds(selectedIds) {
      selectedIdsRef = selectedIds;
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
      const contextNodes = getNodesInContext(currentBoard, getActiveGroupId());
      const isAdditiveSelection = !!(input.shiftKey || input.metaKey || input.ctrlKey);

      if (options.getTool() === 'select') {
        if (isAdditiveSelection) {
          const pickedId = pickTopCanvasNode(contextNodes, worldPoint, tolerance, currentBoard);
          if (pickedId) {
            selectNode(pickedId, { append: true, toggle: true });
            return;
          }
        }

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
              proximateConnectorNodeId: null,
              hoveredAnchor: null,
              activeConnectorHandle: connectorHandle,
            });
            return;
          }
        }

        if (selectedNode && !isConnectorNode(selectedNode) && isRotateHandleHit(selectedNode, worldPoint, currentBoard.viewport.scale, currentBoard)) {
          startNodeInteraction('rotating-node', selectedNode.id, worldPoint);
          return;
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
            proximateConnectorNodeId: null,
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
              proximateConnectorNodeId: null,
              hoveredAnchor: null,
              activeConnectorHandle: connectorHandle,
            });
            return;
          }
        }

        selectNode(pickedId);

        if (pickedId && pickedNode && !isConnectorNode(pickedNode)) {
          startNodeInteraction('dragging-node', pickedId, worldPoint);
          return;
        }

        startScreen = input.screenPoint;
        updateState({
          pointerMode: 'marquee-selecting',
          selectionBox: {
            start: worldPoint,
            current: worldPoint,
          },
          hoveredNodeId: null,
          proximateConnectorNodeId: null,
          hoveredAnchor: null,
        });
        return;
      }

      if (options.getTool() === 'rect') {
        selectNode(null);
        const localPoint = worldPointToGroupLocal(currentBoard, getActiveGroupId(), worldPoint);
        updateState({
          pointerMode: 'drawing-rect',
          draftRect: options.createRectNode(localPoint),
          hoveredNodeId: null,
          proximateConnectorNodeId: null,
          hoveredAnchor: null,
          selectionBox: null,
        });
        return;
      }

      if (options.getTool() === 'freehand') {
        selectNode(null);
        const localPoint = worldPointToGroupLocal(currentBoard, getActiveGroupId(), worldPoint);
        updateState({
          pointerMode: 'drawing-freehand',
          draftFreehand: options.createFreehandNode(localPoint),
          hoveredNodeId: null,
          proximateConnectorNodeId: null,
          hoveredAnchor: null,
          selectionBox: null,
        });
        return;
      }

      if (options.getTool() === 'text') {
        const localPoint = worldPointToGroupLocal(currentBoard, getActiveGroupId(), worldPoint);
        const node = options.createTextNode(localPoint);
        const activeGroupId = getActiveGroupId();
        const nextProject = updateBoard({
          ...currentBoard,
          nodes: activeGroupId
            ? insertNodeIntoGroup(currentBoard.nodes, activeGroupId, node)
            : [...currentBoard.nodes, node],
        });
        commitProject(nextProject);
        selectNode(node.id);
        return;
      }

      if (options.getTool() === 'connector') {
        selectNode(null);
        const targets = getConnectorTargets(currentBoard, worldPoint);
        updateState({
          hoveredNodeId: null,
          proximateConnectorNodeId: targets.proximateNodeId,
          hoveredAnchor: targets.anchor ? { nodeId: targets.anchor.nodeId, anchor: targets.anchor.anchor } : null,
          selectionBox: null,
        });
        if (!targets.anchor) {
          return;
        }

        updateState({
          pointerMode: 'drawing-connector',
          draftConnector: options.createConnectorNode(targets.anchor, targets.anchor.point, options.getConnectorPathMode()),
          hoveredNodeId: null,
          proximateConnectorNodeId: targets.proximateNodeId,
          hoveredAnchor: { nodeId: targets.anchor.nodeId, anchor: targets.anchor.anchor },
          activeConnectorHandle: { kind: 'endpoint', endpoint: 'end' },
          selectionBox: null,
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
          const contextNodes = getNodesInContext(currentBoard, getActiveGroupId());
          const hoveredId = pickTopCanvasNode(
            contextNodes,
            worldPoint,
            scaleTolerance(6, currentBoard.viewport.scale),
            currentBoard,
          );
          if (state.hoveredAnchor || state.proximateConnectorNodeId) {
            updateState({ hoveredAnchor: null, proximateConnectorNodeId: null });
          }
          updateHoveredNode(hoveredId);
        } else {
          if (state.hoveredNodeId) {
            updateHoveredNode(null);
          }

          if (options.getTool() === 'connector') {
            const targets = getConnectorTargets(currentBoard, worldPoint);
            updateProximateConnectorNode(targets.proximateNodeId);
            updateHoveredAnchor(targets.anchor?.nodeId ?? null, targets.anchor?.anchor ?? null);
          } else if (state.hoveredAnchor || state.proximateConnectorNodeId) {
            updateState({ proximateConnectorNodeId: null });
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

      if (state.pointerMode === 'marquee-selecting' && state.selectionBox) {
        updateState({
          selectionBox: {
            ...state.selectionBox,
            current: worldPoint,
          },
        });
        renderCurrent();
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

      if (state.pointerMode === 'drawing-connector' && state.draftConnector) {
        const startNodeId = state.draftConnector.start.kind === 'attached' ? state.draftConnector.start.nodeId : undefined;
        const targets = getConnectorTargets(currentBoard, worldPoint, {
          excludeNodeId: startNodeId,
        });
        const anchor = targets.anchor;
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
          proximateConnectorNodeId: targets.proximateNodeId,
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
        const targets = getConnectorTargets(currentBoard, worldPoint, {
          excludeNodeId: stationaryEndpoint.kind === 'attached' ? stationaryEndpoint.nodeId : undefined,
          excludeConnectorId: state.draftConnector.id,
        });
        const anchor = targets.anchor;
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
        if (
          (getConnectorPathMode(draftConnector) === 'polyline' && getConnectorWaypointHandles(draftConnector).length === 0) ||
          (getConnectorPathMode(draftConnector) === 'curve' && !draftConnector.curveControl)
        ) {
          draftConnector = withConnectorPreviewPath(draftConnector, currentBoard);
        }

        updateState({
          draftConnector,
          proximateConnectorNodeId: targets.proximateNodeId,
          hoveredAnchor: anchor ? { nodeId: anchor.nodeId, anchor: anchor.anchor } : null,
        });
        renderCurrent();
        return;
      }

      if (
        state.pointerMode === 'editing-connector-waypoint' &&
        state.draftConnector &&
        (activeConnectorHandle?.kind === 'waypoint' || activeConnectorHandle?.kind === 'curve-control')
      ) {
        if (activeConnectorHandle.kind === 'curve-control') {
          updateState({
            draftConnector: {
              ...state.draftConnector,
              pathMode: 'curve',
              curveControl: worldPoint,
            },
            proximateConnectorNodeId: null,
            hoveredAnchor: null,
          });
        } else {
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
            proximateConnectorNodeId: null,
            hoveredAnchor: null,
          });
        }
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
        const parentGroupId = getNodeParentGroupId(currentBoard.nodes, activeNodeId);
        const localDelta = worldDeltaToGroupLocal(currentBoard, parentGroupId, { x: dx, y: dy });
        const activeGroupId = getActiveGroupId();
        const snapNodes = getNodesInContext(currentBoard, activeGroupId);

        const snapResult = computeDragSnap({
          node,
          delta: localDelta,
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

      if (state.pointerMode === 'rotating-node' && startWorld && activeNodeId && beforeMutation) {
        const node = options.getNodeById(beforeMutation.board.nodes, activeNodeId);
        if (!node || isConnectorNode(node)) {
          return;
        }

        const resolved = getResolvedNodeRotationInfo(currentBoard, node);
        if (!resolved) {
          return;
        }
        const startAngle = Math.atan2(startWorld.y - resolved.center.y, startWorld.x - resolved.center.x);
        const nextAngle = Math.atan2(worldPoint.y - resolved.center.y, worldPoint.x - resolved.center.x);
        const worldRotation = resolved.rotation + (nextAngle - startAngle);
        const localRotation = worldRotation - getParentGroupRotation(currentBoard, activeNodeId);

        scheduleReplaceProject(
          updateBoard({
            ...currentBoard,
            nodes: options.upsertNode(currentBoard.nodes, rotateCanvasNode(node, localRotation)),
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
        const localPoint = worldPointToGroupLocal(currentBoard, getActiveGroupId(), worldPoint);
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
        const localPoint = worldPointToGroupLocal(currentBoard, getActiveGroupId(), worldPoint);
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

      if ((state.pointerMode === 'dragging-node' || state.pointerMode === 'resizing-node' || state.pointerMode === 'rotating-node') && beforeMutation) {
        flushScheduledReplace();
        options.onFinalizeMutation(beforeMutation, currentProject);
      }

      if (state.pointerMode === 'panning' || state.pointerMode === 'pinch') {
        flushScheduledReplace();
      }

      if (state.pointerMode === 'marquee-selecting' && state.selectionBox) {
        const contextNodes = getNodesInContext(currentBoard, getActiveGroupId()).filter((node) => !isConnectorNode(node));
        const selectionBounds = getSelectionBounds(state.selectionBox.start, state.selectionBox.current);
        const matchedIds = contextNodes
          .filter((node) => intersectsBounds(normalizeBounds(getCanvasNodeBounds(node, currentBoard)), selectionBounds))
          .map((node) => node.id);
        const isAdditiveSelection = !!(input.shiftKey || input.metaKey || input.ctrlKey);
        const selectionIds = isAdditiveSelection ? mergeSelectionIds(selectedIdsRef, matchedIds) : matchedIds;
        selectNode(selectionIds[0] ?? null, {
          append: isAdditiveSelection,
          selectionIds,
          primaryId: selectionIds[selectionIds.length - 1] ?? selectionIds[0] ?? null,
        });
      }

      if (state.pointerMode === 'drawing-connector' && state.draftConnector) {
        if (state.draftConnector.start.kind === 'attached' && state.draftConnector.end.kind === 'attached') {
          const nextProject = updateBoard({
            ...currentBoard,
            nodes: [...currentBoard.nodes, state.draftConnector],
          });
          commitProject(nextProject);
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
          commitProject(nextProject);
          selectNode(state.draftConnector.id);
        } else {
          options.onReplaceProject(beforeMutation);
          selectNode(activeNodeId);
        }
      }

      if (
        state.pointerMode === 'editing-connector-waypoint' &&
        state.draftConnector &&
        activeNodeId &&
        (activeConnectorHandle?.kind === 'waypoint' || activeConnectorHandle?.kind === 'curve-control')
      ) {
        const nextProject = updateBoard({
          ...currentBoard,
          nodes: options.upsertNode(currentBoard.nodes, state.draftConnector),
        });
        commitProject(nextProject);
        selectNode(activeNodeId);
      }

      if (state.pointerMode === 'drawing-rect' && state.draftRect) {
        if (Math.abs(state.draftRect.w) > 1 && Math.abs(state.draftRect.h) > 1) {
          const activeGroupId = getActiveGroupId();
          const nextProject = updateBoard({
            ...currentBoard,
            nodes: activeGroupId
              ? insertNodeIntoGroup(currentBoard.nodes, activeGroupId, state.draftRect)
              : [...currentBoard.nodes, state.draftRect],
          });
          commitProject(nextProject);
          selectNode(state.draftRect.id);
        }
        updateState({ draftRect: null });
      }

      if (state.pointerMode === 'drawing-freehand' && state.draftFreehand) {
        if (state.draftFreehand.points.length > 1) {
          const activeGroupId = getActiveGroupId();
          const nextProject = updateBoard({
            ...currentBoard,
            nodes: activeGroupId
              ? insertNodeIntoGroup(currentBoard.nodes, activeGroupId, state.draftFreehand)
              : [...currentBoard.nodes, state.draftFreehand],
          });
          commitProject(nextProject);
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
