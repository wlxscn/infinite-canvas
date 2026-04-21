import { useEffect, useRef, useState } from 'react';
import { createDeferredProjectSaver } from '../persistence/local';
import {
  canExitActiveGroup,
  bringNodeForward,
  commitProject,
  createGroupNode,
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
  setSelectedIds,
  undo,
  wrapNodesInNewGroup,
} from '../state/store';
import { saveRemoteProject } from '../persistence/remote';
import { useCanvasKeyboardShortcuts } from './useCanvasKeyboardShortcuts';
import type { CanvasProject, CanvasStoreState } from '../types/canvas';

function triggerDownload(filename: string, href: string): void {
  const anchor = document.createElement('a');
  anchor.href = href;
  anchor.download = filename;
  anchor.click();
}

interface UseCanvasWorkspaceControllerOptions {
  projectId: string;
  remoteSaveEnabled: boolean;
  onRemoteSaveSuccess?: (projectId: string) => void;
  state: CanvasStoreState;
  setState: React.Dispatch<React.SetStateAction<CanvasStoreState>>;
}

export function useCanvasWorkspaceController({
  projectId,
  remoteSaveEnabled,
  onRemoteSaveSuccess,
  state,
  setState,
}: UseCanvasWorkspaceControllerOptions) {
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const latestProjectRef = useRef(state.project);
  const latestSelectedIdRef = useRef(state.selectedId);
  const latestSelectedIdsRef = useRef(state.selectedIds);
  const deferredSaveRef = useRef(createDeferredProjectSaver());
  const deferredRemoteSaveRef = useRef(
    createDeferredProjectSaver({
      delayMs: 500,
      save(project) {
        void saveRemoteProject(projectId, project)
          .then(() => {
            onRemoteSaveSuccess?.(projectId);
          })
          .catch((error) => {
            console.warn('[web/project-persistence] remote project save failed; local cache remains current', {
              projectId,
              error,
            });
          });
      },
    }),
  );

  useEffect(() => {
    latestProjectRef.current = state.project;
  }, [state.project]);

  useEffect(() => {
    latestSelectedIdRef.current = state.selectedId;
  }, [state.selectedId]);

  useEffect(() => {
    latestSelectedIdsRef.current = state.selectedIds;
  }, [state.selectedIds]);

  useEffect(() => {
    deferredSaveRef.current.schedule(state.project);
    if (remoteSaveEnabled) {
      deferredRemoteSaveRef.current.schedule(state.project);
    }
  }, [remoteSaveEnabled, state.project]);

  useEffect(
    () => () => {
      deferredSaveRef.current.cancel();
      deferredRemoteSaveRef.current.cancel();
    },
    [],
  );

  useCanvasKeyboardShortcuts({
    onSpacePressedChange: setIsSpacePressed,
    onSave: () => {
      deferredSaveRef.current.flush(latestProjectRef.current);
      if (remoteSaveEnabled) {
        deferredRemoteSaveRef.current.flush(latestProjectRef.current);
      }
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
      if (latestSelectedIdsRef.current.length === 0) {
        return;
      }

      setState((prev) => {
        if (prev.selectedIds.length === 0) {
          return prev;
        }

        const nextNodes = prev.selectedIds.reduce(
          (currentNodes, selectedId) => removeNodeById(currentNodes, selectedId),
          prev.project.board.nodes,
        );
        const nextProject: CanvasProject = {
          ...prev.project,
          board: {
            ...prev.project.board,
            nodes: nextNodes,
          },
        };
        const nextState = commitProject(prev, nextProject);
        return setSelectedIds(nextState, []);
      });
    },
    onExitGroup: () => {
      setState((prev) => (prev.activeGroupId ? setActiveGroupId(setSelectedIds(prev, []), null) : prev));
    },
  });

  function handleSelect(
    id: string | null,
    options?: { append?: boolean; toggle?: boolean; selectionIds?: string[]; primaryId?: string | null },
  ): void {
    setState((prev) => {
      if (options?.selectionIds) {
        const nextIds = options.append ? [...new Set([...prev.selectedIds, ...options.selectionIds])] : options.selectionIds;
        return setSelectedIds(prev, nextIds, options.primaryId ?? id ?? nextIds[nextIds.length - 1] ?? null);
      }

      if (!options?.append) {
        return setSelectedId(prev, id);
      }

      if (!id) {
        return prev;
      }

      const alreadySelected = prev.selectedIds.includes(id);
      if (alreadySelected && options.toggle) {
        const remainingIds = prev.selectedIds.filter((selectedId) => selectedId !== id);
        return setSelectedIds(prev, remainingIds, remainingIds[remainingIds.length - 1] ?? null);
      }

      if (alreadySelected) {
        return setSelectedIds(prev, prev.selectedIds, id);
      }

      return setSelectedIds(prev, [...prev.selectedIds, id], id);
    });
  }

  function handleEnterGroup(id: string | null): void {
    if (!id) {
      return;
    }

    setState((prev) => setActiveGroupId(setSelectedIds(prev, [], null), id));
  }

  function handleExitGroup(): void {
    setState((prev) => (prev.activeGroupId ? setActiveGroupId(setSelectedIds(prev, [], null), null) : prev));
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
    if (!state.selectedId || state.selectedIds.length !== 1) {
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
    const selectionIds = state.selectedIds.length > 0 ? state.selectedIds : (state.selectedId ? [state.selectedId] : []);
    if (selectionIds.length === 0) {
      return;
    }

    setState((prev) => {
      const nextNodes = wrapNodesInNewGroup(prev.project.board.nodes, selectionIds);
      if (nextNodes === prev.project.board.nodes) {
        return prev;
      }
      const group = nextNodes.find(
        (node) => node.type === 'group' && selectionIds.every((selectedId) => node.children.some((child) => child.id === selectedId)),
      );
      if (!group || group.type !== 'group') {
        return prev;
      }
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
      return setActiveGroupId(setSelectedIds(commitProject(prev, nextProject), [], null), null);
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
