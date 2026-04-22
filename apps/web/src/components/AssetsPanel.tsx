import type { AssetRecord } from '../types/canvas';
import type { RefObject } from 'react';

interface AssetsPanelProps {
  assets: AssetRecord[];
  isOpen: boolean;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onToggle: () => void;
  onUpload: (files: FileList | null) => void;
  onInsertAsset: (asset: AssetRecord) => void;
}

function AssetSection({
  title,
  assets,
  onInsertAsset,
}: {
  title: string;
  assets: AssetRecord[];
  onInsertAsset: (asset: AssetRecord) => void;
}) {
  if (assets.length === 0) {
    return null;
  }

  return (
    <section className="asset-sidebar-section">
      <div className="panel-row">
        <strong>{title}</strong>
        <span>{assets.length}</span>
      </div>
      <div className="asset-sidebar-list">
        {assets.map((asset) => (
          <button key={asset.id} className="asset-card" type="button" onClick={() => onInsertAsset(asset)}>
            <div className={asset.type === 'video' ? 'asset-card-preview asset-card-preview-video' : 'asset-card-preview'}>
              {asset.type === 'video' ? (
                <>
                  {asset.frameSrc ? (
                    <img alt={asset.name} src={asset.frameSrc} />
                  ) : (
                    <video aria-hidden="true" muted playsInline preload="metadata" src={asset.src} poster={asset.posterSrc ?? undefined} />
                  )}
                  <span className="asset-chip-badge">视频</span>
                </>
              ) : (
                <img alt={asset.name} src={asset.src} />
              )}
            </div>
            <div className="asset-card-copy">
              <strong>{asset.name}</strong>
              <span>
                {asset.type === 'video' ? '视频' : '图片'} · {asset.origin === 'generated' ? '生成' : '上传'}
              </span>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

export function AssetsPanel({ assets, isOpen, fileInputRef, onToggle, onUpload, onInsertAsset }: AssetsPanelProps) {
  const generatedAssets = assets.filter((asset) => asset.origin === 'generated');
  const uploadedAssets = assets.filter((asset) => asset.origin === 'upload');

  if (!isOpen) {
    return (
      <aside className="asset-sidebar asset-sidebar-collapsed" aria-label="素材管理侧栏">
        <button
          className="asset-sidebar-rail"
          type="button"
          onClick={onToggle}
          aria-label="展开素材管理"
          aria-expanded="false"
          aria-controls="asset-sidebar-panel"
        >
          <span className="asset-sidebar-rail-icon" aria-hidden="true">
            ▧
          </span>
          <span className="asset-sidebar-rail-count" aria-hidden="true">
            {assets.length}
          </span>
        </button>
      </aside>
    );
  }

  return (
    <aside id="asset-sidebar-panel" className="asset-sidebar asset-sidebar-open" aria-label="素材管理侧栏">
      <div className="asset-sidebar-header">
        <div>
          <p className="section-kicker">Assets</p>
          <strong>素材管理</strong>
        </div>
        <div className="asset-sidebar-header-actions">
          <span className="status-pill">{assets.length} 项</span>
          <button className="ghost-btn" type="button" onClick={onToggle} aria-label="收起素材栏">
            收起
          </button>
        </div>
      </div>

      <button className="ghost-btn ghost-btn-dark asset-import-btn" type="button" onClick={() => fileInputRef.current?.click()}>
        导入参考图
      </button>

      <input
        ref={fileInputRef}
        hidden
        accept="image/*"
        type="file"
        onChange={(event) => {
          onUpload(event.target.files);
          event.currentTarget.value = '';
        }}
      />

      <div className="asset-sidebar-body">
        {assets.length === 0 ? (
          <div className="asset-sidebar-empty">
            <strong>还没有素材</strong>
            <p>在右侧描述你想生成的内容，生成结果和上传素材会先出现在这里，然后再插入到画布中。</p>
          </div>
        ) : null}

        <AssetSection title="最近生成" assets={generatedAssets} onInsertAsset={onInsertAsset} />
        <AssetSection title="上传素材" assets={uploadedAssets} onInsertAsset={onInsertAsset} />
      </div>
    </aside>
  );
}
