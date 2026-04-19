import { useEffect, useRef, useState } from 'react';
import { createDeferredProjectSaver } from '../persistence/local';
import {
  canExitActiveGroup,
  createGroupNode,
  bringNodeForward,
  commitProject,
  dissolveGroupNode,
  finalizeMutation,
  getNodeParentGroupId,
  moveNodeOutOfGroup,
  redo,
  removeNodeById,
  replaceProjectNoHistory,
  sendNodeBackward,
  setActiveGroupId,
  setSelectedId,
  undo,
  wrapNodeInNewGroup,
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
    onExitGroup: () => {
      setState((prev) => (prev.activeGroupId ? setActiveGroupId(setSelectedId(prev, null), null) : prev));
    },
  });

  function handleSelect(id: string | null): void {
    setState((prev) => setSelectedId(prev, id));
  }

  function handleEnterGroup(id: string | null): void {
    if (!id) {
      return;
    }

    setState((prev) => setActiveGroupId(setSelectedId(prev, null), id));
  }

  function handleExitGroup(): void {
    setState((prev) => (prev.activeGroupId ? setActiveGroupId(setSelectedId(prev, null), null) : prev));
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

  function createGroupAtViewportCenter(): void {
    setState((prev) => {
      const viewport = prev.project.board.viewport;
      const x = (-viewport.tx + 160) / viewport.scale;
      const y = (-viewport.ty + 120) / viewport.scale;
      const group = createGroupNode(x, y);
      const nextProject: CanvasProject = {
        ...prev.project,
        board: {
          ...prev.project.board,
          nodes: [...prev.project.board.nodes, group],
        },
      };
      return setSelectedId(commitProject(prev, nextProject), group.id);
    });
  }

  function groupSelection(): void {
    if (!state.selectedId) {
      return;
    }

    setState((prev) => {
      const nextNodes = wrapNodeInNewGroup(prev.project.board.nodes, prev.selectedId!);
      if (nextNodes === prev.project.board.nodes) {
        return prev;
      }
      const group = nextNodes[nextNodes.length - 1];
      const nextProject: CanvasProject = {
        ...prev.project,
        board: {
          ...prev.project.board,
          nodes: nextNodes,
        },
      };
      return setSelectedId(commitProject(prev, nextProject), group.id);
    });
  }

  function moveSelectionOutOfGroup(): void {
    if (!state.selectedId) {
      return;
    }

    setState((prev) => {
      const nextNodes = moveNodeOutOfGroup(prev.project.board.nodes, prev.selectedId!);
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
      return commitProject(setActiveGroupId(prev, prev.activeGroupId), nextProject);
    });
  }

  function dissolveSelectedGroup(): void {
    if (!state.selectedId) {
      return;
    }

    setState((prev) => {
      const nextNodes = dissolveGroupNode(prev.project.board.nodes, prev.selectedId!);
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
      return setActiveGroupId(setSelectedId(commitProject(prev, nextProject), null), null);
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

  const selectedParentGroupId = state.selectedId
    ? getNodeParentGroupId(state.project.board.nodes, state.selectedId)
    : null;

  return {
    isSpacePressed,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
    activeGroupId: state.activeGroupId,
    canExitGroup: canExitActiveGroup(state.project.board.nodes, state.activeGroupId),
    selectedParentGroupId,
    handleSelect,
    handleEnterGroup,
    handleExitGroup,
    handleCommitProject,
    handleReplaceProject,
    handleFinalizeMutation,
    nudgeLayer,
    createGroupAtViewportCenter,
    groupSelection,
    moveSelectionOutOfGroup,
    dissolveSelectedGroup,
    exportProjectJson,
  };
}
