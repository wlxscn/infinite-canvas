import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../../src/App';
import { saveProject } from '../../src/persistence/local';
import { createProjectSummary, DEFAULT_PROJECT_TITLE, upsertRecentProjectSummary } from '../../src/persistence/project-management';
import { createEmptyProject } from '../../src/state/store';

const remoteMocks = vi.hoisted(() => {
  class RemoteProjectNotFoundError extends Error {}
  return {
    loadRemoteProject: vi.fn(),
    loadRemoteProjectSummaries: vi.fn(),
    createRemoteProject: vi.fn(),
    renameRemoteProject: vi.fn(),
    saveRemoteProject: vi.fn(),
    RemoteProjectNotFoundError,
  };
});

vi.mock('../../src/persistence/remote', () => remoteMocks);

vi.mock('../../src/canvas/CanvasStage', () => ({
  CanvasStage: () => <div data-testid="canvas-stage" />,
}));

vi.mock('../../src/components/AssetsPanel', () => ({
  AssetsPanel: () => <aside data-testid="assets-panel" />,
}));

vi.mock('../../src/components/FloatingFooter', () => ({
  FloatingFooter: () => <footer data-testid="floating-footer" />,
}));

vi.mock('../../src/components/SelectionToolbar', () => ({
  SelectionToolbar: () => <div data-testid="selection-toolbar" />,
}));

vi.mock('../../src/components/SidebarPeekToggle', () => ({
  SidebarPeekToggle: ({ onOpen }: { onOpen: () => void }) => (
    <button type="button" onClick={onOpen}>
      打开侧栏
    </button>
  ),
}));

vi.mock('../../src/components/ToolDock', () => ({
  ToolDock: () => <nav data-testid="tool-dock" />,
}));

vi.mock('../../src/components/WorkspaceHeader', () => ({
  WorkspaceHeader: ({
    projectTitle,
    projects,
    onCreateProject,
    onSwitchProject,
    onRenameProject,
  }: {
    projectTitle: string;
    projects: Array<{ projectId: string; title: string }>;
    onCreateProject: () => void;
    onSwitchProject: (projectId: string) => void;
    onRenameProject: (title: string) => void;
  }) => (
    <header data-testid="workspace-header">
      <span>{projectTitle}</span>
      <button type="button" onClick={onCreateProject}>
        新建画布
      </button>
      <button type="button" onClick={() => onRenameProject('重命名后的画布')}>
        重命名画布
      </button>
      {projects.map((project) => (
        <button key={project.projectId} type="button" onClick={() => onSwitchProject(project.projectId)}>
          {project.title}
        </button>
      ))}
    </header>
  ),
}));

vi.mock('../../src/hooks/usePreventBrowserZoom', () => ({
  usePreventBrowserZoom: () => undefined,
}));

vi.mock('../../src/hooks/useCanvasGenerationController', () => ({
  useCanvasGenerationController: () => ({
    handleUpload: vi.fn(),
    insertAsset: vi.fn(),
    applyAgentEffects: vi.fn(),
  }),
}));

vi.mock('../../src/hooks/useCanvasWorkspaceController', () => ({
  useCanvasWorkspaceController: () => ({
    isSpacePressed: false,
    canUndo: false,
    canRedo: false,
    activeGroupId: null,
    canExitGroup: false,
    selectedParentGroupId: null,
    handleSelect: vi.fn(),
    handleEnterGroup: vi.fn(),
    handleExitGroup: vi.fn(),
    handleCommitProject: vi.fn(),
    handleReplaceProject: vi.fn(),
    handleFinalizeMutation: vi.fn(),
    nudgeLayer: vi.fn(),
    createGroupAtViewportCenter: vi.fn(),
    groupSelection: vi.fn(),
    moveSelectionOutOfGroup: vi.fn(),
    dissolveSelectedGroup: vi.fn(),
    exportProjectJson: vi.fn(),
  }),
}));

vi.mock('../../src/hooks/useWorkspaceViewModel', () => ({
  useWorkspaceViewModel: () => ({
    statsText: {
      nodeCount: '0 nodes',
      scaleText: '100%',
      assetCount: '0 assets',
    },
    selectionToolbarStyle: null,
  }),
}));

