import { useEffect, useRef, useState } from 'react';
import { transcribeChatAudio } from '../api/chat-client';

export type VoiceComposerStatus = 'idle' | 'recording' | 'transcribing';

interface UseVoiceComposerOptions {
  onTranscript: (text: string) => void;
  transcribeAudio?: typeof transcribeChatAudio;
}

const PREFERRED_RECORDING_MIME_TYPES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/mpeg'] as const;

function logVoiceComposer(event: string, payload: Record<string, unknown> = {}): void {
  console.log(`[web/voice-composer] ${event}`, payload);
}

function stopMediaStream(stream: MediaStream | null): void {
  stream?.getTracks().forEach((track) => track.stop());
}

function getStartRecordingErrorMessage(error: unknown): string {
  if (error instanceof DOMException && error.name === 'NotAllowedError') {
    return '麦克风权限被拒绝，请允许浏览器访问麦克风后重试。';
  }

  return error instanceof Error && error.message ? error.message : '无法开始录音，请稍后重试。';
}

function getTranscriptionErrorMessage(error: unknown): string {
  return error instanceof Error && error.message ? error.message : '录音转写失败，请稍后重试。';
}

export function getPreferredRecordingMimeType(): string {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') {
    return '';
  }

  return PREFERRED_RECORDING_MIME_TYPES.find((mimeType) => MediaRecorder.isTypeSupported(mimeType)) ?? '';
}

export function mergeTranscriptIntoDraft(currentDraft: string, transcript: string): string {
  const trimmedTranscript = transcript.trim();

  if (!trimmedTranscript) {
    return currentDraft;
  }

  const trimmedDraft = currentDraft.trim();
  if (!trimmedDraft) {
    return trimmedTranscript;
  }

  return `${trimmedDraft}\n${trimmedTranscript}`;
}

