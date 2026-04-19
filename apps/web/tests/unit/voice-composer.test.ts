import { renderHook, act, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mergeTranscriptIntoDraft, useVoiceComposer } from '../../src/features/chat/hooks/useVoiceComposer';

class MockMediaRecorder extends EventTarget {
  static isTypeSupported(mimeType: string) {
    return mimeType === 'audio/webm;codecs=opus' || mimeType === 'audio/webm';
  }

  readonly mimeType: string;
  state: RecordingState = 'inactive';

  constructor(_stream: MediaStream, options?: MediaRecorderOptions) {
    super();
    this.mimeType = options?.mimeType ?? 'audio/webm';
  }

  start() {
    this.state = 'recording';
  }

  requestData() {
    const chunkEvent = new Event('dataavailable');
    Object.defineProperty(chunkEvent, 'data', {
      configurable: true,
      value: new Blob(['voice-chunk'], { type: this.mimeType }),
    });
    this.dispatchEvent(chunkEvent);
  }

  stop() {
    this.state = 'inactive';
    this.requestData();
    this.dispatchEvent(new Event('stop'));
  }
}

class DelayedStopMediaRecorder extends EventTarget {
  static isTypeSupported(mimeType: string) {
    return mimeType === 'audio/webm;codecs=opus' || mimeType === 'audio/webm';
  }

  readonly mimeType: string;
  state: RecordingState = 'inactive';

  constructor(_stream: MediaStream, options?: MediaRecorderOptions) {
    super();
    this.mimeType = options?.mimeType ?? 'audio/webm';
  }

  start() {
    this.state = 'recording';
  }

  requestData() {
    window.setTimeout(() => {
      const chunkEvent = new Event('dataavailable');
      Object.defineProperty(chunkEvent, 'data', {
        configurable: true,
        value: new Blob(['voice-chunk'], { type: this.mimeType }),
      });
      this.dispatchEvent(chunkEvent);
    }, 0);
  }

  stop() {
    this.state = 'inactive';
    window.setTimeout(() => {
      this.requestData();
      this.dispatchEvent(new Event('stop'));
    }, 0);
  }
}

class SlowFlushMediaRecorder extends EventTarget {
  static isTypeSupported(mimeType: string) {
    return mimeType === 'audio/webm;codecs=opus' || mimeType === 'audio/webm';
  }

  readonly mimeType: string;
  state: RecordingState = 'inactive';

  constructor(_stream: MediaStream, options?: MediaRecorderOptions) {
    super();
    this.mimeType = options?.mimeType ?? 'audio/webm';
  }

  start() {
    this.state = 'recording';
  }

  requestData() {
    window.setTimeout(() => {
      const chunkEvent = new Event('dataavailable');
      Object.defineProperty(chunkEvent, 'data', {
        configurable: true,
        value: new Blob(['late-voice-chunk'], { type: this.mimeType }),
      });
      this.dispatchEvent(chunkEvent);
    }, 300);
  }

  stop() {
    this.state = 'inactive';
    window.setTimeout(() => {
      this.dispatchEvent(new Event('stop'));
    }, 350);
  }
}

class StopBeforeDataMediaRecorder extends EventTarget {
  static isTypeSupported(mimeType: string) {
    return mimeType === 'audio/webm;codecs=opus' || mimeType === 'audio/webm';
  }

  readonly mimeType: string;
  state: RecordingState = 'inactive';

  constructor(_stream: MediaStream, options?: MediaRecorderOptions) {
    super();
    this.mimeType = options?.mimeType ?? 'audio/webm';
  }

  start() {
    this.state = 'recording';
  }

  requestData() {
    window.setTimeout(() => {
      const chunkEvent = new Event('dataavailable');
      Object.defineProperty(chunkEvent, 'data', {
        configurable: true,
        value: new Blob(['post-stop-chunk'], { type: this.mimeType }),
      });
      this.dispatchEvent(chunkEvent);
    }, 250);
  }

  stop() {
    this.state = 'inactive';
    window.setTimeout(() => {
      this.dispatchEvent(new Event('stop'));
    }, 0);
  }
}

