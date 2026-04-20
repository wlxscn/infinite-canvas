import type { ChatMessage, ChatSuggestion } from '@infinite-canvas/shared/chat';
import type { AgentEffect } from '@infinite-canvas/shared/tool-effects';
import type { AgentResponseData } from './mappers/chat-mapper';
import type { ChatSession, GenerationJob } from '../../types/canvas';

export type DerivedTaskIntent = 'generate-image' | 'generate-video' | 'add-text' | 'change-style' | 'chat' | 'unknown';

export type DerivedTaskStatus = 'idle' | 'thinking' | 'responding' | 'generating' | 'completed' | 'failed';

export interface DerivedTaskTimelineItem {
  id: string;
  label: string;
  status: 'done' | 'current' | 'pending' | 'failed';
}

export interface DerivedCurrentTask {
  title: string;
  summary: string;
  intent: DerivedTaskIntent;
  intentLabel: string;
  status: DerivedTaskStatus;
  statusLabel: string;
  latestUserMessage: ChatMessage | null;
  latestAssistantMessage: ChatMessage | null;
  latestEffectType: AgentEffect['type'] | null;
  latestJobId: string | null;
  timeline: DerivedTaskTimelineItem[];
  nextActions: ChatSuggestion[];
}

export interface DerivedSessionHistoryEntry {
  id: string;
  title: string;
  subtitle: string;
  isActive: boolean;
}

interface DeriveCurrentTaskOptions {
  activeSession: ChatSession | null;
  responseData: AgentResponseData | null;
  jobs: GenerationJob[];
  chatStatus: string;
  chatError: Error | null;
}

function getLatestMessageByRole(session: ChatSession, role: ChatMessage['role']): ChatMessage | null {
  for (let index = session.messages.length - 1; index >= 0; index -= 1) {
    const message = session.messages[index];
    if (message?.role === role) {
      return message;
    }
  }
  return null;
}

function getLatestEffect(responseData: AgentResponseData | null): AgentEffect | null {
  const latestEffect = responseData?.effects.findLast((effect) => effect.type !== 'noop');
  return latestEffect ?? null;
}

function deriveIntent(latestEffect: AgentEffect | null): DerivedTaskIntent {
  if (!latestEffect) {
    return 'unknown';
  }

  if (latestEffect.type === 'insert-image' || (latestEffect.type === 'start-generation' && (latestEffect.mediaType ?? 'image') === 'image')) {
    return 'generate-image';
  }

  if (latestEffect.type === 'insert-video' || (latestEffect.type === 'start-generation' && latestEffect.mediaType === 'video')) {
    return 'generate-video';
  }

  if (latestEffect.type === 'insert-text') {
    return 'add-text';
  }

  if (latestEffect.type === 'style-variation') {
    return latestEffect.mediaType === 'video' ? 'generate-video' : 'change-style';
  }

  return 'unknown';
}

function inferIntentFromMessages(latestUserMessage: ChatMessage | null, latestAssistantMessage: ChatMessage | null): DerivedTaskIntent {
  const combined = `${latestUserMessage?.text ?? ''} ${latestAssistantMessage?.text ?? ''}`.toLowerCase();
  if (!combined.trim()) {
    return 'unknown';
  }

  if (/(视频|动效|动画|motion|video)/.test(combined)) {
    return 'generate-video';
  }

  if (/(图片|图像|海报|生成|插画|视觉|poster|image)/.test(combined)) {
    return 'generate-image';
  }

  if (/(标题|文案|文本|文字|copy|text)/.test(combined)) {
    return 'add-text';
  }

  if (/(风格|配色|布局|版式|style|look)/.test(combined)) {
    return 'change-style';
  }

  return 'chat';
}

function getIntentLabel(intent: DerivedTaskIntent): string {
  switch (intent) {
    case 'generate-image':
      return '图片生成';
    case 'generate-video':
      return '视频生成';
    case 'add-text':
      return '文本编辑';
    case 'change-style':
      return '风格调整';
    case 'chat':
      return '对话问答';
    default:
      return '任务协作';
  }
}

function findMatchingJob(latestEffect: AgentEffect | null, jobs: GenerationJob[]): GenerationJob | null {
  if (!latestEffect) {
    return null;
  }

  const effectPrompt =
    latestEffect.type === 'insert-text' || latestEffect.type === 'noop'
      ? null
      : latestEffect.prompt;

  if (!effectPrompt) {
    return null;
  }

  const expectedMediaType =
    latestEffect.type === 'insert-video' ? 'video' : latestEffect.type === 'start-generation' || latestEffect.type === 'style-variation'
      ? (latestEffect.mediaType ?? 'image')
      : 'image';

  return (
    jobs
      .filter((job) => job.prompt === effectPrompt && (job.mediaType ?? 'image') === expectedMediaType)
      .sort((left, right) => right.updatedAt - left.updatedAt)[0] ?? null
  );
}

