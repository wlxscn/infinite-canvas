import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createProjectPersistenceService,
  ProjectPersistenceConfigError,
  ProjectPersistenceNotFoundError,
  ProjectPersistenceStorageError,
  ProjectPersistenceValidationError,
} from './project-persistence.service.mjs';

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';

function createProject(overrides = {}) {
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
    ...overrides,
  };
}

function createMockClient({ selectResult, upsertResult }) {
  const calls = [];
  const client = {
    calls,
    from(tableName) {
      calls.push(['from', tableName]);
      return {
        select(columns) {
          calls.push(['select', columns]);
          return {
            order(column, options) {
              calls.push(['order', column, options]);
              return Promise.resolve(selectResult);
            },
            eq(column, value) {
              calls.push(['eq', column, value]);
              return {
                async maybeSingle() {
                  calls.push(['maybeSingle']);
                  return selectResult;
                },
              };
            },
            async single() {
              calls.push(['single']);
              return upsertResult;
            },
          };
        },
        insert(payload) {
          calls.push(['insert', payload]);
          return {
            select(columns) {
              calls.push(['select', columns]);
              return {
                async single() {
                  calls.push(['single']);
                  return upsertResult;
                },
              };
            },
          };
        },
        upsert(payload, options) {
          calls.push(['upsert', payload, options]);
          return {
            select(columns) {
              calls.push(['select', columns]);
              return {
                async single() {
                  calls.push(['single']);
                  return upsertResult;
                },
              };
            },
          };
        },
        update(payload) {
          calls.push(['update', payload]);
          return {
            eq(column, value) {
              calls.push(['eq', column, value]);
              return {
                select(columns) {
                  calls.push(['select', columns]);
                  return {
                    async maybeSingle() {
                      calls.push(['maybeSingle']);
                      return selectResult;
                    },
                  };
                },
              };
            },
          };
        },
      };
    },
  };

  return client;
}

test('project persistence service loads a stored project snapshot', async () => {
  const project = createProject();
  const client = createMockClient({
    selectResult: {
      data: {
        id: PROJECT_ID,
        owner_id: null,
        title: '海报方案',
        data: project,
        created_at: '2026-04-21T00:00:00.000Z',
        updated_at: '2026-04-21T00:00:00.000Z',
      },
      error: null,
    },
  });
  const service = createProjectPersistenceService({
    env: { supabaseUrl: 'https://example.supabase.co', supabaseServiceRoleKey: 'service-key' },
    createSupabaseClient() {
      return client;
    },
  });

  const loaded = await service.getProject(PROJECT_ID);

  assert.equal(loaded.projectId, PROJECT_ID);
  assert.equal(loaded.title, '海报方案');
  assert.deepEqual(loaded.project, project);
  assert.deepEqual(client.calls.slice(0, 4), [
    ['from', 'projects'],
    ['select', 'id, owner_id, title, data, created_at, updated_at'],
    ['eq', 'id', PROJECT_ID],
    ['maybeSingle'],
  ]);
});

test('project persistence service saves a project snapshot with upsert', async () => {
  const project = createProject();
  const client = createMockClient({
    upsertResult: {
      data: {
        id: PROJECT_ID,
        owner_id: null,
        title: '未命名画布',
        data: project,
        created_at: '2026-04-21T00:00:00.000Z',
        updated_at: '2026-04-21T00:01:00.000Z',
      },
      error: null,
    },
  });
  const service = createProjectPersistenceService({
    env: { supabaseUrl: 'https://example.supabase.co', supabaseServiceRoleKey: 'service-key' },
    createSupabaseClient() {
      return client;
    },
  });

  const saved = await service.saveProject(PROJECT_ID, project);

  assert.equal(saved.projectId, PROJECT_ID);
  assert.equal(saved.title, '未命名画布');
  assert.deepEqual(saved.project, project);
  assert.deepEqual(client.calls[1], ['upsert', { id: PROJECT_ID, data: project }, { onConflict: 'id' }]);
});

