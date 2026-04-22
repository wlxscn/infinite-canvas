import type {
  ProjectCreateRequest,
  ProjectCreateResponse,
  ProjectListResponse,
  ProjectLoadResponse,
  ProjectRenameRequest,
  ProjectRenameResponse,
  ProjectSaveRequest,
  ProjectSaveResponse,
} from '@infinite-canvas/shared/api';
import { getAgentChatApiUrl } from '../features/chat/api/chat-client';
import type { CanvasProject } from '../types/canvas';

export class RemoteProjectNotFoundError extends Error {
  constructor(projectId: string) {
    super(`Remote project not found: ${projectId}`);
    this.name = 'RemoteProjectNotFoundError';
  }
}

interface LoadRemoteProjectOptions {
  signal?: AbortSignal;
}

const inFlightProjectLoads = new Map<string, Promise<ProjectLoadResponse>>();

function getProjectsApiUrl(): string {
  const chatApiUrl = getAgentChatApiUrl();

  if (chatApiUrl.endsWith('/chat')) {
    return `${chatApiUrl.slice(0, -'/chat'.length)}/projects`;
  }

  return `${chatApiUrl.replace(/\/$/, '')}/projects`;
}

function getProjectApiUrl(projectId: string): string {
  const encodedProjectId = encodeURIComponent(projectId);
  return `${getProjectsApiUrl()}/${encodedProjectId}`;
}

async function getResponseError(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as { error?: string; message?: string };
    return payload.error ?? payload.message ?? `Project persistence failed: ${response.status}`;
  } catch {
    return `Project persistence failed: ${response.status}`;
  }
}

async function fetchRemoteProject(projectId: string, signal?: AbortSignal): Promise<ProjectLoadResponse> {
  const response = await fetch(getProjectApiUrl(projectId), {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
    signal,
  });

  if (response.status === 404) {
    throw new RemoteProjectNotFoundError(projectId);
  }

  if (!response.ok) {
    throw new Error(await getResponseError(response));
  }

  return response.json();
}

export function loadRemoteProject(projectId: string, options: LoadRemoteProjectOptions = {}): Promise<ProjectLoadResponse> {
  if (options.signal) {
    return fetchRemoteProject(projectId, options.signal);
  }

  const existing = inFlightProjectLoads.get(projectId);
  if (existing) {
    return existing;
  }

  const request = fetchRemoteProject(projectId).finally(() => {
    inFlightProjectLoads.delete(projectId);
  });
  inFlightProjectLoads.set(projectId, request);
  return request;
}

export async function saveRemoteProject(projectId: string, project: CanvasProject): Promise<ProjectSaveResponse> {
  const request: ProjectSaveRequest = {
    project,
  };
  const response = await fetch(getProjectApiUrl(projectId), {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(await getResponseError(response));
  }

  return response.json();
}

export async function loadRemoteProjectSummaries(): Promise<ProjectListResponse> {
  const response = await fetch(getProjectsApiUrl(), {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(await getResponseError(response));
  }

  return response.json();
}

export async function createRemoteProject(title?: string): Promise<ProjectCreateResponse> {
  const request: ProjectCreateRequest = {
    title,
  };
  const response = await fetch(getProjectsApiUrl(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(await getResponseError(response));
  }

  return response.json();
}

export async function renameRemoteProject(projectId: string, title: string): Promise<ProjectRenameResponse> {
  const request: ProjectRenameRequest = {
    title,
  };
  const response = await fetch(getProjectApiUrl(projectId), {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(await getResponseError(response));
  }

  return response.json();
}
