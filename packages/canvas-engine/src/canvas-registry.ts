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
import { connectorNodeAdapter } from './adapters/connector';
import { groupNodeAdapter } from './adapters/group';
import { getRotateHandlePoint, rotateBoxNode } from './adapters/shared';

export interface CanvasAssetRecord extends AssetRecordLike {
  src: string;
  name: string;
  frameSrc?: string | null;
  posterSrc?: string | null;
}

type RegisteredCanvasNodeAdapter =
  | typeof rectNodeAdapter
  | typeof freehandNodeAdapter
  | typeof textNodeAdapter
  | typeof imageNodeAdapter
  | typeof videoNodeAdapter
  | typeof connectorNodeAdapter
  | typeof groupNodeAdapter;

type CanvasRuntime = CanvasRenderRuntime<CanvasAssetRecord>;
type CanvasNodeAdapter<TNode extends CanvasNode> = NodeAdapter<TNode, BoardDoc, CanvasRuntime, Point>;
type CanvasRenderEnvironment = RenderEnvironment<BoardDoc, CanvasRuntime>;

const canvasNodeRegistry = createNodeRegistry<CanvasNode, BoardDoc, CanvasRuntime, Point, RegisteredCanvasNodeAdapter>([
  rectNodeAdapter,
  freehandNodeAdapter,
  textNodeAdapter,
  imageNodeAdapter,
  videoNodeAdapter,
  connectorNodeAdapter,
  groupNodeAdapter,
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

export function getCanvasNodeBounds(node: CanvasNode, board?: BoardDoc): Bounds {
  return canvasNodeRegistry.getNodeBounds(node, board);
}

export function hitTestCanvasNode(node: CanvasNode, point: Point, tolerance: number, board?: BoardDoc): boolean {
  return canvasNodeRegistry.hitTestNode(node, point, tolerance, board);
}

export function pickTopCanvasNode(nodes: CanvasNode[], point: Point, tolerance: number, board?: BoardDoc): string | null {
  return canvasNodeRegistry.pickTopNode(nodes, point, tolerance, board);
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
  board?: BoardDoc,
): boolean {
  return canvasNodeRegistry.hitResizeHandle(node, point, scale, handleSize, board);
}

function isRotatableCanvasNode(node: CanvasNode): node is Exclude<CanvasNode, { type: 'freehand' | 'connector' }> {
  return node.type !== 'freehand' && node.type !== 'connector';
}

export function hitCanvasNodeRotateHandle(
  node: CanvasNode,
  point: Point,
  scale: number,
  handleSize: number,
  board?: BoardDoc,
): boolean {
  if (!isRotatableCanvasNode(node)) {
    return false;
  }

  const handle = getRotateHandlePoint(node, board);
  const half = handleSize / scale / 2;
  return (
    point.x >= handle.x - half - 2 / scale &&
    point.x <= handle.x + half + 2 / scale &&
    point.y >= handle.y - half - 2 / scale &&
    point.y <= handle.y + half + 2 / scale
  );
}

export function rotateCanvasNode(node: CanvasNode, rotation: number): CanvasNode {
  if (!isRotatableCanvasNode(node)) {
    return node;
  }
  return rotateBoxNode(node, rotation);
}

export function getNodeAdapterRegistry(): ReadonlyMap<CanvasNode['type'], RegisteredCanvasNodeAdapter> {
  return canvasNodeRegistry.getRegistry();
}
