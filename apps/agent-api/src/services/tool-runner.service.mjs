import { previewAddTextTool } from '../tools/add-text.tool.mjs';
import { previewChangeStyleTool } from '../tools/change-style.tool.mjs';
import { previewGenerateVariantTool } from '../tools/generate-variant.tool.mjs';

export function createToolRunnerService() {
  return {
    preview({ message, canvasContext }) {
      const lower = message.toLowerCase();

      if (lower.includes('文字') || lower.includes('文案') || lower.includes('标题') || lower.includes('title')) {
        return previewAddTextTool({ message, canvasContext });
      }

      if (lower.includes('风格') || lower.includes('style')) {
        return previewChangeStyleTool({ message, canvasContext });
      }

      return previewGenerateVariantTool({ message, canvasContext });
    },
  };
}