vi.mock('../../src/features/chat/hooks/useChatSidebarController', () => ({
  useChatSidebarController: ({ project }: { project: ReturnType<typeof createEmptyProject> }) => {
    const activeSession = project.chat.sessions.find((session) => session.id === project.chat.activeSessionId) ?? null;
    return {
      activeSession,
      chatInput: '',
      setChatInput: vi.fn(),
      currentTask: null,
      streamingAssistantMessage: null,
      streamingEffects: [],
      sessionCount: project.chat.sessions.length,
      sessionHistory: [],
      voiceComposer: {
        status: 'idle',
        errorMessage: null,
        toggleRecording: vi.fn(),
      },
      composerStatusText: '',
      voiceButtonLabel: '录音',
      createAndActivateSession: vi.fn(),
      activateSession: vi.fn(),
      submitChatMessage: vi.fn(),
      handleSuggestion: vi.fn(),
    };
  },
}));

vi.mock('../../src/features/chat/components/AgentSidebar', () => ({
  AgentSidebar: ({ activeSession }: { activeSession: { title: string } | null }) => (
    <aside>{activeSession?.title ?? '无会话'}</aside>
  ),
}));

function createProjectWithSession(title: string) {
  const project = createEmptyProject();
  project.chat.activeSessionId = 'session_1';
  project.chat.sessions.push({
    id: 'session_1',
    title,
    createdAt: 1,
    updatedAt: 1,
    messages: [],
    conversationId: 'conv_1',
    previousResponseId: 'resp_1',
  });
  return project;
}

describe('App project hydration', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    vi.stubGlobal('prompt', vi.fn());
    remoteMocks.loadRemoteProjectSummaries.mockResolvedValue({ projects: [] });
    remoteMocks.createRemoteProject.mockResolvedValue({
      projectId: '33333333-3333-4333-8333-333333333333',
      title: DEFAULT_PROJECT_TITLE,
      project: createEmptyProject(),
    });
    remoteMocks.renameRemoteProject.mockResolvedValue({
      projectId: '33333333-3333-4333-8333-333333333333',
      title: '重命名后的画布',
    });
  });

  it('hydrates the editor from a backend project snapshot', async () => {
    remoteMocks.loadRemoteProject.mockResolvedValue({
      projectId: '11111111-1111-4111-8111-111111111111',
      title: '远端画布',
      project: createProjectWithSession('远端会话'),
    });

    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: '打开侧栏' }));
    expect(await screen.findByText('远端会话')).toBeTruthy();
  });

  it('keeps the local project when backend hydration fails', async () => {
    saveProject(createProjectWithSession('本地会话'));
    remoteMocks.loadRemoteProject.mockRejectedValue(new Error('network down'));

    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: '打开侧栏' }));
    expect(await screen.findByText('本地会话')).toBeTruthy();
  });

  it('creates a new project locally when remote creation fails', async () => {
    remoteMocks.loadRemoteProject.mockRejectedValue(new Error('network down'));
    remoteMocks.createRemoteProject.mockRejectedValue(new Error('create failed'));

    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: '新建画布' }));

    expect((await screen.findByTestId('workspace-header')).textContent).toContain(DEFAULT_PROJECT_TITLE);
  });

  it('switches to another locally known project', async () => {
    const firstProjectId = '11111111-1111-4111-8111-111111111111';
    const secondProjectId = '22222222-2222-4222-8222-222222222222';
    saveProject(createProjectWithSession('当前画布'), firstProjectId);
    saveProject(createProjectWithSession('第二画布'), secondProjectId);
    upsertRecentProjectSummary(createProjectSummary(firstProjectId, { title: '当前画布' }));
    upsertRecentProjectSummary(createProjectSummary(secondProjectId, { title: '第二画布' }));
    remoteMocks.loadRemoteProject.mockRejectedValue(new Error('network down'));

    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: '第二画布' }));
    fireEvent.click(screen.getByRole('button', { name: '打开侧栏' }));

    expect(await screen.findByText('第二画布', { selector: 'aside' })).toBeTruthy();
  });
});