function deriveStatus({
  chatStatus,
  chatError,
  latestAssistantMessage,
  latestEffect,
  matchingJob,
}: {
  chatStatus: string;
  chatError: Error | null;
  latestAssistantMessage: ChatMessage | null;
  latestEffect: AgentEffect | null;
  matchingJob: GenerationJob | null;
}): DerivedTaskStatus {
  if (chatError || matchingJob?.status === 'failed' || chatStatus === 'error') {
    return 'failed';
  }

  if (matchingJob?.status === 'pending') {
    return 'generating';
  }

  if (chatStatus === 'submitted') {
    return 'thinking';
  }

  if (chatStatus === 'streaming') {
    return 'responding';
  }

  if (latestEffect || latestAssistantMessage) {
    return 'completed';
  }

  return 'idle';
}

function getStatusLabel(status: DerivedTaskStatus, matchingJob: GenerationJob | null): string {
  switch (status) {
    case 'thinking':
      return '理解任务中';
    case 'responding':
      return '生成说明中';
    case 'generating':
      return matchingJob?.mediaType === 'video' ? '生成视频中' : '生成图片中';
    case 'completed':
      return '已完成';
    case 'failed':
      return '执行失败';
    default:
      return '待开始';
  }
}

function buildSummary({
  intent,
  status,
  latestAssistantMessage,
  matchingJob,
  chatError,
}: {
  intent: DerivedTaskIntent;
  status: DerivedTaskStatus;
  latestAssistantMessage: ChatMessage | null;
  matchingJob: GenerationJob | null;
  chatError: Error | null;
}): string {
  if (status === 'failed') {
    return chatError?.message ?? matchingJob?.error ?? '任务执行失败，可以继续补充指令修正方向。';
  }

  if (status === 'generating' && matchingJob?.prompt) {
    return `正在根据当前方向执行生成：${matchingJob.prompt}`;
  }

  if (status === 'thinking') {
    return '已接收你的请求，正在判断下一步动作。';
  }

  if (status === 'responding') {
    return '正在生成说明和执行计划。';
  }

  if (latestAssistantMessage?.text.trim()) {
    return latestAssistantMessage.text.trim();
  }

  switch (intent) {
    case 'chat':
      return '这是一轮纯对话协作，不会直接修改画布。';
    case 'generate-image':
      return '将围绕当前主题推进新的图像方向。';
    case 'generate-video':
      return '将围绕当前主题推进动效或视频结果。';
    case 'add-text':
      return '将为当前画布补充或调整文字内容。';
    case 'change-style':
      return '将围绕现有内容做风格变化。';
    default:
      return '继续围绕当前任务推进设计协作。';
  }
}

