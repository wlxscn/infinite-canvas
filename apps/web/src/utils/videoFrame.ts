interface CaptureVideoFrameOptions {
  timeoutMs?: number;
  quality?: number;
}

function waitForVideoEvent(video: HTMLVideoElement, eventName: keyof HTMLVideoElementEventMap, timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error(`Timed out waiting for video ${eventName}`));
    }, timeoutMs);

    function cleanup(): void {
      window.clearTimeout(timeout);
      video.removeEventListener(eventName, handleEvent);
      video.removeEventListener('error', handleError);
    }

    function handleEvent(): void {
      cleanup();
      resolve();
    }

    function handleError(): void {
      cleanup();
      reject(new Error('Video failed to load'));
    }

    video.addEventListener(eventName, handleEvent, { once: true });
    video.addEventListener('error', handleError, { once: true });
  });
}

function getCaptureTime(video: HTMLVideoElement): number {
  if (!Number.isFinite(video.duration) || video.duration <= 0) {
    return 0.1;
  }

  return Math.min(Math.max(video.duration * 0.1, 0.1), Math.max(video.duration - 0.05, 0));
}

export async function captureVideoFrame(src: string, options: CaptureVideoFrameOptions = {}): Promise<string> {
  const timeoutMs = options.timeoutMs ?? 8000;
  const quality = options.quality ?? 0.82;
  const video = document.createElement('video');

  video.muted = true;
  video.playsInline = true;
  video.preload = 'metadata';
  if (!src.startsWith('data:') && !src.startsWith('blob:')) {
    video.crossOrigin = 'anonymous';
  }
  video.src = src;

  try {
    video.load();
    await waitForVideoEvent(video, 'loadedmetadata', timeoutMs);

    const captureTime = getCaptureTime(video);
    if (Math.abs(video.currentTime - captureTime) > 0.01) {
      video.currentTime = captureTime;
      await waitForVideoEvent(video, 'seeked', timeoutMs);
    } else if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      await waitForVideoEvent(video, 'loadeddata', timeoutMs);
    }

    const width = video.videoWidth || 1;
    const height = video.videoHeight || 1;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Canvas context is unavailable');
    }

    ctx.drawImage(video, 0, 0, width, height);
    return canvas.toDataURL('image/jpeg', quality);
  } finally {
    video.removeAttribute('src');
    video.load();
  }
}
