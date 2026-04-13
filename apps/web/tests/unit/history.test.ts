import { describe, expect, it } from 'vitest';
import { commitProject, createEmptyProject, createInitialStore, redo, undo } from '../../src/state/store';

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
});
