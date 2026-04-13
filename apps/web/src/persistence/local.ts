import { createEmptyProject } from '../state/store';
import type { CanvasProject, ChatSession, Point } from '../types/canvas';

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
    messages: Array.isArray(session.messages) ? session.messages : [],
    conversationId: typeof session.conversationId === 'string' ? session.conversationId : undefined,
    previousResponseId:
      typeof session.previousResponseId === 'string' || session.previousResponseId === null
        ? session.previousResponseId
        : null,
  };
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
