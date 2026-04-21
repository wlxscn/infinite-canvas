import { previewAddTextTool } from '../tools/add-text.tool.mjs';
import { previewChangeStyleTool } from '../tools/change-style.tool.mjs';
import { previewGenerateVariantTool } from '../tools/generate-variant.tool.mjs';
import { previewGenerateVideoTool } from '../tools/generate-video.tool.mjs';
import { createMiniMaxService } from './minimax.service.mjs';
import { AGENT_EFFECT_TYPES } from '../../../../packages/shared/src/runtime.mjs';

const TEXT_KEYWORDS = ['文字', '文案', '标题', 'slogan', 'copy', 'headline', 'title', 'text'];
const STYLE_KEYWORDS = ['风格', '版式', '配色', 'style', 'layout', 'palette'];
const IMAGE_KEYWORDS = ['图片', '图像', '海报', '画面', '插画', '封面', '视觉', '生成图', 'image', 'poster', 'illustration'];
const VIDEO_KEYWORDS = ['视频', '动效', '动态', '动画', 'motion', 'video', 'clip', 'animation', 'animated', '动起来'];
const FOLLOW_UP_IMAGE_KEYWORDS = ['继续生成', '系列', '变体', '再来一张', '再生成', 'variants', 'variation', 'another'];

function includesAnyKeyword(text, keywords) {
  return keywords.some((keyword) => text.includes(keyword));
}

function parseToolArguments(rawArguments) {
  if (!rawArguments) {
    return {};
  }

  if (typeof rawArguments === 'object') {
    return rawArguments;
  }

  try {
    return JSON.parse(rawArguments);
  } catch {
    return {};
  }
}

const TOOL_DEFINITIONS = [
  {
    type: 'function',
    function: {
      name: 'add_text_to_canvas',
      description: 'Add title copy, tagline copy, or other short poster text to the current canvas.',
      parameters: {
        type: 'object',
        properties: {
          text: {
            type: 'string',
            description: 'The exact text that should be inserted onto the canvas.',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'generate_image_variant',
      description: 'Generate a new image, poster, or visual variant for the current canvas.',
      parameters: {
        type: 'object',
        properties: {
          prompt: {
            type: 'string',
            description: 'The image-generation prompt to use for the next visual output.',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'generate_video_variant',
      description: 'Generate a new motion video, animation, or cinematic clip for the current canvas.',
      parameters: {
        type: 'object',
        properties: {
          prompt: {
            type: 'string',
            description: 'The video-generation prompt to use for the next motion output.',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'change_canvas_style',
      description: 'Create a style refresh or visual direction change for the current canvas.',
      parameters: {
        type: 'object',
        properties: {
          prompt: {
            type: 'string',
            description: 'The prompt that should be used to regenerate the canvas in the new style.',
          },
          styleDirection: {
            type: 'string',
            description: 'A short description of the target style direction.',
          },
        },
      },
    },
  },
];

function previewFallback({ message, canvasContext }) {
  const lower = message.toLowerCase();

  if (includesAnyKeyword(lower, TEXT_KEYWORDS)) {
    return previewAddTextTool({ message, canvasContext });
  }

  if (includesAnyKeyword(lower, STYLE_KEYWORDS)) {
    return previewChangeStyleTool({ message, canvasContext });
  }

  if (includesAnyKeyword(lower, VIDEO_KEYWORDS)) {
    return previewGenerateVideoTool({ message, canvasContext });
  }

  if (includesAnyKeyword(lower, IMAGE_KEYWORDS) || includesAnyKeyword(lower, FOLLOW_UP_IMAGE_KEYWORDS)) {
    return previewGenerateVariantTool({ message, canvasContext });
  }

  return previewGenerateVariantTool({ message, canvasContext });
}

export function createToolRunnerService() {
  const minimaxService = createMiniMaxService();
  const toolHandlers = {
    add_text_to_canvas: previewAddTextTool,
    generate_image_variant: previewGenerateVariantTool,
    generate_video_variant: previewGenerateVideoTool,
    change_canvas_style: previewChangeStyleTool,
  };

  return {
    listTools() {
      return TOOL_DEFINITIONS;
    },
    async executeToolCall({ name, rawArguments, message, canvasContext }) {
      const handler = toolHandlers[name];
      if (!handler) {
        return previewFallback({ message, canvasContext });
      }

      return handler({
        message,
        canvasContext,
        args: parseToolArguments(rawArguments),
      });
    },
    async generateImageEffect({ prompt }) {
      const generated = await minimaxService.generateImage({ prompt });

      if (!generated) {
        return {
          type: AGENT_EFFECT_TYPES.NOOP,
        };
      }

      return {
        type: AGENT_EFFECT_TYPES.INSERT_IMAGE,
        prompt,
        imageUrl: generated.imageUrl,
        width: generated.width,
        height: generated.height,
        mimeType: 'image/jpeg',
      };
    },
    async generateVideoEffect({ prompt }) {
      const generated = await minimaxService.generateVideo({ prompt });

      if (!generated) {
        return {
          type: AGENT_EFFECT_TYPES.NOOP,
        };
      }

      return {
        type: AGENT_EFFECT_TYPES.INSERT_VIDEO,
        prompt,
        videoUrl: generated.videoUrl,
        width: generated.width,
        height: generated.height,
        posterUrl: generated.posterUrl ?? null,
        durationSeconds: generated.durationSeconds,
        requestId: generated.requestId ?? null,
        taskId: generated.taskId ?? null,
        fileId: generated.fileId ?? null,
        resolution: generated.resolution,
        mimeType: 'video/mp4',
      };
    },
  };
}
