## Context

`apps/agent-api` 当前已经包含 `services/llm-gateway`，并通过 `providers.mjs` 把 `complete`、`stream`、`callTools`、`transcribe` 分发到不同 adapter。聊天编排层位于 `openai.service.mjs`，实际并不只服务 OpenAI，而是依赖 `createLlmGateway()` 做工具决策和文本流式回复；`tool-runner.service.mjs` 提供当前设计 agent 所需的工具定义与执行结果。

Vercel AI Gateway 可以通过 OpenAI-compatible API 或 AI SDK 接入。仓库中 `apps/agent-api/package.json` 已有 `ai@^6.0.158`，但现有 adapter 已经围绕 OpenAI Chat Completions 形态实现了请求、tool call 归一化、SSE 解析和错误映射。第一版应优先复用当前 gateway/adapter 模式，避免把 SDK 调用直接散到聊天编排层。

该变更不影响画布渲染、交互模型、文档 schema、持久化兼容性或 undo/redo 语义；影响范围集中在 `apps/agent-api` 的服务端模型 provider 配置与测试。

## Goals / Non-Goals

**Goals:**

- 在 `llm-gateway` 中新增 `vercel` provider，使 agent chat 可通过配置使用 Vercel AI Gateway。
- 支持当前聊天流程需要的三项能力：文本 completion、文本 streaming、tool calling。
- 复用现有规范化结果：assistant text、finish reason、usage、provider response id、tool call records、stream events 和统一错误码。
- 通过环境变量进行灰度：默认不改变现有 provider，只有配置 `LLM_DEFAULT_*_PROVIDER=vercel` 时切换。
- 支持 Vercel AI Gateway 的 API key 或 OIDC token 鉴权，并保持缺失配置时的快速失败。

**Non-Goals:**

- 不把图片生成、视频生成、音频转写迁移到 Vercel AI Gateway。
- 不在前端暴露 provider/model 选择 UI。
- 不引入新的公开 API 协议；`/chat` 的请求与 UI stream 输出保持兼容。
- 不在第一版实现完整 AI SDK providerOptions 路由 UI、动态模型发现或 per-user 成本面板。

## Decisions

### 1. 新增独立 `vercel` adapter，而不是复用 `openai` provider 名称

决策：
- 在 `LLM_PROVIDERS` 中新增 `VERCEL: 'vercel'`。
- 在 `providers.mjs` 注册 `createVercelAiGatewayAdapter`，能力声明为 `complete`、`stream`、`callTools` 支持，`transcribe` 不支持。

理由：
- Vercel AI Gateway 虽然可使用 OpenAI-compatible API，但它是独立上游，鉴权、模型 slug、成本观测和路由语义都不同于直连 OpenAI。
- 独立 provider 让 `LLM_DEFAULT_*_PROVIDER=vercel` 的灰度开关清晰，也避免污染当前 OpenAI 转写路径。

备选方案：
- 仅设置 `OPENAI_BASE_URL=https://ai-gateway.vercel.sh/v1` 来复用 OpenAI adapter。
  - 放弃原因：会把 Vercel Gateway 与 OpenAI provider 混在一起，难以表达 `provider/model` slug、Gateway 鉴权和后续 gateway-specific 选项。

### 2. 第一版使用 OpenAI-compatible HTTP 接口，保留 AI SDK 作为后续增强路径

决策：
- `vercel` adapter 第一版请求 `VERCEL_AI_GATEWAY_BASE_URL` 下的 `/chat/completions`。
- 请求体沿用当前 OpenAI Chat Completions 结构，模型使用 Vercel Gateway 要求的 `provider/model` slug。
- 使用现有 `readSseStream`、`normalizeToolCalls`、`normalizeUsage` 等 helper。

理由：
- 当前业务已经围绕 Chat Completions 和 SSE 事件实现了稳定的归一化逻辑，复用成本低、回归面小。
- 对 agent chat 来说，第一阶段最关键是 provider 可切换和 stream/tool call 兼容。