describe('useVoiceComposer', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal('MediaRecorder', MockMediaRecorder);
  });

  it('merges transcripts into the editable draft', () => {
    expect(mergeTranscriptIntoDraft('', '  调整标题层级  ')).toBe('调整标题层级');
    expect(mergeTranscriptIntoDraft('保留霓虹配色', '把主标题变大')).toBe('保留霓虹配色\n把主标题变大');
  });

  it('moves through recording and transcribing before returning a transcript draft', async () => {
    const trackStop = vi.fn();
    const getUserMedia = vi.fn().mockResolvedValue({
      getTracks: () => [{ stop: trackStop }],
    } satisfies Pick<MediaStream, 'getTracks'>);
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia },
    });

    let resolveTranscription: ((value: { text: string }) => void) | null = null;
    const onTranscript = vi.fn();
    const transcribeAudio = vi.fn().mockImplementation(
      () =>
        new Promise<{ text: string }>((resolve) => {
          resolveTranscription = resolve;
        }),
    );
    const { result } = renderHook(() => useVoiceComposer({ onTranscript, transcribeAudio }));

    await act(async () => {
      await result.current.toggleRecording();
    });

    expect(result.current.status).toBe('recording');
    expect(result.current.errorMessage).toBeNull();

    await act(async () => {
      await result.current.toggleRecording();
    });

    expect(result.current.status).toBe('transcribing');

    await act(async () => {
      resolveTranscription?.({ text: '把副标题再收紧一点' });
    });

    await waitFor(() => {
      expect(result.current.status).toBe('idle');
    });

    expect(transcribeAudio).toHaveBeenCalledTimes(1);
    expect(transcribeAudio.mock.calls[0]?.[0]).toBeInstanceOf(Blob);
    expect(onTranscript).toHaveBeenCalledWith('把副标题再收紧一点');
    expect(trackStop).toHaveBeenCalledTimes(1);
  });

  it('surfaces transcription failures without creating a transcript draft', async () => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: vi.fn().mockResolvedValue({
          getTracks: () => [{ stop: vi.fn() }],
        } satisfies Pick<MediaStream, 'getTracks'>),
      },
    });

    const onTranscript = vi.fn();
    const transcribeAudio = vi.fn().mockRejectedValue(new Error('服务端转写失败'));
    const { result } = renderHook(() => useVoiceComposer({ onTranscript, transcribeAudio }));

    await act(async () => {
      await result.current.toggleRecording();
    });

    await act(async () => {
      await result.current.toggleRecording();
    });

    await waitFor(() => {
      expect(result.current.status).toBe('idle');
    });

    expect(onTranscript).not.toHaveBeenCalled();
    expect(result.current.errorMessage).toBe('服务端转写失败');
  });

  it('switches to transcribing immediately after stop is clicked', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('MediaRecorder', DelayedStopMediaRecorder);

    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: vi.fn().mockResolvedValue({
          getTracks: () => [{ stop: vi.fn() }],
        } satisfies Pick<MediaStream, 'getTracks'>),
      },
    });

    const onTranscript = vi.fn();
    const transcribeAudio = vi.fn().mockResolvedValue({ text: '保留主视觉，收紧标题' });
    const { result } = renderHook(() => useVoiceComposer({ onTranscript, transcribeAudio }));

    await act(async () => {
      await result.current.toggleRecording();
    });

    expect(result.current.status).toBe('recording');

    await act(async () => {
      await result.current.toggleRecording();
    });

    expect(result.current.status).toBe('transcribing');

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(result.current.status).toBe('idle');

    expect(onTranscript).toHaveBeenCalledWith('保留主视觉，收紧标题');
    vi.useRealTimers();
  });

  it('waits for late audio chunks before sending transcription request', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('MediaRecorder', SlowFlushMediaRecorder);

    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: vi.fn().mockResolvedValue({
          getTracks: () => [{ stop: vi.fn() }],
        } satisfies Pick<MediaStream, 'getTracks'>),
      },
    });

    const onTranscript = vi.fn();
    const transcribeAudio = vi.fn().mockResolvedValue({ text: '延迟音频也已送出' });
    const { result } = renderHook(() => useVoiceComposer({ onTranscript, transcribeAudio }));

    await act(async () => {
      await result.current.toggleRecording();
    });

    await act(async () => {
      await result.current.toggleRecording();
    });

    expect(result.current.status).toBe('transcribing');
    expect(transcribeAudio).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });

    expect(transcribeAudio).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe('idle');

    expect(onTranscript).toHaveBeenCalledWith('延迟音频也已送出');
    vi.useRealTimers();
  });

  it('sends transcription even when the final chunk arrives after stop', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('MediaRecorder', StopBeforeDataMediaRecorder);

    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: vi.fn().mockResolvedValue({
          getTracks: () => [{ stop: vi.fn() }],
        } satisfies Pick<MediaStream, 'getTracks'>),
      },
    });

    const onTranscript = vi.fn();
    const transcribeAudio = vi.fn().mockResolvedValue({ text: 'stop 之后的音频块也已转写' });
    const { result } = renderHook(() => useVoiceComposer({ onTranscript, transcribeAudio }));

    await act(async () => {
      await result.current.toggleRecording();
    });

    await act(async () => {
      await result.current.toggleRecording();
    });

    expect(result.current.status).toBe('transcribing');
    expect(transcribeAudio).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    expect(transcribeAudio).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe('idle');
    expect(onTranscript).toHaveBeenCalledWith('stop 之后的音频块也已转写');
    vi.useRealTimers();
  });
});
