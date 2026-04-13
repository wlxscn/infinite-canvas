## Why

The current chat sidebar is entirely client-side and mock-driven, so it cannot maintain real multi-turn design conversations, call tools, or coordinate canvas actions through an actual AI service. Now that the repo has a monorepo skeleton with `apps/web` and `apps/agent-api`, the next step is to introduce a real agent backend so the sidebar can evolve from demo UI into a functional design copilot.

## What Changes

- Add a new `apps/agent-api` implementation based on LangChain/LangGraph to orchestrate design chat requests, tool calls, and conversation state.
- Define a shared request/response contract between the frontend and agent service so chat messages, canvas context, and tool effects have stable typed boundaries.
- Update the frontend chat flow to call the agent service through Vercel AI SDK instead of generating local mock assistant replies.
- Support agent-driven design actions such as text insertion, style-change requests, and generation-follow-up intents through structured tool effects.
- Preserve the existing canvas editing model and local project persistence while adding service-backed chat state pointers such as conversation identifiers.
- Keep the scope limited to agent-backed chat orchestration; do not replace the canvas renderer, local board model, or broader editing engine.

## Capabilities

### New Capabilities
- `agent-chat-service`: Service-side orchestration for design chat using LangChain/LangGraph, including conversation state, tool routing, and structured responses for the frontend.

### Modified Capabilities
- `ai-design-canvas`: Change the sidebar chat experience from local mock replies to real agent-backed interactions delivered through the agent service and Vercel AI SDK.

## Impact

- Affected code spans `apps/agent-api`, `apps/web`, and `packages/shared`.
- New dependencies will include LangChain/LangGraph on the service side and Vercel AI SDK on the frontend.
- API and protocol impact includes a new chat endpoint, shared conversation/tool-effect payloads, and environment configuration for model credentials.
- Backward-compatibility impact: persisted local project data should remain readable, while chat-specific persistence may need migration to store conversation identifiers instead of only mock messages.
