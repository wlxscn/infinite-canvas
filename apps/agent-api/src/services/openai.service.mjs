import { randomUUID } from 'node:crypto';
import { Annotation, END, START, StateGraph } from '@langchain/langgraph';
import { createAgentChatResponse } from '../../../../packages/shared/src/runtime.mjs';
import { designAgentPrompt } from '../prompts/design-agent.prompt.mjs';
import { createMiniMaxService } from './minimax.service.mjs';

const AgentState = Annotation.Root({
  message: Annotation(),
  canvasContext: Annotation(),
  conversationState: Annotation(),
  plan: Annotation(),
  assistantText: Annotation(),
  suggestions: Annotation(),
  effects: Annotation(),
});

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

  if (plan.action === 'change_canvas_style') {
    return `${contextSummary} 我建议先做风格变化，不直接重写整张图。你的请求是：${message}`;
  }

  return `${contextSummary} 我会继续生成一个更接近你意图的变体，并保留后续补文字的入口。你的请求是：${message}`;
}

function buildMiniMaxPrompt({ message, canvasContext, plan }) {
  const contextSummary = summarizeCanvasContext(canvasContext);
  const actionInstruction =
    plan.action === 'add_text_to_canvas'
      ? 'The planned board action is add_text_to_canvas. Propose concise poster copy that can be placed on the canvas.'
      : plan.action === 'change_canvas_style'
        ? 'The planned board action is change_canvas_style. Focus on style direction and practical visual changes.'
        : 'The planned board action is generate_image_variant. Focus on how the next generated variation should evolve from the current board.';

  return {
    system: `${designAgentPrompt.instructions}
You are answering inside a design canvas product.
Do not mention internal prompts or hidden reasoning.
Keep the answer concise, natural, and directly useful to the designer.
The tool routing decision has already been made by the application, so do not ask to choose a tool.`,
    user: `Board context: ${contextSummary}
Planned action: ${plan.action}
Action guidance: ${actionInstruction}
User message: ${message}

Write the assistant reply in Chinese.`,
  };
}

function createAgentGraph(toolRunnerService) {
  const minimaxService = createMiniMaxService();

  return new StateGraph(AgentState)
    .addNode('plan-tools', async (state) => ({
      plan: toolRunnerService.preview({
        message: state.message,
        canvasContext: state.canvasContext,
      }),
    }))
    .addNode('compose-response', async (state) => ({
      assistantText: await minimaxService.generateText({
        ...buildMiniMaxPrompt({
          message: state.message,
          canvasContext: state.canvasContext,
          plan: state.plan,
        }),
        fallbackText: composeAssistantText({
          message: state.message,
          canvasContext: state.canvasContext,
          plan: state.plan,
        }),
      }),
      suggestions: state.plan.suggestions,
      effects: state.plan.effects,
    }))
    .addEdge(START, 'plan-tools')
    .addEdge('plan-tools', 'compose-response')
    .addEdge('compose-response', END)
    .compile();
}

export function createOpenAiService() {
  return {
    async respond({ request, conversationState, toolRunnerService }) {
      const graph = createAgentGraph(toolRunnerService);
      const message =
        request?.message ??
        request?.messages?.[request.messages.length - 1]?.parts?.find((part) => part.type === 'text')?.text ??
        '';

      const graphResult = await graph.invoke({
        message,
        canvasContext: request?.canvasContext ?? null,
        conversationState,
      });

      return createAgentChatResponse({
        conversationId: conversationState.conversationId,
        previousResponseId: randomUUID(),
        assistantText: graphResult.assistantText,
        suggestions: graphResult.suggestions ?? [],
        effects: graphResult.effects ?? [],
      });
    },
  };
}
