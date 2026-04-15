import { createNodeRegistry } from './registry';
import type { CanvasRenderRuntime } from './runtime';
import type { Bounds, NodeAdapter, RenderEnvironment } from './index';
import type { AssetRecordLike } from './runtime';
import type { BoardDoc, CanvasNode, Point } from './model';
import { freehandNodeAdapter } from './adapters/freehand';
import { imageNodeAdapter } from './adapters/image';
import { rectNodeAdapter } from './adapters/rect';
import { textNodeAdapter } from './adapters/text';
import { videoNodeAdapter } from './adapters/video';

export interface CanvasAssetRecord extends AssetRecordLike {
  src: string;
  name: string;
  posterSrc?: string | null;
}

type RegisteredCanvasNodeAdapter =
  | typeof rectNodeAdapter
  | typeof freehandNodeAdapter
  | typeof textNodeAdapter
  | typeof imageNodeAdapter
  | typeof videoNodeAdapter;

type CanvasRuntime = CanvasRenderRuntime<CanvasAssetRecord>;
type CanvasNodeAdapter<TNode extends CanvasNode> = NodeAdapter<TNode, BoardDoc, CanvasRuntime, Point>;
type CanvasRenderEnvironment = RenderEnvironment<BoardDoc, CanvasRuntime>;

const canvasNodeRegistry = createNodeRegistry<CanvasNode, BoardDoc, CanvasRuntime, Point, RegisteredCanvasNodeAdapter>([
  rectNodeAdapter,
  freehandNodeAdapter,
  textNodeAdapter,
  imageNodeAdapter,
  videoNodeAdapter,
] as const);

export function getNodeAdapter<TNode extends CanvasNode>(node: TNode): CanvasNodeAdapter<TNode> {
  return canvasNodeRegistry.getAdapter(node);
}

export function drawCanvasNode(
  ctx: CanvasRenderingContext2D,
  node: CanvasNode,
  environment: CanvasRenderEnvironment,
): void {
  canvasNodeRegistry.drawNode(ctx, node, environment);
}

export function getCanvasNodeBounds(node: CanvasNode): Bounds {
  return canvasNodeRegistry.getNodeBounds(node);
}

export function hitTestCanvasNode(node: CanvasNode, point: Point, tolerance: number): boolean {
  return canvasNodeRegistry.hitTestNode(node, point, tolerance);
}

export function pickTopCanvasNode(nodes: CanvasNode[], point: Point, tolerance: number): string | null {
  return canvasNodeRegistry.pickTopNode(nodes, point, tolerance);
}

export function translateCanvasNode(node: CanvasNode, delta: Point): CanvasNode {
  return canvasNodeRegistry.translateNode(node, delta);
}

export function resizeCanvasNode(node: CanvasNode, pointer: Point): CanvasNode {
  return canvasNodeRegistry.resizeNode(node, pointer);
}

export function hitCanvasNodeResizeHandle(
  node: CanvasNode,
  point: Point,
  scale: number,
  handleSize: number,
): boolean {
  return canvasNodeRegistry.hitResizeHandle(node, point, scale, handleSize);
}

export function getNodeAdapterRegistry(): ReadonlyMap<CanvasNode['type'], RegisteredCanvasNodeAdapter> {
  return canvasNodeRegistry.getRegistry();
}
