import {
  getCanvasNodeBounds,
  normalizeBounds,
  worldToScreen,
  type VideoNode,
} from '@infinite-canvas/canvas-engine';
import { useMemo, useState } from 'react';
import type { AssetRecord, BoardDoc } from '../types/canvas';

interface VideoOverlayLayerProps {
  board: BoardDoc;
  assets: AssetRecord[];
  selectedId: string | null;
}

interface VideoOverlayItemProps {
  node: VideoNode;
  asset: AssetRecord;
  board: BoardDoc;
  selected: boolean;
}

function VideoOverlayItem({ node, asset, board, selected }: VideoOverlayItemProps) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  const bounds = normalizeBounds(getCanvasNodeBounds(node));
  const topLeft = worldToScreen({ x: bounds.x, y: bounds.y }, board.viewport);
  const width = bounds.w * board.viewport.scale;
  const height = bounds.h * board.viewport.scale;

  if (width <= 1 || height <= 1) {
    return null;
  }

  return (
    <div
      className={selected ? 'video-overlay-item video-overlay-item-selected' : 'video-overlay-item'}
      style={{
        left: topLeft.x,
        top: topLeft.y,
        width,
        height,
      }}
    >
      <video
        className={status === 'ready' ? 'video-overlay-media video-overlay-media-ready' : 'video-overlay-media'}
        src={asset.src}
        muted
        loop
        autoPlay
        playsInline
        preload="metadata"
        aria-label={asset.name}
        onLoadedData={() => setStatus('ready')}
        onError={() => setStatus('error')}
      />
      {status !== 'ready' ? (
        <div className="video-overlay-fallback">
          <span>{status === 'error' ? 'Video unavailable' : 'Loading video'}</span>
        </div>
      ) : null}
    </div>
  );
}

export function VideoOverlayLayer({ board, assets, selectedId }: VideoOverlayLayerProps) {
  const assetMap = useMemo(() => new Map(assets.map((asset) => [asset.id, asset])), [assets]);

  const videoNodes = useMemo(
    () => board.nodes.filter((node): node is VideoNode => node.type === 'video'),
    [board.nodes],
  );

  return (
    <div className="video-overlay-layer" aria-hidden="true">
      {videoNodes.map((node) => {
        const asset = assetMap.get(node.assetId);
        if (!asset || asset.type !== 'video') {
          return null;
        }

        return <VideoOverlayItem key={node.id} node={node} asset={asset} board={board} selected={selectedId === node.id} />;
      })}
    </div>
  );
}
