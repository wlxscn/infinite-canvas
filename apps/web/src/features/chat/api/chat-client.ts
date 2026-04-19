import type {
  ImageGenerationRequest,
  ImageGenerationResponse,
  VideoGenerationRequest,
  VideoGenerationResponse,
  GenerationMediaType,
} from '@infinite-canvas/shared/api';

export function getAgentChatApiUrl(): string {
  return import.meta.env.VITE_AGENT_API_URL ?? 'http://127.0.0.1:8787/chat';
}

function getSiblingApiUrl(pathname: string): string {
  const apiUrl = getAgentChatApiUrl();
  const normalizedPath = pathname.startsWith('/') ? pathname : `/${pathname}`;

  if (apiUrl.endsWith('/chat')) {
    return `${apiUrl.slice(0, -'/chat'.length)}${normalizedPath}`;
  }

  return `${apiUrl.replace(/\/$/, '')}${normalizedPath}`;
}

export function getGenerationApiUrl(mediaType: GenerationMediaType): string {
  return getSiblingApiUrl(mediaType === 'video' ? '/generate-video' : '/generate-image');
}

export function getTranscriptionApiUrl(): string {
  return getSiblingApiUrl('/transcribe');
}

export interface AudioTranscriptionResponse {
  text: string;
}

function getDefaultAudioFilename(mimeType: string): string {
  if (mimeType.includes('mp4')) {
    return 'chat-recording.mp4';
  }

  if (mimeType.includes('mpeg')) {
    return 'chat-recording.mp3';
  }

  if (mimeType.includes('ogg')) {
    return 'chat-recording.ogg';
  }

  return 'chat-recording.webm';
}

async function getErrorMessage(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as { error?: string; message?: string };
    if (payload.error?.trim()) {
      return payload.error;
    }
    if (payload.message?.trim()) {
      return payload.message;
    }
  } catch {
    // Ignore malformed error payloads and fall back to status text.
  }

  return `转写失败：${response.status}`;
}

export async function transcribeChatAudio(audio: Blob): Promise<AudioTranscriptionResponse> {
  const mimeType = audio.type || 'audio/webm';
  const url = getTranscriptionApiUrl();
  const formData = new FormData();
  const file = new File([audio], getDefaultAudioFilename(mimeType), { type: mimeType });

  formData.append('audio', file);
  console.log('[web/chat-client] transcribe-request', {
    url,
    mimeType,
    size: audio.size,
    filename: file.name,
  });

  const response = await fetch(url, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response));
  }

  return response.json();
}

export async function generateImage(request: ImageGenerationRequest): Promise<ImageGenerationResponse> {
  const response = await fetch(getGenerationApiUrl('image'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(`Failed to generate image: ${response.status}`);
  }

  return response.json();
}

export async function generateVideo(request: VideoGenerationRequest): Promise<VideoGenerationResponse> {
  const response = await fetch(getGenerationApiUrl('video'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(`Failed to generate video: ${response.status}`);
  }

  return response.json();
}
