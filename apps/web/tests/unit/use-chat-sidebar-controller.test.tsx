import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import type { AgentChatRequest } from '@infinite-canvas/shared/api';
import { useChatSidebarController } from '../../src/features/chat/hooks/useChatSidebarController';
import { createEmptyProject, createInitialStore } from '../../src/state/store';
import type { CanvasStoreState } from '../../src/types/canvas';

const sendAgentMessageMock = vi.fn();

vi.mock('../../src/features/chat/hooks/useAgentChat', () => ({
  useAgentChat: () => ({
    sendAgentMessage: sendAgentMessageMock,
    streamingAssistantMessage: null,
    status: 'ready',
    error: null,
  }),
}));

vi.mock('../../src/features/chat/hooks/useVoiceComposer', () => ({
  mergeTranscriptIntoDraft: (draft: string, transcript: string) => `${draft}${transcript}`,
  useVoiceComposer: () => ({
    status: 'idle',
    errorMessage: null,
    toggleRecording: vi.fn(),
  }),
}));

describe('useChatSidebarController', () => {
  it('uses the stable backend project id when submitting chat requests', async () => {
    sendAgentMessageMock.mockResolvedValue(undefined);

    const projectId = '11111111-1111-4111-8111-111111111111';
    const { result } = renderHook(() => {
      const [state, setState] = useState<CanvasStoreState>(() => createInitialStore(createEmptyProject()));
      const controller = useChatSidebarController({
        projectId,
        project: state.project,
        selectedNode: null,
        setState,
        onApplyEffects: vi.fn(),
        buildCanvasContext: () => ({
          nodeCount: 0,
          assetCount: 0,
          selectedNode: null,
          latestPrompt: '',
        }),
      });

      return controller;
    });

    await act(async () => {
      await result.current.submitChatMessage('生成一张海报');
    });

    expect(sendAgentMessageMock).toHaveBeenCalledTimes(1);
    const [, request] = sendAgentMessageMock.mock.calls[0] as [string, AgentChatRequest, string];
    expect(request.projectId).toBe(projectId);
  });
});
