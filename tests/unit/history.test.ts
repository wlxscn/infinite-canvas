import { describe, expect, it } from 'vitest';
import { commitDoc, createEmptyDoc, createInitialStore, redo, undo } from '../../src/state/store';

describe('history stack', () => {
  it('supports undo and redo', () => {
    const base = createEmptyDoc();
    let state = createInitialStore(base);

    const doc1 = {
      ...base,
      shapes: [
        {
          id: 'r1',
          type: 'rect' as const,
          x: 0,
          y: 0,
          w: 20,
          h: 20,
          stroke: '#000',
        },
      ],
    };

    const doc2 = {
      ...doc1,
      shapes: [
        ...doc1.shapes,
        {
          id: 'r2',
          type: 'rect' as const,
          x: 30,
          y: 10,
          w: 10,
          h: 12,
          stroke: '#111',
        },
      ],
    };

    state = commitDoc(state, doc1);
    state = commitDoc(state, doc2);

    expect(state.doc.shapes.length).toBe(2);

    state = undo(state);
    expect(state.doc.shapes.length).toBe(1);

    state = undo(state);
    expect(state.doc.shapes.length).toBe(0);

    state = redo(state);
    expect(state.doc.shapes.length).toBe(1);

    state = redo(state);
    expect(state.doc.shapes.length).toBe(2);
  });
});
