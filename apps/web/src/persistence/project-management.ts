import type { ProjectSummary } from '@infinite-canvas/shared/api';

export const DEFAULT_PROJECT_TITLE = '未命名画布';
export const RECENT_PROJECTS_STORAGE_KEY = 'infinite-canvas:recent-projects';

function normalizeTimestamp(value: string | undefined, fallback: string): string {
  return typeof value === 'string' && value.trim().length > 0 ? value : fallback;
}

export function normalizeProjectTitle(title: string | null | undefined): string {
  return typeof title === 'string' && title.trim().length > 0 ? title.trim().slice(0, 80) : DEFAULT_PROJECT_TITLE;
}

export function createProjectSummary(
  projectId: string,
  overrides: Partial<ProjectSummary> = {},
): ProjectSummary {
  const now = new Date().toISOString();

  return {
    projectId,
    title: normalizeProjectTitle(overrides.title),
    createdAt: normalizeTimestamp(overrides.createdAt, now),
    updatedAt: normalizeTimestamp(overrides.updatedAt, now),
    ownerId: overrides.ownerId ?? null,
    lastOpenedAt: normalizeTimestamp(overrides.lastOpenedAt, now),
  };
}

function compareSummaries(a: ProjectSummary, b: ProjectSummary): number {
  const aTime = Date.parse(a.lastOpenedAt ?? a.updatedAt ?? a.createdAt ?? '0');
  const bTime = Date.parse(b.lastOpenedAt ?? b.updatedAt ?? b.createdAt ?? '0');
  return bTime - aTime;
}

export function mergeProjectSummaries(...sources: Array<ProjectSummary[]>): ProjectSummary[] {
  const merged = new Map<string, ProjectSummary>();

  for (const source of sources) {
    for (const summary of source) {
      const existing = merged.get(summary.projectId);
      const normalized = createProjectSummary(summary.projectId, summary);
      if (!existing) {
        merged.set(summary.projectId, normalized);
        continue;
      }

      merged.set(summary.projectId, {
        ...existing,
        ...normalized,
        title: normalized.title || existing.title,
        createdAt: existing.createdAt ?? normalized.createdAt,
        updatedAt: normalized.updatedAt ?? existing.updatedAt,
        lastOpenedAt: normalized.lastOpenedAt ?? existing.lastOpenedAt,
      });
    }
  }

  return [...merged.values()].sort(compareSummaries);
}

export function loadRecentProjectSummaries(storage: Storage = localStorage): ProjectSummary[] {
  try {
    const raw = storage.getItem(RECENT_PROJECTS_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .flatMap((item) => {
        if (!item || typeof item !== 'object' || typeof (item as { projectId?: unknown }).projectId !== 'string') {
          return [];
        }

        const candidate = item as Partial<ProjectSummary> & { projectId: string };
        return [createProjectSummary(candidate.projectId, candidate)];
      })
      .sort(compareSummaries);
  } catch {
    return [];
  }
}

export function saveRecentProjectSummaries(projects: ProjectSummary[], storage: Storage = localStorage): void {
  try {
    storage.setItem(RECENT_PROJECTS_STORAGE_KEY, JSON.stringify(mergeProjectSummaries(projects)));
  } catch {
    // Ignore quota/security errors for local-first behavior.
  }
}

export function upsertRecentProjectSummary(summary: ProjectSummary, storage: Storage = localStorage): ProjectSummary[] {
  const nextProjects = mergeProjectSummaries(loadRecentProjectSummaries(storage), [summary]);
  saveRecentProjectSummaries(nextProjects, storage);
  return nextProjects;
}
