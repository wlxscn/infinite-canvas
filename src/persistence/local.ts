import type { CanvasDoc } from '../types/canvas';
import { createEmptyDoc } from '../state/store';

export const STORAGE_KEY = 'infinite-canvas:v1';

function isValidDoc(value: unknown): value is CanvasDoc {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<CanvasDoc>;
  return candidate.version === 1 && Array.isArray(candidate.shapes) && !!candidate.viewport;
}

export function loadDoc(): CanvasDoc {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return createEmptyDoc();
    }
    const parsed = JSON.parse(raw);
    return isValidDoc(parsed) ? parsed : createEmptyDoc();
  } catch {
    return createEmptyDoc();
  }
}

export function saveDoc(doc: CanvasDoc): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(doc));
  } catch {
    // Ignore quota/security errors for local-first behavior.
  }
}
