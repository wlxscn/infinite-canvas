import { createClient } from '@supabase/supabase-js';
import { getEnv } from '../config/env.mjs';

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

function assertProjectId(projectId) {
  if (typeof projectId !== 'string' || !PROJECT_ID_PATTERN.test(projectId)) {
    throw new ProjectPersistenceValidationError('Project id must be a UUID.');
  }
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
    project: row.data,
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
        .select('id, owner_id, data, created_at, updated_at')
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
        .select('id, owner_id, data, created_at, updated_at')
        .single();

      if (error) {
        throw new ProjectPersistenceStorageError('Failed to save project snapshot.', error);
      }

      return mapStoredProject(data);
    },
  };
}
