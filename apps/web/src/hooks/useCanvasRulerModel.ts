import { getCanvasNodeBounds, normalizeBounds, type CanvasNode, type Viewport } from '@infinite-canvas/canvas-engine';
import { useMemo } from 'react';

const DEFAULT_TARGET_MAJOR_SPACING = 88;
const BASE_STEPS = [1, 2, 5] as const;

export interface CanvasRulerTick {
  key: string;
  value: number;
  position: number;
  label: string;
}

export interface CanvasRulerRangeProjection {
  start: number;
  size: number;
}

export interface CanvasRulerAxisModel {
  majorStep: number;
  majorTicks: CanvasRulerTick[];
  minorTicks: CanvasRulerTick[];
  rangeProjection: CanvasRulerRangeProjection | null;
}

export interface CanvasRulerModel {
  horizontal: CanvasRulerAxisModel;
  vertical: CanvasRulerAxisModel;
}

export interface CanvasRulerInput {
  viewport: Viewport;
  contentWidth: number;
  contentHeight: number;
  selectedNode: CanvasNode | null;
}

function normalizeZero(value: number): number {
  return Object.is(value, -0) ? 0 : value;
}

function roundToPrecision(value: number, digits = 6): number {
  return Number(value.toFixed(digits));
}

function formatRulerLabel(value: number): string {
  const normalized = normalizeZero(value);
  if (Number.isInteger(normalized)) {
    return `${normalized}`;
  }

  if (Math.abs(normalized) >= 10) {
    return normalized.toFixed(1);
  }

  return normalized.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

export function chooseRulerMajorStep(scale: number, targetScreenSpacing = DEFAULT_TARGET_MAJOR_SPACING): number {
  const safeScale = Math.max(scale, 0.0001);
  const approximateWorldStep = targetScreenSpacing / safeScale;
  const exponent = Math.floor(Math.log10(Math.max(approximateWorldStep, 0.0001)));
  const candidates = new Set<number>();

  for (const power of [exponent - 1, exponent, exponent + 1]) {
    const magnitude = 10 ** power;
    for (const base of BASE_STEPS) {
      candidates.add(base * magnitude);
    }
  }

  let bestStep = 1;
  let bestScore = Number.POSITIVE_INFINITY;

  for (const candidate of candidates) {
    const score = Math.abs(candidate * safeScale - targetScreenSpacing);
    if (score < bestScore) {
      bestStep = candidate;
      bestScore = score;
    }
  }

  return bestStep;
}

function getMinorDivisions(majorStep: number): number {
  const exponent = Math.floor(Math.log10(Math.max(Math.abs(majorStep), 0.0001)));
  const normalized = majorStep / 10 ** exponent;

  if (normalized >= 5) {
    return 5;
  }

  if (normalized >= 2) {
    return 4;
  }

  return 5;
}

interface BuildAxisModelInput {
  length: number;
  scale: number;
  translation: number;
  rangeStart: number | null;
  rangeEnd: number | null;
}

export function buildRulerAxisModel({
  length,
  scale,
  translation,
  rangeStart,
  rangeEnd,
}: BuildAxisModelInput): CanvasRulerAxisModel {
  if (length <= 0) {
    return {
      majorStep: 1,
      majorTicks: [],
      minorTicks: [],
      rangeProjection: null,
    };
  }

  const majorStep = chooseRulerMajorStep(scale);
  const minorStep = majorStep / getMinorDivisions(majorStep);
  const worldStart = -translation / scale;
  const worldEnd = (length - translation) / scale;
  const majorTicks: CanvasRulerTick[] = [];
  const minorTicks: CanvasRulerTick[] = [];
  const firstMajorValue = Math.floor(worldStart / majorStep) * majorStep;
  const lastMajorValue = Math.ceil(worldEnd / majorStep) * majorStep;

  for (let value = firstMajorValue; value <= lastMajorValue + majorStep * 0.5; value += majorStep) {
    const normalizedValue = roundToPrecision(value);
    const position = normalizedValue * scale + translation;
    if (position < -majorStep * scale || position > length + majorStep * scale) {
      continue;
    }

    majorTicks.push({
      key: `major-${normalizedValue}`,
      value: normalizeZero(normalizedValue),
      position,
      label: formatRulerLabel(normalizedValue),
    });
  }

  const firstMinorValue = Math.floor(worldStart / minorStep) * minorStep;
  const lastMinorValue = Math.ceil(worldEnd / minorStep) * minorStep;

  for (let value = firstMinorValue; value <= lastMinorValue + minorStep * 0.5; value += minorStep) {
    const normalizedValue = roundToPrecision(value);
    const majorRatio = normalizedValue / majorStep;
    const isMajor = Math.abs(majorRatio - Math.round(majorRatio)) < 0.0001;
    if (isMajor) {
      continue;
    }

    const position = normalizedValue * scale + translation;
    if (position < -minorStep * scale || position > length + minorStep * scale) {
      continue;
    }

    minorTicks.push({
      key: `minor-${normalizedValue}`,
      value: normalizeZero(normalizedValue),
      position,
      label: '',
    });
  }

  let rangeProjection: CanvasRulerRangeProjection | null = null;
  if (rangeStart !== null && rangeEnd !== null) {
    const screenStart = rangeStart * scale + translation;
    const screenEnd = rangeEnd * scale + translation;
    const clampedStart = Math.max(0, Math.min(length, Math.min(screenStart, screenEnd)));
    const clampedEnd = Math.max(0, Math.min(length, Math.max(screenStart, screenEnd)));
    if (clampedEnd > clampedStart) {
      rangeProjection = {
        start: clampedStart,
        size: clampedEnd - clampedStart,
      };
    }
  }

  return {
    majorStep,
    majorTicks,
    minorTicks,
    rangeProjection,
  };
}

export function buildCanvasRulerModel({
  viewport,
  contentWidth,
  contentHeight,
  selectedNode,
}: CanvasRulerInput): CanvasRulerModel {
  const normalizedBounds = selectedNode ? normalizeBounds(getCanvasNodeBounds(selectedNode)) : null;

  return {
    horizontal: buildRulerAxisModel({
      length: contentWidth,
      scale: viewport.scale,
      translation: viewport.tx,
      rangeStart: normalizedBounds?.x ?? null,
      rangeEnd: normalizedBounds ? normalizedBounds.x + normalizedBounds.w : null,
    }),
    vertical: buildRulerAxisModel({
      length: contentHeight,
      scale: viewport.scale,
      translation: viewport.ty,
      rangeStart: normalizedBounds?.y ?? null,
      rangeEnd: normalizedBounds ? normalizedBounds.y + normalizedBounds.h : null,
    }),
  };
}

export function useCanvasRulerModel({
  viewport,
  contentWidth,
  contentHeight,
  selectedNode,
}: CanvasRulerInput): CanvasRulerModel {
  return useMemo(
    () =>
      buildCanvasRulerModel({
        viewport,
        contentWidth,
        contentHeight,
        selectedNode,
      }),
    [contentHeight, contentWidth, selectedNode, viewport],
  );
}
