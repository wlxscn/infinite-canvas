import { useEffect, useRef, useState } from 'react';
import { transcribeChatAudio } from '../api/chat-client';

export type VoiceComposerStatus = 'idle' | 'recording' | 'transcribing';

interface UseVoiceComposerOptions {
  onTranscript: (text: string) => void;
  transcribeAudio?: typeof transcribeChatAudio;
}

const PREFERRED_RECORDING_MIME_TYPES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/mpeg'] as const;

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
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const finalizeTimeoutRef = useRef<number | null>(null);
  const finalizingRecorderRef = useRef<MediaRecorder | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (finalizeTimeoutRef.current !== null) {
        window.clearTimeout(finalizeTimeoutRef.current);
      }
      stopMediaStream(mediaStreamRef.current);
      mediaRecorderRef.current = null;
      mediaStreamRef.current = null;
      chunksRef.current = [];
    };
  }, []);

  async function finalizeRecording(recorder: MediaRecorder, mimeType: string): Promise<void> {
    if (finalizingRecorderRef.current === recorder) {
      return;
    }

    finalizingRecorderRef.current = recorder;
    if (finalizeTimeoutRef.current !== null) {
      window.clearTimeout(finalizeTimeoutRef.current);
      finalizeTimeoutRef.current = null;
    }

    const audio = new Blob(chunksRef.current, { type: mimeType || 'audio/webm' });

    stopMediaStream(mediaStreamRef.current);
    mediaRecorderRef.current = null;
    mediaStreamRef.current = null;
    chunksRef.current = [];

    if (!isMountedRef.current) {
      return;
    }

    if (audio.size === 0) {
      finalizingRecorderRef.current = null;
      setStatus('idle');
      setErrorMessage('未检测到录音内容，请重试。');
      return;
    }

    setStatus('transcribing');

    try {
      const response = await transcribeAudio(audio);
      const transcript = response.text.trim();

      if (!transcript) {
        throw new Error('转写结果为空，请重试。');
      }

      onTranscript(transcript);
      if (isMountedRef.current) {
        setErrorMessage(null);
      }
    } catch (error) {
      if (isMountedRef.current) {
        setErrorMessage(getTranscriptionErrorMessage(error));
      }
    } finally {
      finalizingRecorderRef.current = null;
      if (isMountedRef.current) {
        setStatus('idle');
      }
    }
  }

  async function startRecording(): Promise<void> {
    if (status !== 'idle') {
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

      chunksRef.current = [];
      mediaStreamRef.current = stream;
      mediaRecorderRef.current = recorder;

      recorder.addEventListener('dataavailable', (event) => {
        const data = (event as Event & { data?: Blob }).data;
        if (data && data.size > 0) {
          chunksRef.current.push(data);
        }
      });
      recorder.addEventListener('stop', () => {
        void finalizeRecording(recorder, recorder.mimeType || mimeType);
      });

      recorder.start();
      setStatus('recording');
    } catch (error) {
      stopMediaStream(mediaStreamRef.current);
      mediaRecorderRef.current = null;
      mediaStreamRef.current = null;
      chunksRef.current = [];
      setStatus('idle');
      setErrorMessage(getStartRecordingErrorMessage(error));
    }
  }

  function stopRecording(): void {
    const recorder = mediaRecorderRef.current;
    if (!recorder || status !== 'recording') {
      return;
    }

    if (recorder.state === 'inactive') {
      void finalizeRecording(recorder, recorder.mimeType);
      return;
    }

    recorder.requestData?.();
    recorder.stop();
    finalizeTimeoutRef.current = window.setTimeout(() => {
      void finalizeRecording(recorder, recorder.mimeType);
    }, 150);
  }

  async function toggleRecording(): Promise<void> {
    if (status === 'recording') {
      stopRecording();
      return;
    }

    if (status === 'transcribing') {
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
