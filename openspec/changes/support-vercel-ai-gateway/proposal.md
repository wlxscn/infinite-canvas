## Why

当前 `apps/agent-api` 已经有统一的 `llm-gateway` 抽象，但生产可选 provider 仍主要依赖直连 MiniMax/OpenAI 等单一上游配置。随着聊天、工具调用和流式回复需要更稳定的跨模型路由，服务端需要支持 Vercel AI Gateway，以便用统一入口接入多 provider 模型、观测用量并保留现有 provider 的回退空间。

现在推进该能力可以在不改动 `/chat` 对外协议的前提下，把模型切换、成本归因和后续 provider fallback 放到网关层处理，避免业务编排继续感知每个模型厂商的接入细节。

## What Changes

- 在 `apps/agent-api` 的 `llm-gateway` provider registry 中新增 `vercel` provider。
- 新增 Vercel AI Gateway adapter，优先覆盖当前设计聊天所需的文本 completion、文本 streaming 和 tool calling 能力。
- 新增 Vercel AI Gateway 相关环境变量，用于配置 base URL、鉴权 token/API key、默认模型、可选 provider 路由标签或 fallback 模型。
- 允许通过 `LLM_DEFAULT_TEXT_PROVIDER`、`LLM_DEFAULT_STREAM_PROVIDER`、`LLM_DEFAULT_TOOL_PROVIDER` 将 agent chat 的文本与工具决策切换到 Vercel AI Gateway。
- 保留现有 MiniMax/OpenAI provider 路径，Vercel AI Gateway 未配置或能力不支持时返回统一错误，不改变前端 `/chat` 请求/响应协议。
- 明确非目标：
  - 不在本变更中统一图片/视频生成到 Vercel AI Gateway。
  - 不改造 `/chat` 为公开 OpenAI 兼容接口。
  - 不要求第一版实现动态模型发现 UI 或运行期用户可选模型。
  - 不替换现有音频转写默认路径，转写继续由当前 `openai` provider 配置控制。

## Capabilities

### New Capabilities
- `vercel-ai-gateway-provider`: 定义 agent-api 通过内部 LLM Gateway 接入 Vercel AI Gateway provider 的配置、路由、鉴权、文本生成、流式输出和工具调用行为。

### Modified Capabilities
- `agent-chat-service`: 扩展设计聊天服务的模型编排要求，使其可以通过配置把文本、流式和工具调用请求路由到 Vercel AI Gateway，同时保持前端协议不变。

## Impact

- 主要影响 `apps/agent-api/src/services/llm-gateway` 下的 provider 类型、registry、adapter、错误映射和测试。
- 影响 `apps/agent-api/src/config/env.mjs` 的环境变量读取与校验范围。
- 可能影响 `apps/agent-api/package.json` 依赖使用策略：第一版可复用 OpenAI-compatible HTTP 接口；若需要 providerOptions/fallback/tags 的完整能力，可进一步使用现有 `ai` SDK。
- 不改变 `apps/web`、`packages/shared` 的外部 API contract；前端仍通过当前 `/chat` 和 UI message stream 消费回复。
- 部署配置需要新增 Vercel AI Gateway 凭据或 OIDC token，并在需要灰度时调整 `LLM_DEFAULT_*_PROVIDER`。
