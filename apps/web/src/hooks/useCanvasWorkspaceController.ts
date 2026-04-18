import { useEffect, useRef, useState } from 'react';
import { createDeferredProjectSaver } from '../persistence/local';
import {
  canExitActiveContainer,
  createContainerNode,
  bringNodeForward,
  commitProject,
  dissolveContainerNode,
  finalizeMutation,
  getNodeParentContainerId,
  moveNodeOutOfContainer,
  redo,
  removeNodeById,
  replaceProjectNoHistory,
  sendNodeBackward,
  setActiveContainerId,
  setSelectedId,
  undo,
  wrapNodeInNewContainer,
} from '../state/store';
import { useCanvasKeyboardShortcuts } from './useCanvasKeyboardShortcuts';
import type { CanvasProject, CanvasStoreState } from '../types/canvas';

function triggerDownload(filename: string, href: string): void {
  const anchor = document.createElement('a');
  anchor.href = href;
  anchor.download = filename;
  anchor.click();
}

interface UseCanvasWorkspaceControllerOptions {
  state: CanvasStoreState;
  setState: React.Dispatch<React.SetStateAction<CanvasStoreState>>;
}

export function useCanvasWorkspaceController({ state, setState }: UseCanvasWorkspaceControllerOptions) {
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const latestProjectRef = useRef(state.project);
  const latestSelectedIdRef = useRef(state.selectedId);
  const deferredSaveRef = useRef(createDeferredProjectSaver());

  useEffect(() => {
    latestProjectRef.current = state.project;
  }, [state.project]);

  useEffect(() => {
    latestSelectedIdRef.current = state.selectedId;
  }, [state.selectedId]);

  useEffect(() => {
    deferredSaveRef.current.schedule(state.project);
  }, [state.project]);

  useEffect(() => () => deferredSaveRef.current.cancel(), []);

  useCanvasKeyboardShortcuts({
    onSpacePressedChange: setIsSpacePressed,
    onSave: () => {
      deferredSaveRef.current.flush(latestProjectRef.current);
    },
    onResetZoom: () => {
      setState((prev) =>
        replaceProjectNoHistory(prev, {
          ...prev.project,
          board: {
            ...prev.project.board,
            viewport: { tx: 0, ty: 0, scale: 1 },
          },
        }),
      );
    },
    onUndo: () => {
      setState((prev) => undo(prev));
    },
    onRedo: () => {
      setState((prev) => redo(prev));
    },
    onDeleteSelection: () => {
      if (!latestSelectedIdRef.current) {
        return;
      }

      setState((prev) => {
        if (!prev.selectedId) {
          return prev;
        }

        const nextProject: CanvasProject = {
          ...prev.project,
          board: {
            ...prev.project.board,
            nodes: removeNodeById(prev.project.board.nodes, prev.selectedId),
          },
        };
        const nextState = commitProject(prev, nextProject);
        return setSelectedId(nextState, null);
      });
    },
    onExitContainer: () => {
      setState((prev) => (prev.activeContainerId ? setActiveContainerId(setSelectedId(prev, null), null) : prev));
    },
  });

  function handleSelect(id: string | null): void {
    setState((prev) => setSelectedId(prev, id));
  }

  function handleEnterContainer(id: string | null): void {
    if (!id) {
      return;
    }

    setState((prev) => setActiveContainerId(setSelectedId(prev, null), id));
  }

  function handleExitContainer(): void {
    setState((prev) => (prev.activeContainerId ? setActiveContainerId(setSelectedId(prev, null), null) : prev));
  }

  function handleCommitProject(project: CanvasProject): void {
    setState((prev) => commitProject(prev, project));
  }

  function handleReplaceProject(project: CanvasProject): void {
    setState((prev) => replaceProjectNoHistory(prev, project));
  }

  function handleFinalizeMutation(beforeProject: CanvasProject, afterProject: CanvasProject): void {
    setState((prev) => finalizeMutation(prev, beforeProject, afterProject));
  }

  function nudgeLayer(direction: 'forward' | 'backward'): void {
    if (!state.selectedId) {
      return;
    }

    setState((prev) =>
      commitProject(prev, {
        ...prev.project,
        board: {
          ...prev.project.board,
          nodes:
            direction === 'forward'
              ? bringNodeForward(prev.project.board.nodes, prev.selectedId!)
              : sendNodeBackward(prev.project.board.nodes, prev.selectedId!),
        },
      }),
    );
  }

  function createContainerAtViewportCenter(): void {
    setState((prev) => {
      const viewport = prev.project.board.viewport;
      const x = (-viewport.tx + 160) / viewport.scale;
      const y = (-viewport.ty + 120) / viewport.scale;
      const container = createContainerNode(x, y);
      const nextProject: CanvasProject = {
        ...prev.project,
        board: {
          ...prev.project.board,
          nodes: [...prev.project.board.nodes, container],
        },
      };
      return setSelectedId(commitProject(prev, nextProject), container.id);
    });
  }

  function wrapSelectionInContainer(): void {
    if (!state.selectedId) {
      return;
    }

    setState((prev) => {
      const nextNodes = wrapNodeInNewContainer(prev.project.board.nodes, prev.selectedId!);
      if (nextNodes === prev.project.board.nodes) {
        return prev;
      }
      const container = nextNodes[nextNodes.length - 1];
      const nextProject: CanvasProject = {
        ...prev.project,
        board: {
          ...prev.project.board,
          nodes: nextNodes,
        },
      };
      return setSelectedId(commitProject(prev, nextProject), container.id);
    });
  }

  function moveSelectionOutOfContainer(): void {
    if (!state.selectedId) {
      return;
    }

    setState((prev) => {
      const nextNodes = moveNodeOutOfContainer(prev.project.board.nodes, prev.selectedId!);
      if (nextNodes === prev.project.board.nodes) {
        return prev;
      }
      const nextProject: CanvasProject = {
        ...prev.project,
        board: {
          ...prev.project.board,
          nodes: nextNodes,
        },
      };
      return commitProject(setActiveContainerId(prev, prev.activeContainerId), nextProject);
    });
  }

  function dissolveSelectedContainer(): void {
    if (!state.selectedId) {
      return;
    }

    setState((prev) => {
      const nextNodes = dissolveContainerNode(prev.project.board.nodes, prev.selectedId!);
      if (nextNodes === prev.project.board.nodes) {
        return prev;
      }
      const nextProject: CanvasProject = {
        ...prev.project,
        board: {
          ...prev.project.board,
          nodes: nextNodes,
        },
      };
      return setActiveContainerId(setSelectedId(commitProject(prev, nextProject), null), null);
    });
  }

  function exportProjectJson(): void {
    const href = URL.createObjectURL(
      new Blob([JSON.stringify(state.project, null, 2)], {
        type: 'application/json',
      }),
    );
    triggerDownload('canvas-project.json', href);
    window.setTimeout(() => URL.revokeObjectURL(href), 0);
  }

  const selectedParentContainerId = state.selectedId
    ? getNodeParentContainerId(state.project.board.nodes, state.selectedId)
    : null;

  return {
    isSpacePressed,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
    activeContainerId: state.activeContainerId,
    canExitContainer: canExitActiveContainer(state.project.board.nodes, state.activeContainerId),
    selectedParentContainerId,
    handleSelect,
    handleEnterContainer,
    handleExitContainer,
    handleCommitProject,
    handleReplaceProject,
    handleFinalizeMutation,
    nudgeLayer,
    createContainerAtViewportCenter,
    wrapSelectionInContainer,
    moveSelectionOutOfContainer,
    dissolveSelectedContainer,
    exportProjectJson,
  };
}
