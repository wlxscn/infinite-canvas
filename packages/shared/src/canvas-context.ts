export interface CanvasContextPayload {
  selectedNode: {
    id: string;
    type: string;
    text?: string;
  } | null;
  latestPrompt?: string | null;
  nodeCount: number;
  assetCount: number;
  recentAssets: Array<{
    id: string;
    name: string;
    origin: 'upload' | 'generated';
  }>;
}
