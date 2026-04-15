import { describe, expect, it } from 'vitest';
import { buildCanvasRulerModel, buildRulerAxisModel, chooseRulerMajorStep } from '../../src/hooks/useCanvasRulerModel';

describe('canvas ruler model', () => {
  it('chooses readable major steps across zoom levels', () => {
    expect(chooseRulerMajorStep(1)).toBe(100);
    expect(chooseRulerMajorStep(2)).toBe(50);
    expect(chooseRulerMajorStep(0.25)).toBe(500);
  });

  it('includes negative ruler labels when the origin moves into view', () => {
    const axis = buildRulerAxisModel({
      length: 240,
      scale: 1,
      translation: 150,
      rangeStart: null,
      rangeEnd: null,
    });

    expect(axis.majorTicks.some((tick) => tick.value === -100)).toBe(true);
    expect(axis.majorTicks.some((tick) => tick.value === 0)).toBe(true);
  });

  it('projects selected node bounds onto horizontal and vertical rulers', () => {
    const model = buildCanvasRulerModel({
      viewport: { tx: 20, ty: -10, scale: 1 },
      contentWidth: 400,
      contentHeight: 300,
      selectedNode: {
        id: 'node_rect_1',
        type: 'rect',
        x: 50,
        y: 40,
        w: 120,
        h: 80,
        stroke: '#111827',
      },
    });

    expect(model.horizontal.rangeProjection).toEqual({
      start: 70,
      size: 120,
    });
    expect(model.vertical.rangeProjection).toEqual({
      start: 30,
      size: 80,
    });
  });
});
