import { describe, expect, it } from 'vitest';
import { clampScale, screenToWorld, worldToScreen, zoomAtScreenPoint } from '../../src/geometry/transform';

describe('transform', () => {
  it('converts between world and screen coordinates', () => {
    const viewport = { tx: 120, ty: -80, scale: 2 };
    const world = { x: 10, y: 20 };

    const screen = worldToScreen(world, viewport);
    expect(screen).toEqual({ x: 140, y: -40 });
    expect(screenToWorld(screen, viewport)).toEqual(world);
  });

  it('keeps the anchor point stable while zooming', () => {
    const viewport = { tx: 30, ty: 40, scale: 1 };
    const anchorScreen = { x: 250, y: 180 };

    const worldBefore = screenToWorld(anchorScreen, viewport);
    const nextViewport = zoomAtScreenPoint(viewport, anchorScreen, 1.5);
    const screenAfter = worldToScreen(worldBefore, nextViewport);

    expect(screenAfter.x).toBeCloseTo(anchorScreen.x, 5);
    expect(screenAfter.y).toBeCloseTo(anchorScreen.y, 5);
  });

  it('clamps scale range', () => {
    expect(clampScale(0.001)).toBe(0.1);
    expect(clampScale(99)).toBe(8);
    expect(clampScale(2)).toBe(2);
  });
});
