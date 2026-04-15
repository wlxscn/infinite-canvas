import type { Bounds } from './geometry';
import type { EngineNode, EnginePoint, NodeAdapter, RenderEnvironment } from './contracts';

type RegisteredNodeAdapter<TBoard, TRuntime, TPoint extends EnginePoint> = NodeAdapter<any, TBoard, TRuntime, TPoint>;

export interface NodeRegistry<
  TNode extends EngineNode,
  TBoard,
  TRuntime,
  TPoint extends EnginePoint,
  TAdapter extends RegisteredNodeAdapter<TBoard, TRuntime, TPoint>,
> {
  getAdapter: <TSpecificNode extends TNode>(node: TSpecificNode) => NodeAdapter<TSpecificNode, TBoard, TRuntime, TPoint>;
  drawNode: (ctx: CanvasRenderingContext2D, node: TNode, environment: RenderEnvironment<TBoard, TRuntime>) => void;
  getNodeBounds: (node: TNode) => Bounds;
  hitTestNode: (node: TNode, point: TPoint, tolerance: number) => boolean;
  pickTopNode: (nodes: TNode[], point: TPoint, tolerance: number) => string | null;
  translateNode: (node: TNode, delta: TPoint) => TNode;
  resizeNode: (node: TNode, pointer: TPoint) => TNode;
  hitResizeHandle: (node: TNode, point: TPoint, scale: number, handleSize: number) => boolean;
  getRegistry: () => ReadonlyMap<TNode['type'], TAdapter>;
}

export function createNodeRegistry<
  TNode extends EngineNode,
  TBoard,
  TRuntime,
  TPoint extends EnginePoint,
  TAdapter extends RegisteredNodeAdapter<TBoard, TRuntime, TPoint>,
>(adapters: readonly TAdapter[]): NodeRegistry<TNode, TBoard, TRuntime, TPoint, TAdapter> {
  const adapterRegistry = new Map<TNode['type'], TAdapter>(adapters.map((adapter) => [adapter.type, adapter]));

  function getAdapter<TSpecificNode extends TNode>(
    node: TSpecificNode,
  ): NodeAdapter<TSpecificNode, TBoard, TRuntime, TPoint> {
    const adapter = adapterRegistry.get(node.type) as NodeAdapter<TSpecificNode, TBoard, TRuntime, TPoint> | undefined;
    if (!adapter) {
      throw new Error(`Unsupported canvas node type: ${node.type}`);
    }
    return adapter;
  }

  return {
    getAdapter,
    drawNode(ctx, node, environment) {
      getAdapter(node).draw(ctx, node, environment);
    },
    getNodeBounds(node) {
      return getAdapter(node).getBounds(node);
    },
    hitTestNode(node, point, tolerance) {
      return getAdapter(node).hitTest(node, point, tolerance);
    },
    pickTopNode(nodes, point, tolerance) {
      for (let index = nodes.length - 1; index >= 0; index -= 1) {
        if (getAdapter(nodes[index]).hitTest(nodes[index], point, tolerance)) {
          return nodes[index].id;
        }
      }
      return null;
    },
    translateNode(node, delta) {
      return getAdapter(node).translate(node, delta);
    },
    resizeNode(node, pointer) {
      const adapter = getAdapter(node);
      return adapter.resize ? adapter.resize(node, pointer) : node;
    },
    hitResizeHandle(node, point, scale, handleSize) {
      const adapter = getAdapter(node);
      return adapter.hitResizeHandle ? adapter.hitResizeHandle(node, point, scale, handleSize) : false;
    },
    getRegistry() {
      return adapterRegistry;
    },
  };
}
