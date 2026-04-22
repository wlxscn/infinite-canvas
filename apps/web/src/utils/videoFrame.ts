interface CaptureVideoFrameOptions {
  timeoutMs?: number;
  quality?: number;
  debugLabel?: string;
}

function getVideoDebugState(video: HTMLVideoElement): Record<string, unknown> {
  return {
    currentSrc: video.currentSrc,
    crossOrigin: video.crossOrigin,
    currentTime: video.currentTime,
    duration: video.duration,
    networkState: video.networkState,
    readyState: video.readyState,
    videoWidth: video.videoWidth,
    videoHeight: video.videoHeight,
    errorCode: video.error?.code,
    errorMessage: video.error?.message,
  };
}

function waitForVideoEvent(
  video: HTMLVideoElement,
  eventName: keyof HTMLVideoElementEventMap,
  timeoutMs: number,
  debugLabel: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      cleanup();
      console.warn(`[video-frame] ${debugLabel}: timeout waiting for ${eventName}`, getVideoDebugState(video));
      reject(new Error(`Timed out waiting for video ${eventName}`));
    }, timeoutMs);

    function cleanup(): void {
      window.clearTimeout(timeout);
      video.removeEventListener(eventName, handleEvent);
      video.removeEventListener('error', handleError);
    }

    function handleEvent(): void {
      cleanup();
      console.debug(`[video-frame] ${debugLabel}: ${eventName}`, getVideoDebugState(video));
      resolve();
    }

    function handleError(): void {
      cleanup();
      console.warn(`[video-frame] ${debugLabel}: error while waiting for ${eventName}`, getVideoDebugState(video));
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
  const debugLabel = options.debugLabel ?? 'capture';
  const video = document.createElement('video');

  console.debug(`[video-frame] ${debugLabel}: start`, {
    srcLength: src.length,
    srcPrefix: src.slice(0, 96),
    timeoutMs,
    quality,
  });

  video.muted = true;
  video.playsInline = true;
  video.preload = 'metadata';
  if (!src.startsWith('data:') && !src.startsWith('blob:')) {
    video.crossOrigin = 'anonymous';
  }
  video.src = src;

  try {
    video.load();
    console.debug(`[video-frame] ${debugLabel}: load requested`, getVideoDebugState(video));
    await waitForVideoEvent(video, 'loadedmetadata', timeoutMs, debugLabel);

    const captureTime = getCaptureTime(video);
    console.debug(`[video-frame] ${debugLabel}: capture time resolved`, {
      captureTime,
      ...getVideoDebugState(video),
    });

    if (Math.abs(video.currentTime - captureTime) > 0.01) {
      video.currentTime = captureTime;
      console.debug(`[video-frame] ${debugLabel}: seek requested`, getVideoDebugState(video));
      await waitForVideoEvent(video, 'seeked', timeoutMs, debugLabel);
    } else if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      await waitForVideoEvent(video, 'loadeddata', timeoutMs, debugLabel);
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

    console.debug(`[video-frame] ${debugLabel}: drawing frame`, {
      width,
      height,
      ...getVideoDebugState(video),
    });
    ctx.drawImage(video, 0, 0, width, height);
    const frameSrc = canvas.toDataURL('image/jpeg', quality);
    console.debug(`[video-frame] ${debugLabel}: captured`, {
      frameSrcLength: frameSrc.length,
      frameSrcPrefix: frameSrc.slice(0, 32),
    });
    return frameSrc;
  } catch (error) {
    console.warn(`[video-frame] ${debugLabel}: failed`, {
      error,
      ...getVideoDebugState(video),
    });
    throw error;
  } finally {
    video.removeAttribute('src');
    video.load();
    console.debug(`[video-frame] ${debugLabel}: cleanup complete`);
  }
}
