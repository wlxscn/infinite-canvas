import {
  createCanvasInteractionController,
  createInitialInteractionState,
  getAllDescendantNodes,
  getConnectorWaypointHandles,
  getDefaultConnectorWaypoints,
  getNodeAnchors,
  getCanvasCursor,
  isInteractionActive,
  isConnectorNode,
  renderScene,
  type ConnectorHandle,
  type ConnectorPathMode,
  type CanvasInteractionState,
  resolveConnectorPoints,
  worldToScreen,
  type CanvasInteractionController,
  type SnapGuide,
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
import { useCanvasRulerModel, type CanvasRulerAxisModel } from '../hooks/useCanvasRulerModel';
import { createId } from '../utils/id';
import type { CanvasNode, CanvasProject, Point, Tool } from '../types/canvas';
import { getNodeById, insertNodeIntoGroup, upsertNode } from '../state/store';

const RULER_SIZE = 28;

interface CanvasStageProps {
  project: CanvasProject;
  tool: Tool;
  connectorPathMode: ConnectorPathMode;
  selectedId: string | null;
  selectedIds: string[];
  activeGroupId: string | null;
  isSpacePressed: boolean;
  onInteractionActiveChange: (active: boolean) => void;
  onSelect: (
    id: string | null,
    options?: { append?: boolean; toggle?: boolean; selectionIds?: string[]; primaryId?: string | null },
  ) => void;
  onReplaceProject: (project: CanvasProject) => void;
  onCommitProject: (project: CanvasProject) => void;
  onFinalizeMutation: (beforeProject: CanvasProject, afterProject: CanvasProject) => void;
}

interface CanvasRulerProps {
  axis: 'horizontal' | 'vertical';
  model: CanvasRulerAxisModel;
}

function CanvasRuler({ axis, model }: CanvasRulerProps) {
  const isHorizontal = axis === 'horizontal';

  return (
    <div
      className={isHorizontal ? 'canvas-ruler canvas-ruler-top' : 'canvas-ruler canvas-ruler-left'}
      aria-label={isHorizontal ? '水平刻度尺' : '垂直刻度尺'}
      data-major-step={model.majorStep}
      data-first-value={model.majorTicks[0]?.value ?? ''}
      data-last-value={model.majorTicks[model.majorTicks.length - 1]?.value ?? ''}
    >
      {model.rangeProjection ? (
        <div
          className={isHorizontal ? 'canvas-ruler-range canvas-ruler-range-x' : 'canvas-ruler-range canvas-ruler-range-y'}
          style={
            isHorizontal
              ? { left: model.rangeProjection.start, width: model.rangeProjection.size }
              : { top: model.rangeProjection.start, height: model.rangeProjection.size }
          }
        />
      ) : null}

      {model.minorTicks.map((tick) => (
        <div
          key={tick.key}
          className={isHorizontal ? 'canvas-ruler-tick canvas-ruler-tick-minor' : 'canvas-ruler-tick canvas-ruler-tick-minor canvas-ruler-tick-vertical'}
          style={isHorizontal ? { left: tick.position } : { top: tick.position }}
        />
      ))}

      {model.majorTicks.map((tick) => (
        <div
          key={tick.key}
          className={isHorizontal ? 'canvas-ruler-major' : 'canvas-ruler-major canvas-ruler-major-vertical'}
          style={isHorizontal ? { left: tick.position } : { top: tick.position }}
        >
          <div className={isHorizontal ? 'canvas-ruler-tick' : 'canvas-ruler-tick canvas-ruler-tick-vertical'} />
          <span className="canvas-ruler-label">{tick.label}</span>
        </div>
      ))}
    </div>
  );
}

function CanvasSnapGuides({ guides }: { guides: SnapGuide[] }) {
  if (guides.length === 0) {
    return null;
  }

  return (
    <div className="canvas-snap-guides" aria-hidden="true">
      {guides.map((guide, index) => {
        if (guide.axis === 'x') {
          return (
            <div
              key={`snap-x-${index}`}
              className={`canvas-snap-guide canvas-snap-guide-x canvas-snap-guide-${guide.kind}`}
              style={{
                left: guide.screenPosition,
                top: guide.start,
                height: Math.max(0, guide.end - guide.start),
              }}
            />
          );
        }

        return (
          <div
            key={`snap-y-${index}`}
            className={`canvas-snap-guide canvas-snap-guide-y canvas-snap-guide-${guide.kind}`}
            style={{
              top: guide.screenPosition,
              left: guide.start,
              width: Math.max(0, guide.end - guide.start),
            }}
          />
        );
      })}
    </div>
  );
}

function CanvasAnchorOverlay({
  board,
  tool,
  pointerMode,
  selectedNode,
  draftConnector,
  hoveredAnchor,
  activeConnectorHandle,
}: {
  board: CanvasProject['board'];
  tool: Tool;
  pointerMode: CanvasInteractionState['pointerMode'];
  selectedNode: CanvasNode | null;
  draftConnector: CanvasInteractionState['draftConnector'];
  hoveredAnchor: { nodeId: string; anchor: string } | null;
  activeConnectorHandle: ConnectorHandle | null;
}) {
  const isConnectorEditing =
    pointerMode === 'editing-connector-end' || pointerMode === 'editing-connector-waypoint';
  const shouldShowAnchors = tool === 'connector' || pointerMode === 'drawing-connector' || pointerMode === 'editing-connector-end';
  const editingConnector =
    isConnectorEditing && draftConnector && isConnectorNode(draftConnector)
      ? draftConnector
      : selectedNode && isConnectorNode(selectedNode)
        ? selectedNode
        : null;
  const anchors = useMemo(() => {
    if (!shouldShowAnchors) {
      return [];
    }

    return getAllDescendantNodes(board.nodes).flatMap((node) =>
      getNodeAnchors(node, board).map((anchor) => ({
        ...anchor,
        screenPoint: worldToScreen(anchor.point, board.viewport),
      })),
    );
  }, [board, shouldShowAnchors]);

  const connectorHandles = useMemo(() => {
    if (!editingConnector || !isConnectorEditing) {
      return null;
    }

    const points = resolveConnectorPoints(editingConnector, board);
    if (!points) {
      return null;
    }

    return {
      start: worldToScreen(points.start, board.viewport),
      end: worldToScreen(points.end, board.viewport),
      waypoints: getConnectorWaypointHandles(editingConnector).map((point) => worldToScreen(point, board.viewport)),
    };
  }, [board, editingConnector, isConnectorEditing]);

  if (!shouldShowAnchors && !connectorHandles) {
    return null;
  }

  return (
    <div className="canvas-anchor-overlay" aria-hidden="true">
      {anchors.map((anchor) => (
        <div
          key={`${anchor.nodeId}-${anchor.anchor}`}
          className={
            hoveredAnchor?.nodeId === anchor.nodeId && hoveredAnchor.anchor === anchor.anchor
              ? 'canvas-anchor canvas-anchor-active'
              : 'canvas-anchor'
          }
          style={{
            left: anchor.screenPoint.x,
            top: anchor.screenPoint.y,
          }}
        />
      ))}

      {connectorHandles ? (
        <>
          <div
            className={
              activeConnectorHandle?.kind === 'endpoint' && activeConnectorHandle.endpoint === 'start'
                ? 'canvas-connector-handle canvas-connector-handle-active'
                : 'canvas-connector-handle'
            }
            style={{ left: connectorHandles.start.x, top: connectorHandles.start.y }}
          />
          {connectorHandles.waypoints.map((point, index) => (
            <div
              key={`waypoint-${index}`}
              className={
                activeConnectorHandle?.kind === 'waypoint' && activeConnectorHandle.index === index
                  ? 'canvas-connector-handle canvas-connector-handle-waypoint canvas-connector-handle-active'
                  : 'canvas-connector-handle canvas-connector-handle-waypoint'
              }
              style={{ left: point.x, top: point.y }}
            />
          ))}
          <div
            className={
              activeConnectorHandle?.kind === 'endpoint' && activeConnectorHandle.endpoint === 'end'
                ? 'canvas-connector-handle canvas-connector-handle-active'
                : 'canvas-connector-handle'
            }
            style={{ left: connectorHandles.end.x, top: connectorHandles.end.y }}
          />
        </>
      ) : null}
    </div>
  );
}

export function CanvasStage({
  project,
  tool,
  connectorPathMode,
  selectedId,
  selectedIds,
  activeGroupId,
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
  const selectedIdsRef = useRef(selectedIds);
  const toolRef = useRef(tool);
  const isSpacePressedRef = useRef(isSpacePressed);
  const onSelectRef = useRef(onSelect);
  const onReplaceProjectRef = useRef(onReplaceProject);
  const onCommitProjectRef = useRef(onCommitProject);
  const onFinalizeMutationRef = useRef(onFinalizeMutation);
  const [interactionState, setInteractionState] = useState(createInitialInteractionState());
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  const renderProjectNow = useCallback(
    (nextProject: CanvasProject, selectedNodeId: string | null, state: CanvasInteractionState): void => {
      const canvas = canvasRef.current;
      if (!canvas) {
        return;
      }

      renderScene({
        canvas,
        board: nextProject.board,
        assets: nextProject.assets,
        selectedId: selectedNodeId,
        selectedIds: selectedIdsRef.current,
        hoveredId: state.hoveredNodeId,
        activeGroupId,
        selectionBox: state.selectionBox,
        draftRect: state.draftRect,
        draftFreehand: state.draftFreehand,
        draftConnector: state.draftConnector,
      });
    },
    [activeGroupId],
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
    selectedIdsRef.current = selectedIds;
  }, [selectedIds]);

  useEffect(() => {
    const controller = createCanvasInteractionController({
      project: initialProjectRef.current,
      selectedId: initialSelectedIdRef.current,
      getActiveGroupId: () => activeGroupId,
      getTool: () => toolRef.current,
      isSpacePressed: () => isSpacePressedRef.current,
      getConnectorPathMode: () => connectorPathMode,
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
      createConnectorNode: (anchor, point, pathMode) => ({
        id: createId('node'),
        type: 'connector',
        start: {
          kind: 'attached',
          nodeId: anchor.nodeId,
          anchor: anchor.anchor,
        },
        end: {
          kind: 'free',
          x: point.x,
          y: point.y,
        },
        pathMode,
        waypoints: pathMode === 'polyline' ? getDefaultConnectorWaypoints(anchor.point, point, anchor.anchor) : [],
        stroke: '#c44e1c',
        width: 2,
      }),
      getNodeById,
      upsertNode,
      insertNodeIntoGroup,
      onSelect: (id, options) => onSelectRef.current(id, options),
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
  }, [activeGroupId, connectorPathMode, renderProjectNow]);

  useEffect(() => {
    controllerRef.current?.syncProject(project);
    controllerRef.current?.syncSelectedId(selectedId);
    controllerRef.current?.syncSelectedIds(selectedIds);
    controllerRef.current?.renderIfIdle();
  }, [project, selectedId, selectedIds]);

  useEffect(() => {
    onInteractionActiveChange(isInteractionActive(interactionState));
  }, [interactionState, onInteractionActiveChange]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const updateContainerSize = () => {
      setContainerSize({
        width: container.clientWidth,
        height: container.clientHeight,
      });
    };

    updateContainerSize();

    const observer = new ResizeObserver(() => {
      updateContainerSize();
      controllerRef.current?.handleResize();
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const cursor = useMemo(() => getCanvasCursor(interactionState, tool, isSpacePressed), [interactionState, isSpacePressed, tool]);
  const selectedNode = useMemo(() => getNodeById(project.board.nodes, selectedId), [project.board.nodes, selectedId]);
  const contentWidth = Math.max(0, containerSize.width - RULER_SIZE);
  const contentHeight = Math.max(0, containerSize.height - RULER_SIZE);
  const rulerModel = useCanvasRulerModel({
    board: project.board,
    viewport: project.board.viewport,
    contentWidth,
    contentHeight,
    selectedNode,
  });

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

  const handlePointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>): void => {
    event.currentTarget.setPointerCapture(event.pointerId);
    controllerRef.current?.handlePointerDown({
      screenPoint: getEventPoint(event),
      pointerId: event.pointerId,
      pointerType: event.pointerType,
      button: event.button,
      shiftKey: event.shiftKey,
      metaKey: event.metaKey,
      ctrlKey: event.ctrlKey,
    });
  }, [getEventPoint]);

  const handlePointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>): void => {
    controllerRef.current?.handlePointerMove({
      screenPoint: getEventPoint(event),
      pointerId: event.pointerId,
      pointerType: event.pointerType,
      button: event.button,
      shiftKey: event.shiftKey,
      metaKey: event.metaKey,
      ctrlKey: event.ctrlKey,
    });
  }, [getEventPoint]);

  const handlePointerUp = useCallback((event: ReactPointerEvent<HTMLDivElement>): void => {
    controllerRef.current?.handlePointerUp({
      screenPoint: getEventPoint(event),
      pointerId: event.pointerId,
      pointerType: event.pointerType,
      button: event.button,
      shiftKey: event.shiftKey,
      metaKey: event.metaKey,
      ctrlKey: event.ctrlKey,
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
      <div className="canvas-ruler-corner" aria-hidden="true" />
      <CanvasRuler axis="horizontal" model={rulerModel.horizontal} />
      <CanvasRuler axis="vertical" model={rulerModel.vertical} />
      <div className="canvas-stage-content">
        <div
          className="canvas-stage-events"
          style={{ cursor }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          <canvas ref={canvasRef} className="canvas-surface" />
        </div>
        <CanvasAnchorOverlay
          board={project.board}
          tool={tool}
          pointerMode={interactionState.pointerMode}
          selectedNode={selectedNode}
          draftConnector={interactionState.draftConnector}
          hoveredAnchor={interactionState.hoveredAnchor}
          activeConnectorHandle={interactionState.activeConnectorHandle}
        />
        <CanvasSnapGuides guides={interactionState.snapGuides} />
        <VideoOverlayLayer
          board={project.board}
          assets={project.assets}
          selectedId={selectedId}
          hoveredId={interactionState.hoveredNodeId}
        />
      </div>
    </div>
  );
}
