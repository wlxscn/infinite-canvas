import { useEffect, useRef, useState } from 'react';

interface TypewriterMessage {
  id: string;
  text: string;
}

const REVEAL_INTERVAL_MS = 22;

function getCharsPerStep(backlog: number): number {
  if (backlog > 160) {
    return 10;
  }

  if (backlog > 96) {
    return 7;
  }

  if (backlog > 48) {
    return 4;
  }

  if (backlog > 20) {
    return 2;
  }

  return 1;
}

export function useTypewriterText(message: TypewriterMessage | null): string {
  const incomingMessageId = message?.id ?? null;
  const incomingText = message?.text ?? '';
  const [displayState, setDisplayState] = useState<{ messageId: string | null; text: string }>({
    messageId: null,
    text: '',
  });
  const frameRef = useRef<number | null>(null);
  const lastRevealAtRef = useRef(0);
  const displayTextRef = useRef(displayState.text);
  const activeMessageIdRef = useRef<string | null>(displayState.messageId);

  useEffect(() => {
    displayTextRef.current = displayState.text;
    activeMessageIdRef.current = displayState.messageId;
  }, [displayState]);

  useEffect(() => {
    if (!incomingMessageId) {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
      return undefined;
    }

    const messageId = incomingMessageId;
    const targetText = incomingText;
    const currentText = activeMessageIdRef.current === messageId ? displayTextRef.current : '';

    if (!targetText.length || currentText === targetText) {
      return undefined;
    }

    let cancelled = false;

    const step = (timestamp: number) => {
      if (cancelled) {
        return;
      }

      const currentTextForMessage = activeMessageIdRef.current === messageId ? displayTextRef.current : '';
      const currentTargetText = targetText;
      const backlog = currentTargetText.length - currentTextForMessage.length;

      if (backlog <= 0) {
        frameRef.current = null;
        return;
      }

      if (lastRevealAtRef.current === 0) {
        lastRevealAtRef.current = timestamp;
      }

      if (timestamp - lastRevealAtRef.current >= REVEAL_INTERVAL_MS) {
        lastRevealAtRef.current = timestamp;
        const charsPerStep = getCharsPerStep(backlog);
        const nextText = currentTargetText.slice(0, currentTextForMessage.length + charsPerStep);
        displayTextRef.current = nextText;
        activeMessageIdRef.current = messageId;
        setDisplayState({
          messageId,
          text: nextText,
        });
      }

      frameRef.current = requestAnimationFrame(step);
    };

    frameRef.current = requestAnimationFrame(step);

    return () => {
      cancelled = true;
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [incomingMessageId, incomingText]);

  return displayState.messageId === incomingMessageId ? displayState.text : '';
}