test('project persistence service lists project summaries by updated time', async () => {
  const client = createMockClient({
    selectResult: {
      data: [
        {
          id: PROJECT_ID,
          owner_id: null,
          title: '最新画布',
          created_at: '2026-04-21T00:00:00.000Z',
          updated_at: '2026-04-21T00:05:00.000Z',
        },
      ],
      error: null,
    },
  });
  const service = createProjectPersistenceService({
    env: { supabaseUrl: 'https://example.supabase.co', supabaseServiceRoleKey: 'service-key' },
    createSupabaseClient() {
      return client;
    },
  });

  const list = await service.listProjects();

  assert.deepEqual(list.projects, [
    {
      projectId: PROJECT_ID,
      title: '最新画布',
      createdAt: '2026-04-21T00:00:00.000Z',
      updatedAt: '2026-04-21T00:05:00.000Z',
      ownerId: null,
    },
  ]);
  assert.deepEqual(client.calls.slice(0, 3), [
    ['from', 'projects'],
    ['select', 'id, owner_id, title, created_at, updated_at'],
    ['order', 'updated_at', { ascending: false }],
  ]);
});

test('project persistence service creates a titled empty project', async () => {
  const client = createMockClient({
    upsertResult: {
      data: {
        id: PROJECT_ID,
        owner_id: null,
        title: '新的画布',
        data: createProject(),
        created_at: '2026-04-21T00:00:00.000Z',
        updated_at: '2026-04-21T00:00:00.000Z',
      },
      error: null,
    },
  });
  const service = createProjectPersistenceService({
    env: { supabaseUrl: 'https://example.supabase.co', supabaseServiceRoleKey: 'service-key' },
    createSupabaseClient() {
      return client;
    },
  });

  const originalRandomUUID = crypto.randomUUID;
  crypto.randomUUID = () => PROJECT_ID;

  try {
    const created = await service.createProject({ title: '新的画布' });
    assert.equal(created.projectId, PROJECT_ID);
    assert.equal(created.title, '新的画布');
    assert.deepEqual(client.calls[1], [
      'insert',
      {
        id: PROJECT_ID,
        title: '新的画布',
        data: createProject(),
      },
    ]);
  } finally {
    crypto.randomUUID = originalRandomUUID;
  }
});

test('project persistence service renames project metadata without rewriting the snapshot', async () => {
  const client = createMockClient({
    selectResult: {
      data: {
        id: PROJECT_ID,
        owner_id: null,
        title: '重命名后的画布',
        created_at: '2026-04-21T00:00:00.000Z',
        updated_at: '2026-04-21T00:03:00.000Z',
      },
      error: null,
    },
  });
  const service = createProjectPersistenceService({
    env: { supabaseUrl: 'https://example.supabase.co', supabaseServiceRoleKey: 'service-key' },
    createSupabaseClient() {
      return client;
    },
  });

  const renamed = await service.renameProject(PROJECT_ID, '重命名后的画布');

  assert.equal(renamed.title, '重命名后的画布');
  assert.deepEqual(client.calls.slice(0, 5), [
    ['from', 'projects'],
    ['update', { title: '重命名后的画布' }],
    ['eq', 'id', PROJECT_ID],
    ['select', 'id, owner_id, title, created_at, updated_at'],
    ['maybeSingle'],
  ]);
});

test('project persistence service maps missing projects to not-found errors', async () => {
  const service = createProjectPersistenceService({
    env: { supabaseUrl: 'https://example.supabase.co', supabaseServiceRoleKey: 'service-key' },
    createSupabaseClient() {
      return createMockClient({
        selectResult: { data: null, error: null },
      });
    },
  });

  await assert.rejects(() => service.getProject(PROJECT_ID), ProjectPersistenceNotFoundError);
});

test('project persistence service reports missing Supabase configuration', async () => {
  const service = createProjectPersistenceService({
    env: { supabaseUrl: '', supabaseServiceRoleKey: '' },
  });

  await assert.rejects(() => service.getProject(PROJECT_ID), ProjectPersistenceConfigError);
});

test('project persistence service rejects invalid ids and invalid project snapshots', async () => {
  const service = createProjectPersistenceService({
    env: { supabaseUrl: 'https://example.supabase.co', supabaseServiceRoleKey: 'service-key' },
    createSupabaseClient() {
      throw new Error('client should not be created for invalid input');
    },
  });

  await assert.rejects(() => service.getProject('not-a-uuid'), ProjectPersistenceValidationError);
  await assert.rejects(() => service.saveProject(PROJECT_ID, { version: 1 }), ProjectPersistenceValidationError);
});

test('project persistence service maps Supabase errors to storage errors', async () => {
  const service = createProjectPersistenceService({
    env: { supabaseUrl: 'https://example.supabase.co', supabaseServiceRoleKey: 'service-key' },
    createSupabaseClient() {
      return createMockClient({
        selectResult: {
          data: null,
          error: { message: 'database unavailable' },
        },
      });
    },
  });

  await assert.rejects(() => service.getProject(PROJECT_ID), ProjectPersistenceStorageError);
});