function buildTimeline({
  intent,
  status,
  latestUserMessage,
  latestAssistantMessage,
  latestEffect,
  matchingJob,
}: {
  intent: DerivedTaskIntent;
  status: DerivedTaskStatus;
  latestUserMessage: ChatMessage | null;
  latestAssistantMessage: ChatMessage | null;
  latestEffect: AgentEffect | null;
  matchingJob: GenerationJob | null;
}): DerivedTaskTimelineItem[] {
  const receivedStatus: DerivedTaskTimelineItem['status'] = latestUserMessage ? 'done' : 'pending';
  const planningStatus: DerivedTaskTimelineItem['status'] =
    status === 'thinking'
      ? 'current'
      : latestAssistantMessage || latestEffect
        ? 'done'
        : 'pending';

  if (intent === 'chat') {
    return [
      { id: 'received', label: '已接收任务', status: receivedStatus },
      {
        id: 'reply',
        label: status === 'responding' ? '正在生成回答' : '已生成回答',
        status: status === 'responding' ? 'current' : latestAssistantMessage ? 'done' : 'pending',
      },
      {
        id: 'chat-only',
        label: '本轮仅对话，不修改画布',
        status: status === 'failed' ? 'failed' : latestAssistantMessage ? 'done' : status === 'responding' ? 'current' : 'pending',
      },
      {
        id: 'continue',
        label: status === 'failed' ? '等待补充指令' : '可继续追问或下达下一步指令',
        status: status === 'failed' ? 'failed' : latestAssistantMessage ? 'done' : 'pending',
      },
    ];
  }

  const actionLabel =
    intent === 'generate-video'
      ? '正在执行视频生成'
      : intent === 'generate-image'
        ? '正在执行图片生成'
        : intent === 'add-text'
          ? '正在执行文本调整'
          : '正在执行风格变化';

  const actionDoneLabel =
    intent === 'generate-video'
      ? '已完成视频生成'
      : intent === 'generate-image'
        ? '已完成图片生成'
        : intent === 'add-text'
          ? '已完成文本调整'
          : '已完成风格变化';

  const actionStatus: DerivedTaskTimelineItem['status'] =
    status === 'failed'
      ? 'failed'
      : status === 'generating' || status === 'responding'
        ? 'current'
        : matchingJob?.status === 'success' || latestEffect
          ? 'done'
          : 'pending';

  const resultLabel =
    latestEffect?.type === 'insert-image' || latestEffect?.type === 'insert-video' || latestEffect?.type === 'insert-text'
      ? '结果已应用到画布'
      : matchingJob?.status === 'success'
        ? '结果已写入素材区'
        : '等待结果落地';

  const resultStatus: DerivedTaskTimelineItem['status'] =
    status === 'failed'
      ? 'failed'
      : latestEffect?.type === 'insert-image' || latestEffect?.type === 'insert-video' || latestEffect?.type === 'insert-text'
        ? 'done'
        : matchingJob?.status === 'success'
          ? 'done'
          : status === 'generating'
            ? 'current'
            : 'pending';

  return [
    { id: 'received', label: '已接收任务', status: receivedStatus },
    {
      id: 'planned',
      label: latestAssistantMessage || latestEffect ? '已生成执行说明' : '正在判断执行方式',
      status: planningStatus,
    },
    {
      id: 'action',
      label: actionStatus === 'done' ? actionDoneLabel : actionLabel,
      status: actionStatus,
    },
    {
      id: 'result',
      label: resultLabel,
      status: resultStatus,
    },
  ];
}

export function deriveCurrentTask({
  activeSession,
  responseData,
  jobs,
  chatStatus,
  chatError,
}: DeriveCurrentTaskOptions): DerivedCurrentTask | null {
  if (!activeSession) {
    return null;
  }

  const latestUserMessage = getLatestMessageByRole(activeSession, 'user');
  const latestAssistantMessage = getLatestMessageByRole(activeSession, 'assistant');
  const latestEffect = getLatestEffect(responseData);
  const intent = latestEffect ? deriveIntent(latestEffect) : inferIntentFromMessages(latestUserMessage, latestAssistantMessage);
  const matchingJob = findMatchingJob(latestEffect, jobs);
  const status = deriveStatus({
    chatStatus,
    chatError,
    latestAssistantMessage,
    latestEffect,
    matchingJob,
  });
  const shouldPreferFreshSuggestions = chatStatus === 'submitted' || chatStatus === 'streaming' || !!responseData;
  const nextActions =
    shouldPreferFreshSuggestions
      ? (responseData?.suggestions ?? [])
      : (latestAssistantMessage?.suggestions ?? []);

  return {
    title: latestUserMessage?.text.trim().slice(0, 24) || activeSession.title,
    summary: buildSummary({
      intent,
      status,
      latestAssistantMessage,
      matchingJob,
      chatError,
    }),
    intent,
    intentLabel: getIntentLabel(intent),
    status,
    statusLabel: getStatusLabel(status, matchingJob),
    latestUserMessage,
    latestAssistantMessage,
    latestEffectType: latestEffect?.type ?? null,
    latestJobId: matchingJob?.id ?? null,
    timeline: buildTimeline({
      intent,
      status,
      latestUserMessage,
      latestAssistantMessage,
      latestEffect,
      matchingJob,
    }),
    nextActions,
  };
}

export function deriveSessionHistoryEntries(
  sessions: ChatSession[],
  activeSessionId: string | null,
): DerivedSessionHistoryEntry[] {
  return sessions
    .filter((session) => session.id !== activeSessionId)
    .sort((left, right) => right.updatedAt - left.updatedAt)
    .map((session) => {
      const latestMessage = session.messages[session.messages.length - 1];
      return {
        id: session.id,
        title: session.title,
        subtitle:
          latestMessage?.text?.trim().slice(0, 24) ||
          `${session.messages.length} 条消息`,
        isActive: false,
      };
    });
}