export function useVoiceComposer({ onTranscript, transcribeAudio = transcribeChatAudio }: UseVoiceComposerOptions) {
  const [status, setStatus] = useState<VoiceComposerStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const statusRef = useRef<VoiceComposerStatus>('idle');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const finalizeTimeoutRef = useRef<number | null>(null);
  const scheduledFinalizeDelayRef = useRef<number | null>(null);
  const finalizingRecorderRef = useRef<MediaRecorder | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (finalizeTimeoutRef.current !== null) {
        window.clearTimeout(finalizeTimeoutRef.current);
      }
      scheduledFinalizeDelayRef.current = null;
      stopMediaStream(mediaStreamRef.current);
      mediaRecorderRef.current = null;
      mediaStreamRef.current = null;
      chunksRef.current = [];
    };
  }, []);

  function scheduleFinalize(recorder: MediaRecorder, mimeType: string, delayMs: number): void {
    if (
      finalizeTimeoutRef.current !== null &&
      scheduledFinalizeDelayRef.current !== null &&
      scheduledFinalizeDelayRef.current <= delayMs
    ) {
      return;
    }

    if (finalizeTimeoutRef.current !== null) {
      window.clearTimeout(finalizeTimeoutRef.current);
    }

    scheduledFinalizeDelayRef.current = delayMs;
    logVoiceComposer('schedule-finalize', {
      delayMs,
      recorderState: recorder.state,
      mimeType,
      chunkCount: chunksRef.current.length,
    });
    finalizeTimeoutRef.current = window.setTimeout(() => {
      finalizeTimeoutRef.current = null;
      scheduledFinalizeDelayRef.current = null;
      void finalizeRecording(recorder, mimeType);
    }, delayMs);
  }

  async function finalizeRecording(recorder: MediaRecorder, mimeType: string): Promise<void> {
    if (finalizingRecorderRef.current === recorder) {
      logVoiceComposer('finalize-skipped-already-finalizing', {
        recorderState: recorder.state,
        mimeType,
      });
      return;
    }

    finalizingRecorderRef.current = recorder;
    if (finalizeTimeoutRef.current !== null) {
      window.clearTimeout(finalizeTimeoutRef.current);
      finalizeTimeoutRef.current = null;
    }
    scheduledFinalizeDelayRef.current = null;

    const audio = new Blob(chunksRef.current, { type: mimeType || 'audio/webm' });
    logVoiceComposer('finalize', {
      recorderState: recorder.state,
      mimeType: mimeType || 'audio/webm',
      chunkCount: chunksRef.current.length,
      audioSize: audio.size,
    });

    stopMediaStream(mediaStreamRef.current);
    mediaRecorderRef.current = null;
    mediaStreamRef.current = null;
    chunksRef.current = [];

    if (!isMountedRef.current) {
      logVoiceComposer('finalize-skipped-unmounted');
      return;
    }

    if (audio.size === 0) {
      logVoiceComposer('finalize-empty-audio');
      finalizingRecorderRef.current = null;
      statusRef.current = 'idle';
      setStatus('idle');
      setErrorMessage('未检测到录音内容，请重试。');
      return;
    }

    statusRef.current = 'transcribing';
    setStatus('transcribing');

    try {
      logVoiceComposer('transcribe-start', {
        mimeType: audio.type || mimeType || 'audio/webm',
        audioSize: audio.size,
      });
      const response = await transcribeAudio(audio);
      const transcript = response.text.trim();

      if (!transcript) {
        throw new Error('转写结果为空，请重试。');
      }

      onTranscript(transcript);
      logVoiceComposer('transcribe-success', {
        transcriptLength: transcript.length,
      });
      if (isMountedRef.current) {
        setErrorMessage(null);
      }
    } catch (error) {
      logVoiceComposer('transcribe-error', {
        message: error instanceof Error ? error.message : String(error),
      });
      if (isMountedRef.current) {
        setErrorMessage(getTranscriptionErrorMessage(error));
      }
    } finally {
      finalizingRecorderRef.current = null;
      if (isMountedRef.current) {
        statusRef.current = 'idle';
        setStatus('idle');
      }
    }
  }

  async function startRecording(): Promise<void> {
    if (statusRef.current !== 'idle') {
      return;
    }

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setErrorMessage('当前浏览器不支持录音输入。');
      return;
    }

    setErrorMessage(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = getPreferredRecordingMimeType();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      logVoiceComposer('recording-start', {
        mimeType: recorder.mimeType || mimeType || 'unknown',
      });

      chunksRef.current = [];
      mediaStreamRef.current = stream;
      mediaRecorderRef.current = recorder;

      recorder.addEventListener('dataavailable', (event) => {
        const data = (event as Event & { data?: Blob }).data;
        if (data && data.size > 0) {
          chunksRef.current.push(data);
        }
        logVoiceComposer('dataavailable', {
          recorderState: recorder.state,
          chunkSize: data?.size ?? 0,
          chunkCount: chunksRef.current.length,
        });

        // Some browsers flush the final chunk after the recorder is already inactive.
        if (recorder.state === 'inactive') {
          scheduleFinalize(recorder, recorder.mimeType || mimeType, 0);
        }
      });
      recorder.addEventListener('stop', () => {
        logVoiceComposer('recording-stop-event', {
          recorderState: recorder.state,
          chunkCount: chunksRef.current.length,
        });
        // Give trailing dataavailable events a short window to arrive before finalizing.
        scheduleFinalize(recorder, recorder.mimeType || mimeType, 200);
      });

      // Flush chunks during recording so stop does not depend on a single final dataavailable event.
      recorder.start(250);
      statusRef.current = 'recording';
      setStatus('recording');
    } catch (error) {
      logVoiceComposer('recording-start-error', {
        message: error instanceof Error ? error.message : String(error),
      });
      stopMediaStream(mediaStreamRef.current);
      mediaRecorderRef.current = null;
      mediaStreamRef.current = null;
      chunksRef.current = [];
      statusRef.current = 'idle';
      setStatus('idle');
      setErrorMessage(getStartRecordingErrorMessage(error));
    }
  }

  function stopRecording(): void {
    const recorder = mediaRecorderRef.current;
    if (!recorder || statusRef.current !== 'recording') {
      logVoiceComposer('recording-stop-ignored', {
        hasRecorder: Boolean(recorder),
        status: statusRef.current,
      });
      return;
    }

    logVoiceComposer('recording-stop-clicked', {
      recorderState: recorder.state,
      chunkCount: chunksRef.current.length,
    });
    statusRef.current = 'transcribing';
    setStatus('transcribing');

    if (recorder.state === 'inactive') {
      void finalizeRecording(recorder, recorder.mimeType);
      return;
    }

    recorder.requestData?.();
    recorder.stop();
    scheduleFinalize(recorder, recorder.mimeType, 2000);
  }

  async function toggleRecording(): Promise<void> {
    if (statusRef.current === 'recording') {
      stopRecording();
      return;
    }

    if (statusRef.current === 'transcribing') {
      return;
    }

    await startRecording();
  }

  return {
    status,
    errorMessage,
    toggleRecording,
  };
}
