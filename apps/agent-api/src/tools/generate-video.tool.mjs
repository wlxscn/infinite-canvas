import { AGENT_EFFECT_TYPES } from '../../../../packages/shared/src/runtime.mjs';

const FOLLOW_UP_VIDEO_KEYWORDS = ['继续生成', '继续', '系列', '变体', '再来一条', '再来一个', '再生成', 'variants', 'variation', 'another'];

function includesAnyKeyword(text, keywords) {
  return keywords.some((keyword) => text.includes(keyword));
}

function isFollowUpVideoRequest(message) {
  const normalized = message.trim().toLowerCase();
  return includesAnyKeyword(normalized, FOLLOW_UP_VIDEO_KEYWORDS);
}

export function previewGenerateVideoTool({ message, canvasContext, args = {} }) {
  const trimmedMessage = message.trim();
  const requestedPrompt = typeof args.prompt === 'string' ? args.prompt.trim() : '';
  const shouldUseLatestPrompt = !trimmedMessage || isFollowUpVideoRequest(trimmedMessage);
  const prompt =
    requestedPrompt ||
    (shouldUseLatestPrompt && canvasContext?.latestPrompt
      ? `${canvasContext.latestPrompt} motion video with cinematic camera movement`
      : trimmedMessage || canvasContext?.latestPrompt || 'cinematic motion video');

  return {
    action: 'generate_video_variant',
    effects: [
      {
        type: AGENT_EFFECT_TYPES.START_GENERATION,
        prompt,
        mediaType: 'video',
      },
    ],
    toolResult: `Prepared a video generation request for the canvas. Prompt: ${prompt}`,
    suggestions: [],
  };
}
