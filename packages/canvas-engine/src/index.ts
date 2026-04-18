export type { EngineNode, EnginePoint, NodeAdapter, RenderEnvironment } from './contracts';
export type {
  AnchorId,
  AttachedConnectorEndpoint,
  BoardDoc,
  BoxNode,
  CanvasNode,
  ConnectorEndpoint,
  ConnectorNode,
  FreeConnectorEndpoint,
  FreehandNode,
  ImageNode,
  Point,
  RectNode,
  Shape,
  TextNode,
  VideoNode,
  Viewport,
} from './model';
export {
  findAnchorTarget,
  getAnchorPoint,
  getNodeAnchors,
  isAttachedConnectorEndpoint,
  isBoxNode,
  isConnectorAttachedToNode,
  isConnectorNode,
  resolveConnectorEndpoint,
  resolveConnectorPoints,
  type AnchorTarget,
} from './anchors';
export { boundsFromPoints, distanceToSegment, normalizeBounds, pointInBounds, type Bounds } from './geometry';
export { clampScale, screenToWorld, worldToScreen, zoomAtScreenPoint, MAX_SCALE, MIN_SCALE } from './transform';
export { createNodeRegistry, type NodeRegistry } from './registry';
export { canDrawLoadedImage, createCanvasRenderRuntime, type AssetRecordLike, type CanvasRenderRuntime } from './runtime';
export {
  createCanvasInteractionController,
  type CanvasControllerOptions,
  type CanvasControllerPointerInput,
  type CanvasInteractionController,
  type CanvasProjectLike,
  type ToolLike,
} from './controller';
export {
  createInitialInteractionState,
  getCanvasCursor,
  isActiveInteractionMode,
  isInteractionActive,
  type CanvasInteractionState,
  type DraftState,
  type PointerMode,
  type SnapGuide,
} from './controller-state';
export { computeDragSnap, type DragSnapResult, type SnapMatch } from './snap';
export {
  drawCanvasNode,
  getCanvasNodeBounds,
  getNodeAdapter,
  getNodeAdapterRegistry,
  hitCanvasNodeResizeHandle,
  hitTestCanvasNode,
  pickTopCanvasNode,
  resizeCanvasNode,
  translateCanvasNode,
  type CanvasAssetRecord,
} from './canvas-registry';
export { maybeAppendPoint, renderScene, scaleTolerance } from './scene';
