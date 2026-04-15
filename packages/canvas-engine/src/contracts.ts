import type { Bounds } from './geometry';

export interface EnginePoint {
  x: number;
  y: number;
}

export interface EngineNode {
  id: string;
  type: string;
}

export interface RenderEnvironment<TBoard, TRuntime> {
  board: TBoard;
  runtime: TRuntime;
  rerender: () => void;
}

export interface NodeAdapter<
  TNode extends EngineNode,
  TBoard,
  TRuntime,
  TPoint extends EnginePoint = EnginePoint,
> {
  type: TNode['type'];
  draw: (ctx: CanvasRenderingContext2D, node: TNode, env: RenderEnvironment<TBoard, TRuntime>) => void;
  getBounds: (node: TNode) => Bounds;
  hitTest: (node: TNode, point: TPoint, tolerance: number) => boolean;
  translate: (node: TNode, delta: TPoint) => TNode;
  resize?: (node: TNode, pointer: TPoint) => TNode;
  hitResizeHandle?: (node: TNode, point: TPoint, scale: number, handleSize: number) => boolean;
}
