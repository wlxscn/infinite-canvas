import { describe, expect, it } from 'vitest';
import { commitProject, createEmptyProject, createInitialStore, finalizeMutation, redo, replaceProjectNoHistory, switchProject, undo } from '../../src/state/store';

describe('history stack', () => {
  it('supports undo and redo for board nodes', () => {
    const base = createEmptyProject();
    let state = createInitialStore(base);

    const project1 = {
      ...base,
      board: {
        ...base.board,
        nodes: [
          {
            id: 'node_rect_1',
            type: 'rect' as const,
            x: 0,
            y: 0,
            w: 20,
            h: 20,
            stroke: '#000',
          },
        ],
      },
    };

    const project2 = {
      ...project1,
      board: {
        ...project1.board,
        nodes: [
          ...project1.board.nodes,
          {
            id: 'node_text_1',
            type: 'text' as const,
            x: 30,
            y: 10,
            w: 120,
            h: 60,
            text: 'Hello',
            color: '#111',
            fontSize: 18,
            fontFamily: 'sans-serif',
          },
        ],
      },
    };

    state = commitProject(state, project1);
    state = commitProject(state, project2);

    expect(state.project.board.nodes.length).toBe(2);

    state = undo(state);
    expect(state.project.board.nodes.length).toBe(1);

    state = undo(state);
    expect(state.project.board.nodes.length).toBe(0);

    state = redo(state);
    expect(state.project.board.nodes.length).toBe(1);

    state = redo(state);
    expect(state.project.board.nodes.length).toBe(2);
  });

  it('records a drag finalize as a single undoable mutation', () => {
    const base = createEmptyProject();
    const beforeProject = {
      ...base,
      board: {
        ...base.board,
        nodes: [
          {
            id: 'node_rect_1',
            type: 'rect' as const,
            x: 0,
            y: 0,
            w: 20,
            h: 20,
            stroke: '#000',
          },
        ],
      },
    };
    const afterProject = {
      ...beforeProject,
      board: {
        ...beforeProject.board,
        nodes: [
          {
            ...beforeProject.board.nodes[0],
            x: 120,
            y: 80,
          },
        ],
      },
    };

    let state = createInitialStore(beforeProject);
    state = replaceProjectNoHistory(state, afterProject);
    state = finalizeMutation(state, beforeProject, afterProject);

    expect(state.past).toHaveLength(1);
    expect(state.project.board.nodes[0].x).toBe(120);

    state = undo(state);
    expect(state.project.board.nodes[0].x).toBe(0);
    expect(state.future).toHaveLength(1);
  });

  it('resets transient editor state when switching projects', () => {
    const base = createEmptyProject();
    const nextProject = {
      ...base,
      board: {
        ...base.board,
        nodes: [
          {
            id: 'node_rect_1',
            type: 'rect' as const,
            x: 24,
            y: 18,
            w: 80,
            h: 40,
            stroke: '#000',
          },
        ],
      },
    };

    let state = createInitialStore(base);
    state = commitProject(state, nextProject);
    state = {
      ...state,
      selectedId: 'node_rect_1',
      selectedIds: ['node_rect_1'],
      activeGroupId: 'group_1',
    };

    state = switchProject(state, createEmptyProject());

    expect(state.selectedId).toBeNull();
    expect(state.selectedIds).toEqual([]);
    expect(state.activeGroupId).toBeNull();
    expect(state.past).toEqual([]);
    expect(state.future).toEqual([]);
  });
});
