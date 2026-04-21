import { createEmptyProject } from '../state/store';
import type { AgentEffect } from '@infinite-canvas/shared/tool-effects';
import type { CanvasNode, CanvasProject, ChatSession, Point } from '../types/canvas';

export const STORAGE_KEY = 'infinite-canvas:v2';
const LEGACY_STORAGE_KEY = 'infinite-canvas:v1';

interface LegacyRectShape {
  id: string;
  type: 'rect';
  x: number;
  y: number;
  w: number;
  h: number;
  stroke: string;
  fill?: string;
}

interface LegacyFreehandShape {
  id: string;
  type: 'freehand';
  points: Point[];
  stroke: string;
  width: number;
}

interface LegacyCanvasDoc {
  version: 1;
  viewport: {
    tx: number;
    ty: number;
    scale: number;
  };
  shapes: Array<LegacyRectShape | LegacyFreehandShape>;
}

function isLegacyDoc(value: unknown): value is LegacyCanvasDoc {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<LegacyCanvasDoc>;
  return candidate.version === 1 && Array.isArray(candidate.shapes) && !!candidate.viewport;
}

type LegacyChatState = {
  messages?: unknown[];
  conversationId?: string;
  previousResponseId?: string | null;
};

type PersistedProject = Omit<CanvasProject, 'chat'> & {
  chat?: {
    activeSessionId?: string | null;
    sessions?: ChatSession[];
  } & LegacyChatState;
};

function looksLikeProject(value: unknown): value is PersistedProject {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<CanvasProject>;
  return candidate.version === 2 && !!candidate.board && Array.isArray(candidate.assets) && Array.isArray(candidate.jobs);
}

function normalizeSession(session: Partial<ChatSession>): ChatSession {
  return {
    id: typeof session.id === 'string' ? session.id : crypto.randomUUID(),
    title: typeof session.title === 'string' && session.title.trim().length > 0 ? session.title : '新会话',
    createdAt: typeof session.createdAt === 'number' ? session.createdAt : Date.now(),
    updatedAt: typeof session.updatedAt === 'number' ? session.updatedAt : Date.now(),
    messages: Array.isArray(session.messages)
      ? session.messages.flatMap((message) => {
          if (!message || typeof message !== 'object') {
            return [];
          }

          const candidate = message as Partial<ChatSession['messages'][number]> & { effects?: AgentEffect[] };
          return [
            {
              id: typeof candidate.id === 'string' ? candidate.id : crypto.randomUUID(),
              role: candidate.role === 'assistant' ? 'assistant' : 'user',
              text: typeof candidate.text === 'string' ? candidate.text : '',
              createdAt: typeof candidate.createdAt === 'number' ? candidate.createdAt : Date.now(),
              suggestions: Array.isArray(candidate.suggestions) ? candidate.suggestions : [],
              effects: Array.isArray(candidate.effects) ? candidate.effects : [],
            },
          ];
        })
      : [],
    conversationId: typeof session.conversationId === 'string' ? session.conversationId : undefined,
    previousResponseId:
      typeof session.previousResponseId === 'string' || session.previousResponseId === null
        ? session.previousResponseId
        : null,
  };
}

function normalizeNodes(nodes: unknown): CanvasNode[] {
  if (!Array.isArray(nodes)) {
    return [];
  }

  return nodes.flatMap((node) => {
    if (!node || typeof node !== 'object') {
      return [];
    }

    const candidate = node as Record<string, unknown>;
    if (candidate.type === 'group') {
      return [
        {
          ...candidate,
          children: normalizeNodes(candidate.children),
        } as unknown as CanvasNode,
      ];
    }

    return [candidate as unknown as CanvasNode];
  });
}

function normalizeProject(value: PersistedProject): CanvasProject {
  const sessions =
    value.chat && Array.isArray(value.chat.sessions) ? value.chat.sessions.map((session) => normalizeSession(session)) : [];
  const activeSessionId =
    value.chat?.activeSessionId && sessions.some((session) => session.id === value.chat?.activeSessionId)
      ? value.chat.activeSessionId
      : null;

  return {
    ...value,
    board: {
      ...value.board,
      nodes: normalizeNodes(value.board?.nodes),
    },
    chat: {
      activeSessionId,
      sessions,
    },
  };
}

function migrateLegacyDoc(doc: LegacyCanvasDoc): CanvasProject {
  return {
    version: 2,
    board: {
      version: 2,
      viewport: doc.viewport,
      nodes: doc.shapes,
    },
    assets: [],
    jobs: [],
    chat: {
      activeSessionId: null,
      sessions: [],
    },
  };
}

export function loadProject(): CanvasProject {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (looksLikeProject(parsed)) {
        return normalizeProject(parsed);
      }
    }

    const legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacyRaw) {
      const parsed = JSON.parse(legacyRaw);
      if (isLegacyDoc(parsed)) {
        return migrateLegacyDoc(parsed);
      }
    }

    return createEmptyProject();
  } catch {
    return createEmptyProject();
  }
}

export function saveProject(project: CanvasProject): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
  } catch {
    // Ignore quota/security errors for local-first behavior.
  }
}

interface DeferredProjectSaverOptions {
  delayMs?: number;
  save?: (project: CanvasProject) => void;
  scheduleTimeout?: typeof globalThis.setTimeout;
  clearScheduledTimeout?: typeof globalThis.clearTimeout;
}

export function createDeferredProjectSaver(options: DeferredProjectSaverOptions = {}) {
  const {
    delayMs = 160,
    save = saveProject,
    scheduleTimeout = globalThis.setTimeout.bind(globalThis),
    clearScheduledTimeout = globalThis.clearTimeout.bind(globalThis),
  } = options;

  let timeoutId: ReturnType<typeof globalThis.setTimeout> | null = null;
  let pendingProject: CanvasProject | null = null;

  function clearTimer(): void {
    if (timeoutId !== null) {
      clearScheduledTimeout(timeoutId);
      timeoutId = null;
    }
  }

  return {
    schedule(project: CanvasProject): void {
      pendingProject = project;
      clearTimer();
      timeoutId = scheduleTimeout(() => {
        timeoutId = null;
        const projectToSave = pendingProject;
        pendingProject = null;
        if (projectToSave) {
          save(projectToSave);
        }
      }, delayMs);
    },
    flush(project?: CanvasProject): void {
      clearTimer();
      const projectToSave = project ?? pendingProject;
      pendingProject = null;
      if (projectToSave) {
        save(projectToSave);
      }
    },
    cancel(): void {
      clearTimer();
      pendingProject = null;
    },
  };
}
