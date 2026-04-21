import {
  createProjectPersistenceService,
  ProjectPersistenceConfigError,
  ProjectPersistenceNotFoundError,
  ProjectPersistenceStorageError,
  ProjectPersistenceValidationError,
} from '../services/project-persistence.service.mjs';

function writeJson(response, statusCode, payload) {
  response.writeHead(statusCode, { 'content-type': 'application/json' });
  response.end(JSON.stringify(payload));
}

function getErrorPayload(error) {
  if (error instanceof ProjectPersistenceConfigError) {
    return {
      statusCode: 503,
      body: {
        error: error.message,
        code: error.code,
      },
    };
  }

  if (error instanceof ProjectPersistenceNotFoundError) {
    return {
      statusCode: 404,
      body: {
        error: error.message,
        code: error.code,
      },
    };
  }

  if (error instanceof ProjectPersistenceValidationError) {
    return {
      statusCode: 400,
      body: {
        error: error.message,
        code: error.code,
      },
    };
  }

  if (error instanceof ProjectPersistenceStorageError) {
    return {
      statusCode: 502,
      body: {
        error: error.message,
        code: error.code,
      },
    };
  }

  return {
    statusCode: 500,
    body: {
      error: 'Unexpected project persistence error.',
      code: 'PROJECT_PERSISTENCE_FAILED',
    },
  };
}

async function readJsonBody(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }

  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

export function createProjectController({ projectPersistenceService = createProjectPersistenceService() } = {}) {
  return {
    async getProject(request, response, projectId) {
      try {
        const result = await projectPersistenceService.getProject(projectId);
        writeJson(response, 200, result);
      } catch (error) {
        const { statusCode, body } = getErrorPayload(error);
        writeJson(response, statusCode, body);
      }
    },

    async saveProject(request, response, projectId) {
      try {
        const body = await readJsonBody(request);
        const project = body.project ?? body;
        const result = await projectPersistenceService.saveProject(projectId, project);
        writeJson(response, 200, result);
      } catch (error) {
        const { statusCode, body } = getErrorPayload(error);
        writeJson(response, statusCode, body);
      }
    },
  };
}
