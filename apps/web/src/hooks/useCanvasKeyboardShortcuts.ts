import { useEffect, useRef } from 'react';

interface UseCanvasKeyboardShortcutsOptions {
  onSpacePressedChange: (isPressed: boolean) => void;
  onSave: () => void;
  onResetZoom: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onDeleteSelection: () => void;
  onExitContainer: () => void;
}

export function useCanvasKeyboardShortcuts({
  onSpacePressedChange,
  onSave,
  onResetZoom,
  onUndo,
  onRedo,
  onDeleteSelection,
  onExitContainer,
}: UseCanvasKeyboardShortcutsOptions) {
  const handlersRef = useRef({
    onSpacePressedChange,
    onSave,
    onResetZoom,
    onUndo,
    onRedo,
    onDeleteSelection,
    onExitContainer,
  });

  useEffect(() => {
    handlersRef.current = {
      onSpacePressedChange,
      onSave,
      onResetZoom,
      onUndo,
      onRedo,
      onDeleteSelection,
      onExitContainer,
    };
  }, [onDeleteSelection, onExitContainer, onRedo, onResetZoom, onSave, onSpacePressedChange, onUndo]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      const isMac = navigator.platform.toUpperCase().includes('MAC');
      const cmdOrCtrl = isMac ? event.metaKey : event.ctrlKey;

      if (event.code === 'Space') {
        handlersRef.current.onSpacePressedChange(true);
      }

      if (cmdOrCtrl && event.key.toLowerCase() === 's') {
        event.preventDefault();
        handlersRef.current.onSave();
        return;
      }

      if (cmdOrCtrl && event.key === '0') {
        event.preventDefault();
        handlersRef.current.onResetZoom();
        return;
      }

      if (cmdOrCtrl && event.key.toLowerCase() === 'z' && !event.shiftKey) {
        event.preventDefault();
        handlersRef.current.onUndo();
        return;
      }

      if ((cmdOrCtrl && event.shiftKey && event.key.toLowerCase() === 'z') || (cmdOrCtrl && event.key.toLowerCase() === 'y')) {
        event.preventDefault();
        handlersRef.current.onRedo();
        return;
      }

      if (event.key === 'Delete' || event.key === 'Backspace') {
        const activeElement = document.activeElement;
        if (activeElement instanceof HTMLInputElement || activeElement instanceof HTMLTextAreaElement) {
          return;
        }

        event.preventDefault();
        handlersRef.current.onDeleteSelection();
      }

      if (event.key === 'Escape') {
        handlersRef.current.onExitContainer();
      }
    }

    function handleKeyUp(event: KeyboardEvent): void {
      if (event.code === 'Space') {
        handlersRef.current.onSpacePressedChange(false);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);
}
