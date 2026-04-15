import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getTranscriptionApiUrl, transcribeChatAudio } from '../../src/features/chat/api/chat-client';

describe('chat client transcription helpers', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('builds the transcription endpoint beside the chat endpoint', () => {
    expect(getTranscriptionApiUrl()).toBe('http://127.0.0.1:8787/transcribe');
  });

  it('uploads recorded audio as multipart form-data', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ text: '把主标题改成更有冲击力' }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const response = await transcribeChatAudio(new Blob(['voice-data'], { type: 'audio/webm' }));

    expect(response).toEqual({ text: '把主标题改成更有冲击力' });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://127.0.0.1:8787/transcribe');
    expect(init.method).toBe('POST');
    expect(init.body).toBeInstanceOf(FormData);

    const formData = init.body as FormData;
    const file = formData.get('audio');
    expect(file).toBeInstanceOf(File);
    expect((file as File).type).toBe('audio/webm');
  });

  it('surfaces backend validation errors', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: '不支持的音频格式' }), {
        status: 415,
        headers: {
          'Content-Type': 'application/json',
        },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(transcribeChatAudio(new Blob(['bad'], { type: 'audio/unknown' }))).rejects.toThrow('不支持的音频格式');
  });
});
