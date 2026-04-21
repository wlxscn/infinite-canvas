import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createProjectController } from './project.controller.mjs';
import {
  ProjectPersistenceConfigError,
  ProjectPersistenceNotFoundError,
  ProjectPersistenceStorageError,
  ProjectPersistenceValidationError,
} from '../services/project-persistence.service.mjs';

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';

function createProject() {
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

function createJsonRequest(body) {
  const payload = Buffer.from(JSON.stringify(body));
  return {
    headers: {},
    async *[Symbol.asyncIterator]() {
      yield payload;
    },
  };
}

function createMockResponse() {
  const response = new EventEmitter();
  response.statusCode = 200;
  response.headers = {};
  response.body = '';
  response.writeHead = function writeHead(statusCode, headers) {
    this.statusCode = statusCode;
    this.headers = headers;
  };
  response.end = function end(chunk = '') {
    this.body += Buffer.from(chunk).toString('utf8');
    this.emit('finish');
  };
  return response;
}

function parseBody(response) {
  return JSON.parse(response.body);
}

test('project controller returns stored project snapshots', async () => {
  const project = createProject();
  const controller = createProjectController({
    projectPersistenceService: {
      async getProject(projectId) {
        assert.equal(projectId, PROJECT_ID);
        return { projectId, project, updatedAt: '2026-04-21T00:00:00.000Z' };
      },
    },
  });
  const response = createMockResponse();

  await controller.getProject({}, response, PROJECT_ID);

  assert.equal(response.statusCode, 200);
  assert.deepEqual(parseBody(response), {
    projectId: PROJECT_ID,
    project,
    updatedAt: '2026-04-21T00:00:00.000Z',
  });
});

test('project controller saves project payloads', async () => {
  const project = createProject();
  const controller = createProjectController({
    projectPersistenceService: {
      async saveProject(projectId, payload) {
        assert.equal(projectId, PROJECT_ID);
        assert.deepEqual(payload, project);
        return { projectId, project: payload, updatedAt: '2026-04-21T00:01:00.000Z' };
      },
    },
  });
  const response = createMockResponse();

  await controller.saveProject(createJsonRequest({ project }), response, PROJECT_ID);

  assert.equal(response.statusCode, 200);
  assert.equal(parseBody(response).updatedAt, '2026-04-21T00:01:00.000Z');
});

test('project controller maps not-found errors to 404', async () => {
  const controller = createProjectController({
    projectPersistenceService: {
      async getProject() {
        throw new ProjectPersistenceNotFoundError(PROJECT_ID);
      },
    },
  });
  const response = createMockResponse();

  await controller.getProject({}, response, PROJECT_ID);

  assert.equal(response.statusCode, 404);
  assert.equal(parseBody(response).code, 'PROJECT_NOT_FOUND');
});

test('project controller maps validation errors to 400', async () => {
  const controller = createProjectController({
    projectPersistenceService: {
      async saveProject() {
        throw new ProjectPersistenceValidationError('invalid project');
      },
    },
  });
  const response = createMockResponse();

  await controller.saveProject(createJsonRequest({ project: { version: 1 } }), response, PROJECT_ID);

  assert.equal(response.statusCode, 400);
  assert.equal(parseBody(response).code, 'PROJECT_VALIDATION_FAILED');
});

test('project controller maps missing configuration to 503', async () => {
  const controller = createProjectController({
    projectPersistenceService: {
      async getProject() {
        throw new ProjectPersistenceConfigError();
      },
    },
  });
  const response = createMockResponse();

  await controller.getProject({}, response, PROJECT_ID);

  assert.equal(response.statusCode, 503);
  assert.equal(parseBody(response).code, 'PROJECT_PERSISTENCE_NOT_CONFIGURED');
});

test('project controller maps storage errors to 502', async () => {
  const controller = createProjectController({
    projectPersistenceService: {
      async getProject() {
        throw new ProjectPersistenceStorageError('Failed to load project snapshot.');
      },
    },
  });
  const response = createMockResponse();

  await controller.getProject({}, response, PROJECT_ID);

  assert.equal(response.statusCode, 502);
  assert.equal(parseBody(response).code, 'PROJECT_STORAGE_FAILED');
});
