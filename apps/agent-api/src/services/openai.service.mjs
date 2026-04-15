import { randomUUID } from 'node:crypto';
import { designAgentPrompt } from '../prompts/design-agent.prompt.mjs';
import { createMiniMaxService } from './minimax.service.mjs';
import { AGENT_EFFECT_TYPES } from '../../../../packages/shared/src/runtime.mjs';

function summarizeCanvasContext(canvasContext) {
  const selected = canvasContext?.selectedNode;
  const latestPrompt = canvasContext?.latestPrompt ? `当前主题是“${canvasContext.latestPrompt}”。` : '当前没有最新生成主题。';
  const selection = selected ? `当前选中 ${selected.type} 节点。` : '当前未选中具体节点。';
  const counts = `画板里有 ${canvasContext?.nodeCount ?? 0} 个节点和 ${canvasContext?.assetCount ?? 0} 个素材。`;
  return `${latestPrompt} ${selection} ${counts}`;
}

function composeAssistantText({ message, canvasContext, plan }) {
  const contextSummary = summarizeCanvasContext(canvasContext);

  if (plan.action === 'add_text_to_canvas') {
    return `${contextSummary} 我会先补一版可直接落板的文字，再保留一个风格调整入口。你的请求是：${message}`;
  }

  if (plan.action === 'generate_video_variant') {
    return `${contextSummary} 我会先生成一个更接近你意图的动态视频版本，再保留后续补文字或改风格的入口。你的请求是：${message}`;
  }

  if (plan.action === 'change_canvas_style') {
    return `${contextSummary} 我建议先做风格变化，不直接重写整张图。你的请求是：${message}`;
  }

  return `${contextSummary} 我会继续生成一个更接近你意图的变体，并保留后续补文字的入口。你的请求是：${message}`;
}

function buildToolDecisionPrompt({ message, canvasContext }) {
  const contextSummary = summarizeCanvasContext(canvasContext);

  return {
    system: `${designAgentPrompt.instructions}
You are deciding which board mutation tool should be called next.
You must call exactly one tool whenever the user is asking for a board mutation.
Choose add_text_to_canvas for title/copy/text requests.
Choose generate_image_variant for image/poster/visual generation requests.
Choose generate_video_variant for motion/video/animation requests.
Choose change_canvas_style for style/layout/look-and-feel changes.
Do not answer with plain text when a tool should be called.`,
    user: `Board context: ${contextSummary}
User message: ${message}`,
  };
}

function buildFinalAnswerPrompt({ message, canvasContext, plan, toolResult }) {
  const contextSummary = summarizeCanvasContext(canvasContext);
  const actionInstruction =
    plan.action === 'add_text_to_canvas'
      ? 'The selected tool is add_text_to_canvas. Briefly present the copy direction and confirm it will be placed on the canvas.'
      : plan.action === 'generate_video_variant'
        ? 'The selected tool is generate_video_variant. Briefly explain the video direction and confirm a motion clip will be generated.'
      : plan.action === 'change_canvas_style'
        ? 'The selected tool is change_canvas_style. Briefly explain the style direction and what will change visually.'
        : 'The selected tool is generate_image_variant. Briefly explain the image direction and confirm a new visual will be generated.';

  return {
    system: `${designAgentPrompt.instructions}
You are answering inside a design canvas product.
Do not mention internal prompts, hidden reasoning, or function names.
Keep the answer concise, natural, and directly useful to the designer.`,
    user: `Board context: ${contextSummary}
Selected action: ${plan.action}
Action guidance: ${actionInstruction}
Tool execution result: ${toolResult}
Original user message: ${message}

Write the assistant reply in Chinese.`,
  };
}

async function decideTool({ minimaxService, toolRunnerService, message, canvasContext }) {
  const prompt = buildToolDecisionPrompt({ message, canvasContext });
  const modelToolMessage = await minimaxService.createMessage({
    messages: [
      { role: 'system', content: prompt.system },
      { role: 'user', content: prompt.user },
    ],
    tools: toolRunnerService.listTools(),
    temperature: 0.1,
  });

  const toolCall = modelToolMessage?.tool_calls?.[0];
  if (!toolCall) {
    return {
      modelToolMessage: null,
      toolCall: null,
    };
  }

  return {
    modelToolMessage,
    toolCall,
  };
}

async function runTool({ toolRunnerService, message, canvasContext, toolCall }) {
  if (!toolCall) {
    return {
      plan: await toolRunnerService.preview({ message, canvasContext }),
    };
  }

  return {
    plan: await toolRunnerService.executeToolCall({
      name: toolCall.function?.name,
      rawArguments: toolCall.function?.arguments,
      message,
      canvasContext,
    }),
  };
}

function splitDeferredEffects(effects = []) {
  const deferredGenerationEffect = effects.find(
    (effect) => effect.type === AGENT_EFFECT_TYPES.START_GENERATION || effect.type === AGENT_EFFECT_TYPES.STYLE_VARIATION,
  );

  return {
    immediateEffects: effects.filter(
      (effect) => effect.type !== AGENT_EFFECT_TYPES.START_GENERATION && effect.type !== AGENT_EFFECT_TYPES.STYLE_VARIATION,
    ),
    deferredGenerationEffect,
  };
}

export function createOpenAiService() {
  const minimaxService = createMiniMaxService();

  return {
    async prepareResponse({ request, conversationState, toolRunnerService }) {
      const message =
        request?.message ??
        request?.messages?.[request.messages.length - 1]?.parts?.find((part) => part.type === 'text')?.text ??
        '';
      const canvasContext = request?.canvasContext ?? null;
      const { toolCall } = await decideTool({
        minimaxService,
        toolRunnerService,
        message,
        canvasContext,
      });
      const { plan } = await runTool({
        toolRunnerService,
        message,
        canvasContext,
        toolCall,
      });
      const { immediateEffects, deferredGenerationEffect } = splitDeferredEffects(plan.effects ?? []);

      return {
        message,
        canvasContext,
        conversationId: conversationState.conversationId,
        previousResponseId: randomUUID(),
        prompt: buildFinalAnswerPrompt({
          message,
          canvasContext,
          plan,
          toolResult: plan.toolResult ?? '',
        }),
        fallbackText: composeAssistantText({
          message,
          canvasContext,
          plan,
        }),
        suggestions: plan.suggestions ?? [],
        effects: immediateEffects,
        deferredGenerationEffect,
      };
    },
    async streamPreparedResponse({ prepared, onTextDelta }) {
      return minimaxService.streamText({
        ...prepared.prompt,
        fallbackText: prepared.fallbackText,
        temperature: 1,
        onTextDelta,
      });
    },
    async respond({ request, conversationState, toolRunnerService }) {
      const prepared = await this.prepareResponse({
        request,
        conversationState,
        toolRunnerService,
      });
      const assistantText = await this.streamPreparedResponse({
        prepared,
        onTextDelta: null,
      });

      return {
        conversationId: prepared.conversationId,
        previousResponseId: prepared.previousResponseId,
        assistantMessage: {
          role: 'assistant',
          text: assistantText,
          suggestions: prepared.suggestions,
        },
        effects: prepared.effects,
      };
    },
  };
}
