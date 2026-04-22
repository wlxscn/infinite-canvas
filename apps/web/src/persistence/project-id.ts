export const PROJECT_ID_STORAGE_KEY = 'infinite-canvas:project-id';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function createProjectId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (char) =>
    (Number(char) ^ (Math.random() * 16) >> (Number(char) / 4)).toString(16),
  );
}

export function isValidProjectId(projectId: string | null | undefined): projectId is string {
  return typeof projectId === 'string' && UUID_PATTERN.test(projectId);
}

export function getProjectIdFromUrl(location: Location = window.location): string | null {
  try {
    const projectId = new URL(location.href).searchParams.get('projectId');
    return isValidProjectId(projectId) ? projectId : null;
  } catch {
    return null;
  }
}

export function setProjectIdInUrl(projectId: string, history: History = window.history, location: Location = window.location): void {
  if (!isValidProjectId(projectId)) {
    return;
  }

  const url = new URL(location.href);
  if (url.searchParams.get('projectId') === projectId) {
    return;
  }

  url.searchParams.set('projectId', projectId);
  history.replaceState(history.state, '', `${url.pathname}${url.search}${url.hash}`);
}

export function storeProjectId(projectId: string, storage: Storage = localStorage): void {
  if (!isValidProjectId(projectId)) {
    return;
  }

  try {
    storage.setItem(PROJECT_ID_STORAGE_KEY, projectId);
  } catch {
    // Ignore storage errors and continue with URL as the source of truth.
  }
}

export function resolveProjectId(storage: Storage = localStorage, location: Location = window.location): string {
  try {
    const urlProjectId = getProjectIdFromUrl(location);
    if (urlProjectId) {
      storeProjectId(urlProjectId, storage);
      return urlProjectId;
    }

    const stored = storage.getItem(PROJECT_ID_STORAGE_KEY);
    if (isValidProjectId(stored)) {
      return stored;
    }

    const projectId = createProjectId();
    storeProjectId(projectId, storage);
    return projectId;
  } catch {
    return createProjectId();
  }
}