备选方案：
- 直接用 `ai` 的 `generateText` / `streamText` 与 gateway provider options。
  - 放弃原因：会引入新的 stream event 映射层和 tool schema 映射策略，适合第二阶段做 provider routing、fallback models、tags、cache control 等高级能力。

### 3. 环境变量保持显式且可回滚

决策：
- 新增 `vercelAiGatewayApiKey`、`vercelAiGatewayToken`、`vercelAiGatewayBaseUrl`、`vercelAiGatewayModel` 等 env 字段。
- 鉴权优先级为 API key，其次 OIDC token。
- 默认模型使用 Vercel Gateway 的 `provider/model` 格式，并允许运维通过 `.env` 覆盖。

理由：
- 本地开发、CI 和非 Vercel 运行环境更适合 API key；部署在 Vercel 时可使用 OIDC token。
- 默认 provider 不改动现状，回滚只需要把 `LLM_DEFAULT_TEXT_PROVIDER`、`LLM_DEFAULT_STREAM_PROVIDER`、`LLM_DEFAULT_TOOL_PROVIDER` 改回原 provider。

备选方案：
- 强制依赖 Vercel OIDC。
  - 放弃原因：本地 token 有时效，且当前 agent-api 不一定始终部署在 Vercel 环境中。

### 4. 错误映射沿用现有 LLM Gateway error model

决策：
- Vercel Gateway 返回 401/403 映射为 `upstream_auth_failed`。
- 429 映射为 `upstream_rate_limited`。
- 400 映射为 `upstream_invalid_request`。
- 超时映射为 `upstream_timeout`，其它非成功响应映射为 `upstream_failed`。

理由：
- `createLlmGateway()` 已经把 adapter 错误统一为 `LlmGatewayError`，业务层不需要识别 Vercel 特有错误格式。
- 保持错误语义一致，便于后续添加 fallback 或日志告警。

## Risks / Trade-offs

- [模型 slug 过期或不可用] → 将默认模型放在 env 中，测试只校验请求透传，不把具体模型可用性写死为业务逻辑。
- [OpenAI-compatible API 无法覆盖所有 Gateway providerOptions] → 第一版仅覆盖 chat/tool/stream；高级路由、fallback 模型、tags、cache control 后续用 AI SDK adapter 扩展。
- [鉴权配置混淆] → 明确 API key 优先、OIDC 其次，并在两者都缺失时返回 `provider_not_configured`。
- [工具调用返回格式存在 provider 差异] → adapter 必须通过现有 `normalizeToolCalls` 输出标准 tool call 结构，不能把原始 payload 传给 `tool-runner`。
- [上线后 provider 切换影响聊天体验] → 默认 provider 不变，通过环境变量灰度；出现问题时无需代码回滚即可切回 MiniMax/OpenAI。

## Migration Plan

1. 增加 env 字段和 `vercel` provider 常量。
2. 新增 Vercel AI Gateway adapter 与 provider registry 注册。
3. 为 adapter 补充 completion、stream、tool calling、鉴权缺失和错误映射测试。
4. 更新 `llm-gateway` 路由测试，覆盖默认 provider 切到 `vercel` 的行为。
5. 本地配置 `VERCEL_AI_GATEWAY_API_KEY` 和 `LLM_DEFAULT_*_PROVIDER=vercel` 做手动验证。
6. 部署时先在非生产或开发环境灰度；如失败，恢复 `LLM_DEFAULT_*_PROVIDER` 到原 provider。

## Open Questions

- 是否需要在第二阶段使用 AI SDK 暴露 Gateway tags、user attribution 和 fallback models？
- Vercel AI Gateway 默认模型应由部署环境指定，还是在仓库 `.env.example` 中提供推荐值？
- 是否要新增 health/debug endpoint 显示当前 LLM provider capability，但隐藏所有凭据？
