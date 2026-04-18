import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AssetsPanel } from '../../src/components/AssetsPanel';
import type { AssetRecord } from '../../src/types/canvas';

const asset: AssetRecord = {
  id: 'asset_1',
  type: 'image',
  name: 'Hero image',
  mimeType: 'image/png',
  src: 'data:image/png;base64,abc',
  width: 1200,
  height: 800,
  origin: 'generated',
  createdAt: 1,
};

describe('AssetsPanel', () => {
  it('renders a collapsed rail that can reopen the asset sidebar', () => {
    const onToggle = vi.fn();

    render(
      <AssetsPanel
        assets={[]}
        isOpen={false}
        fileInputRef={{ current: null }}
        onToggle={onToggle}
        onUpload={vi.fn()}
        onInsertAsset={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /展开/i }));

    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('complementary', { name: '素材管理侧栏' })).toBeTruthy();
  });

  it('shows grouped assets and upload action when expanded', () => {
    const onInsertAsset = vi.fn();
    const onUpload = vi.fn();

    render(
      <AssetsPanel
        assets={[asset]}
        isOpen
        fileInputRef={{ current: null }}
        onToggle={vi.fn()}
        onUpload={onUpload}
        onInsertAsset={onInsertAsset}
      />,
    );

    expect(screen.getByText('素材管理')).toBeTruthy();
    expect(screen.getByText('最近生成')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Hero image/ }));
    expect(onInsertAsset).toHaveBeenCalledWith(asset);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['seed'], 'ref.png', { type: 'image/png' });
    fireEvent.change(input, { target: { files: [file] } });
    expect(onUpload).toHaveBeenCalled();
  });
});
