export function fitAssetSize(
  asset: { width: number; height: number },
  maxWidth = 360,
  maxHeight = 240,
): { width: number; height: number } {
  const width = Math.max(asset.width, 1);
  const height = Math.max(asset.height, 1);
  const scale = Math.min(maxWidth / width, maxHeight / height, 1);

  return {
    width: Math.round(width * scale),
    height: Math.round(height * scale),
  };
}
