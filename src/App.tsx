import { useEffect, useMemo, useRef, useState } from 'react';
import { CanvasStage } from './canvas/CanvasStage';
import { loadDoc, saveDoc } from './persistence/local';
import {
  commitDoc,
  createInitialStore,
  finalizeMutation,
  redo,
  removeShapeById,
  replaceDocNoHistory,
  setSelectedId,
  setTool,
  undo,
} from './state/store';
import type { CanvasDoc, CanvasStoreState, Tool } from './types/canvas';
import './index.css';

const TOOLS: Array<{ id: Tool; label: string }> = [
  { id: 'select', label: '选择' },
  { id: 'rect', label: '矩形' },
  { id: 'freehand', label: '自由线' },
  { id: 'pan', label: '平移' },
];

function App() {
  const [state, setState] = useState<CanvasStoreState>(() => createInitialStore(loadDoc()));
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const saveTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = window.setTimeout(() => {
      saveDoc(state.doc);
    }, 300);

    return () => {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
      }
    };
  }, [state.doc]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      const isMac = navigator.platform.toUpperCase().includes('MAC');
      const cmdOrCtrl = isMac ? event.metaKey : event.ctrlKey;

      if (event.code === 'Space') {
        setIsSpacePressed(true);
      }

      if (cmdOrCtrl && event.key.toLowerCase() === 's') {
        event.preventDefault();
        saveDoc(state.doc);
        return;
      }

      if (cmdOrCtrl && event.key === '0') {
        event.preventDefault();
        setState((prev) =>
          replaceDocNoHistory(prev, {
            ...prev.doc,
            viewport: {
              tx: 0,
              ty: 0,
              scale: 1,
            },
          }),
        );
        return;
      }

      if (cmdOrCtrl && event.key.toLowerCase() === 'z' && !event.shiftKey) {
        event.preventDefault();
        setState((prev) => undo(prev));
        return;
      }

      if ((cmdOrCtrl && event.shiftKey && event.key.toLowerCase() === 'z') || (cmdOrCtrl && event.key.toLowerCase() === 'y')) {
        event.preventDefault();
        setState((prev) => redo(prev));
        return;
      }

      if ((event.key === 'Delete' || event.key === 'Backspace') && state.selectedId) {
        event.preventDefault();
        setState((prev) => {
          if (!prev.selectedId) {
            return prev;
          }
          const nextDoc: CanvasDoc = {
            ...prev.doc,
            shapes: removeShapeById(prev.doc.shapes, prev.selectedId),
          };
          const nextState = commitDoc(prev, nextDoc);
          return setSelectedId(nextState, null);
        });
      }
    }

    function handleKeyUp(event: KeyboardEvent): void {
      if (event.code === 'Space') {
        setIsSpacePressed(false);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [state.doc, state.selectedId]);

  useEffect(() => {
    function preventBrowserZoomWithWheel(event: WheelEvent): void {
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault();
      }
    }

    function preventBrowserZoomHotkeys(event: KeyboardEvent): void {
      const isMac = navigator.platform.toUpperCase().includes('MAC');
      const cmdOrCtrl = isMac ? event.metaKey : event.ctrlKey;
      if (!cmdOrCtrl) {
        return;
      }

      if (event.key === '+' || event.key === '-' || event.key === '=' || event.key === '0') {
        event.preventDefault();
      }
    }

    function preventSafariGestureZoom(event: Event): void {
      event.preventDefault();
    }

    window.addEventListener('wheel', preventBrowserZoomWithWheel, { passive: false });
    window.addEventListener('keydown', preventBrowserZoomHotkeys);
    window.addEventListener('gesturestart', preventSafariGestureZoom, { passive: false });
    window.addEventListener('gesturechange', preventSafariGestureZoom, { passive: false });
    window.addEventListener('gestureend', preventSafariGestureZoom, { passive: false });

    return () => {
      window.removeEventListener('wheel', preventBrowserZoomWithWheel);
      window.removeEventListener('keydown', preventBrowserZoomHotkeys);
      window.removeEventListener('gesturestart', preventSafariGestureZoom);
      window.removeEventListener('gesturechange', preventSafariGestureZoom);
      window.removeEventListener('gestureend', preventSafariGestureZoom);
    };
  }, []);

  function handleSelect(id: string | null): void {
    setState((prev) => setSelectedId(prev, id));
  }

  function handleCommitDoc(doc: CanvasDoc): void {
    setState((prev) => commitDoc(prev, doc));
  }

  function handleReplaceDoc(doc: CanvasDoc): void {
    setState((prev) => replaceDocNoHistory(prev, doc));
  }

  function handleFinalizeMutation(beforeDoc: CanvasDoc, afterDoc: CanvasDoc): void {
    setState((prev) => finalizeMutation(prev, beforeDoc, afterDoc));
  }

  const canUndo = state.past.length > 0;
  const canRedo = state.future.length > 0;

  const shapeCountText = useMemo(() => `图元: ${state.doc.shapes.length}`, [state.doc.shapes.length]);

  return (
    <div className="app-shell">
      <header className="toolbar">
        <div className="toolbar-group">
          {TOOLS.map((item) => (
            <button
              key={item.id}
              className={state.tool === item.id ? 'btn active' : 'btn'}
              onClick={() => setState((prev) => setTool(prev, item.id))}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="toolbar-group">
          <button className="btn" type="button" disabled={!canUndo} onClick={() => setState((prev) => undo(prev))}>
            撤销
          </button>
          <button className="btn" type="button" disabled={!canRedo} onClick={() => setState((prev) => redo(prev))}>
            重做
          </button>
          <button
            className="btn"
            type="button"
            onClick={() =>
              setState((prev) =>
                replaceDocNoHistory(prev, {
                  ...prev.doc,
                  viewport: { tx: 0, ty: 0, scale: 1 },
                }),
              )
            }
          >
            复位视口
          </button>
          <button className="btn" type="button" onClick={() => saveDoc(state.doc)}>
            保存
          </button>
        </div>

        <div className="toolbar-meta">
          <span>{shapeCountText}</span>
          <span>{`缩放: ${(state.doc.viewport.scale * 100).toFixed(0)}%`}</span>
        </div>
      </header>

      <CanvasStage
        doc={state.doc}
        tool={state.tool}
        selectedId={state.selectedId}
        isSpacePressed={isSpacePressed}
        onSelect={handleSelect}
        onReplaceDoc={handleReplaceDoc}
        onCommitDoc={handleCommitDoc}
        onFinalizeMutation={handleFinalizeMutation}
      />
    </div>
  );
}

export default App;
