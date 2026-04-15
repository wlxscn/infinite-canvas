export interface AssetRecordLike {
  id: string;
}

interface CachedImageResource {
  image: HTMLImageElement;
  status: 'loading' | 'ready' | 'error';
}

const imageCache = new Map<string, CachedImageResource>();

export interface CanvasRenderRuntime<TAsset extends AssetRecordLike> {
  assetMap: Map<string, TAsset>;
  getImage: (url: string, rerender: () => void) => HTMLImageElement;
  getImageStatus: (url: string, rerender: () => void) => CachedImageResource['status'];
}

function getCachedImage(url: string, rerender: () => void): HTMLImageElement {
  let resource = imageCache.get(url);
  if (!resource) {
    const image = new Image();
    resource = {
      image,
      status: 'loading',
    };
    image.onload = () => {
      resource!.status = 'ready';
      rerender();
    };
    image.onerror = () => {
      resource!.status = 'error';
      rerender();
    };
    image.src = url;
    imageCache.set(url, resource);
  }
  return resource.image;
}

function getCachedImageStatus(url: string, rerender: () => void): CachedImageResource['status'] {
  let resource = imageCache.get(url);
  if (!resource) {
    getCachedImage(url, rerender);
    resource = imageCache.get(url)!;
  }
  return resource.status;
}

export function canDrawLoadedImage(image: HTMLImageElement): boolean {
  return image.complete && image.naturalWidth > 0 && image.naturalHeight > 0;
}

export function createCanvasRenderRuntime<TAsset extends AssetRecordLike>(assets: TAsset[]): CanvasRenderRuntime<TAsset> {
  return {
    assetMap: new Map(assets.map((asset) => [asset.id, asset])),
    getImage: getCachedImage,
    getImageStatus: getCachedImageStatus,
  };
}
