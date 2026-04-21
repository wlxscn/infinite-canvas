import { createProjectController } from '../controllers/project.controller.mjs';

const projectController = createProjectController();

export function matchProjectRoute(request) {
  if (!request.url) {
    return null;
  }

  const url = new URL(request.url, 'http://localhost');
  const match = /^\/projects\/([^/]+)$/.exec(url.pathname);
  if (!match) {
    return null;
  }

  return {
    projectId: decodeURIComponent(match[1]),
  };
}

export async function handleProjectRoute(request, response, projectId) {
  if (request.method === 'GET') {
    await projectController.getProject(request, response, projectId);
    return true;
  }

  if (request.method === 'PUT') {
    await projectController.saveProject(request, response, projectId);
    return true;
  }

  return false;
}
