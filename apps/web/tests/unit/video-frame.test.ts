import { afterEach, describe, expect, it, vi } from 'vitest';
import { captureVideoFrame } from '../../src/utils/videoFrame';

class FakeVideo extends EventTarget {
  muted = false;
  playsInline = false;
  preload = '';
  crossOrigin: string | null = null;
  src = '';
  currentSrc = '';
  duration = 1;
  networkState = 1;
  readyState = 4;
  videoWidth = 1280;
  videoHeight = 720;
  error: MediaError | null = null;
  private current = 0;
  private loaded = false;

  get currentTime(): number {
    return this.current;
  }

  set currentTime(value: number) {
    this.current = value;
    window.setTimeout(() => this.dispatchEvent(new Event('seeked')), 0);
  }

  load(): void {
    if (this.loaded) {
      return;
    }

    this.loaded = true;
    window.setTimeout(() => this.dispatchEvent(new Event('loadedmetadata')), 0);
  }

  removeAttribute(name: string): void {
    if (name === 'src') {
      this.src = '';
    }
  }
}

class FailingVideo extends FakeVideo {
  override load(): void {
    window.setTimeout(() => this.dispatchEvent(new Event('error')), 0);
  }
}

function mockCanvasElement() {
  return {
    width: 0,
    height: 0,
    getContext: vi.fn(() => ({ drawImage: vi.fn() })),
    toDataURL: vi.fn(() => 'data:image/jpeg;base64,frame'),
  };
}

describe('video frame capture', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('loads remote videos with anonymous cross-origin mode when capturing a frame', async () => {
    const video = new FakeVideo();
    const canvas = mockCanvasElement();
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      if (tagName === 'video') {
        return video as unknown as HTMLElement;
      }
      if (tagName === 'canvas') {
        return canvas as unknown as HTMLElement;
      }
      return document.createElement(tagName);
    });

    await expect(captureVideoFrame('https://media.example.com/generated/videos/clip.mp4')).resolves.toBe(
      'data:image/jpeg;base64,frame',
    );
    expect(video.crossOrigin).toBe('anonymous');
    expect(canvas.getContext).toHaveBeenCalledWith('2d');
    expect(canvas.toDataURL).toHaveBeenCalledWith('image/jpeg', 0.82);
  });

  it('keeps capture failures rejectable without changing remote cross-origin setup', async () => {
    const video = new FailingVideo();
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      if (tagName === 'video') {
        return video as unknown as HTMLElement;
      }
      if (tagName === 'canvas') {
        return mockCanvasElement() as unknown as HTMLElement;
      }
      return document.createElement(tagName);
    });

    await expect(captureVideoFrame('https://media.example.com/generated/videos/broken.mp4')).rejects.toThrow(
      'Video failed to load',
    );
    expect(video.crossOrigin).toBe('anonymous');
  });
});
