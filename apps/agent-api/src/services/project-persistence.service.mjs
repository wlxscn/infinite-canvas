import { createClient } from '@supabase/supabase-js';
import { getEnv } from '../config/env.mjs';

export const DEFAULT_PROJECT_TITLE = '未命名画布';

export class ProjectPersistenceConfigError extends Error {
  constructor(message = 'Supabase project persistence is not configured.') {
    super(message);
    this.name = 'ProjectPersistenceConfigError';
    this.code = 'PROJECT_PERSISTENCE_NOT_CONFIGURED';
  }
}

export class ProjectPersistenceNotFoundError extends Error {
  constructor(projectId) {
    super(`Project not found: ${projectId}`);
    this.name = 'ProjectPersistenceNotFoundError';
    this.code = 'PROJECT_NOT_FOUND';
    this.projectId = projectId;
  }
}

export class ProjectPersistenceValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ProjectPersistenceValidationError';
    this.code = 'PROJECT_VALIDATION_FAILED';
  }
}

export class ProjectPersistenceStorageError extends Error {
  constructor(message, cause) {
    super(message);
    this.name = 'ProjectPersistenceStorageError';
    this.code = 'PROJECT_STORAGE_FAILED';
    this.cause = cause;
  }
}

const PROJECT_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_PROJECT_TITLE_LENGTH = 80;

function assertProjectId(projectId) {
  if (typeof projectId !== 'string' || !PROJECT_ID_PATTERN.test(projectId)) {
    throw new ProjectPersistenceValidationError('Project id must be a UUID.');
  }
}

function normalizeProjectTitle(title) {
  if (typeof title !== 'string') {
    return DEFAULT_PROJECT_TITLE;
  }

  const trimmed = title.trim();
  if (!trimmed) {
    return DEFAULT_PROJECT_TITLE;
  }

  return trimmed.slice(0, MAX_PROJECT_TITLE_LENGTH);
}

function assertProjectTitle(title) {
  if (typeof title !== 'string' || title.trim().length === 0) {
    throw new ProjectPersistenceValidationError('Project title must be a non-empty string.');
  }
}

function createEmptyProject() {
  return {
    version: 2,
    board: {
      version: 2,
      viewport: { tx: 0, ty: 0, scale: 1 },
      nodes: [],
    },
    assets: [],
    jobs: [],
    chat: {
      activeSessionId: null,
      sessions: [],
    },
  };
}

export function isValidCanvasProject(project) {
  return (
    !!project &&
    typeof project === 'object' &&
    project.version === 2 &&
    !!project.board &&
    typeof project.board === 'object' &&
    Array.isArray(project.assets) &&
    Array.isArray(project.jobs) &&
    !!project.chat &&
    typeof project.chat === 'object' &&
    Array.isArray(project.chat.sessions) &&
    (typeof project.chat.activeSessionId === 'string' || project.chat.activeSessionId === null)
  );
}

function assertProject(project) {
  if (!isValidCanvasProject(project)) {
    throw new ProjectPersistenceValidationError('Project payload must be a valid CanvasProject v2 snapshot.');
  }
}

function mapStoredProject(row) {
  return {
    projectId: row.id,
    title: normalizeProjectTitle(row.title),
    project: row.data,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ownerId: row.owner_id ?? null,
  };
}

function mapProjectSummary(row) {
  return {
    projectId: row.id,
    title: normalizeProjectTitle(row.title),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ownerId: row.owner_id ?? null,
  };
}

export function createProjectPersistenceService({
  env = getEnv(),
  createSupabaseClient = createClient,
  tableName = 'projects',
} = {}) {
  let client = null;

  function getClient() {
    if (!env.supabaseUrl || !env.supabaseServiceRoleKey) {
      throw new ProjectPersistenceConfigError();
    }

    client ??= createSupabaseClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    return client;
  }

  return {
    async getProject(projectId) {
      assertProjectId(projectId);

      const { data, error } = await getClient()
        .from(tableName)
        .select('id, owner_id, title, data, created_at, updated_at')
        .eq('id', projectId)
        .maybeSingle();

      if (error) {
        throw new ProjectPersistenceStorageError('Failed to load project snapshot.', error);
      }

      if (!data) {
        throw new ProjectPersistenceNotFoundError(projectId);
      }

      if (!isValidCanvasProject(data.data)) {
        throw new ProjectPersistenceStorageError('Stored project snapshot is invalid.');
      }

      return mapStoredProject(data);
    },

    async listProjects() {
      const { data, error } = await getClient()
        .from(tableName)
        .select('id, owner_id, title, created_at, updated_at')
        .order('updated_at', { ascending: false });

      if (error) {
        throw new ProjectPersistenceStorageError('Failed to list project summaries.', error);
      }

      return {
        projects: Array.isArray(data) ? data.map((row) => mapProjectSummary(row)) : [],
      };
    },

    async createProject({ title = DEFAULT_PROJECT_TITLE, project = createEmptyProject() } = {}) {
      assertProject(project);

      const projectId = crypto.randomUUID();
      const normalizedTitle = normalizeProjectTitle(title);
      const { data, error } = await getClient()
        .from(tableName)
        .insert({
          id: projectId,
          title: normalizedTitle,
          data: project,
        })
        .select('id, owner_id, title, data, created_at, updated_at')
        .single();

      if (error) {
        throw new ProjectPersistenceStorageError('Failed to create project.', error);
      }

      return mapStoredProject(data);
    },

    async saveProject(projectId, project) {
      assertProjectId(projectId);
      assertProject(project);

      const { data, error } = await getClient()
        .from(tableName)
        .upsert(
          {
            id: projectId,
            data: project,
          },
          { onConflict: 'id' },
        )
        .select('id, owner_id, title, data, created_at, updated_at')
        .single();

      if (error) {
        throw new ProjectPersistenceStorageError('Failed to save project snapshot.', error);
      }

      return mapStoredProject(data);
    },

    async renameProject(projectId, title) {
      assertProjectId(projectId);
      assertProjectTitle(title);

      const { data, error } = await getClient()
        .from(tableName)
        .update({ title: normalizeProjectTitle(title) })
        .eq('id', projectId)
        .select('id, owner_id, title, created_at, updated_at')
        .maybeSingle();

      if (error) {
        throw new ProjectPersistenceStorageError('Failed to update project metadata.', error);
      }

      if (!data) {
        throw new ProjectPersistenceNotFoundError(projectId);
      }

      return mapProjectSummary(data);
    },
  };
}
