import { describe, expect, it } from 'vitest';
import { fitAssetSize } from '../../src/utils/assetSizing';

describe('asset sizing', () => {
  it('fits large video assets without changing their aspect ratio', () => {
    expect(fitAssetSize({ width: 1280, height: 720 })).toEqual({ width: 360, height: 203 });
  });

  it('does not upscale small assets', () => {
    expect(fitAssetSize({ width: 120, height: 90 })).toEqual({ width: 120, height: 90 });
  });
});
