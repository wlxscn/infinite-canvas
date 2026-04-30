## 1. 配置与 Provider 注册

- [x] 1.1 在 `apps/agent-api/src/services/llm-gateway/types.mjs` 新增 `vercel` provider 常量。
- [x] 1.2 在 `apps/agent-api/src/config/env.mjs` 读取 Vercel AI Gateway base URL、API key、OIDC token 和默认模型配置。
- [x] 1.3 在 `apps/agent-api/src/services/llm-gateway/providers.mjs` 注册 `vercel` provider，并声明 `complete`、`stream`、`callTools` 支持，`transcribe` 不支持。

## 2. Vercel AI Gateway Adapter

- [x] 2.1 新增 `apps/agent-api/src/services/llm-gateway/adapters/vercel-ai-gateway.adapter.mjs`，通过 OpenAI-compatible `/chat/completions` 调用 Vercel AI Gateway。
- [x] 2.2 实现 `complete`，返回现有 gateway 规范化的 assistant text、finish reason、usage、provider response id 和 raw payload。
- [x] 2.3 实现 `callTools`，复用现有 tool call normalization，把 Vercel Gateway 返回的工具调用转换为标准 tool call records。
- [x] 2.4 实现 `stream`，复用现有 SSE 解析并输出 `LLM_STREAM_EVENT_TYPES` 文本事件。
- [x] 2.5 实现鉴权选择与错误映射：API key 优先、OIDC 其次，缺失配置、401/403、429、400、timeout 和其它失败映射到统一 LLM Gateway error code。

## 3. 聊天编排兼容

- [x] 3.1 验证 `createOpenAiService` 通过现有 `createLlmGateway()` 自动使用 `LLM_DEFAULT_TEXT_PROVIDER`、`LLM_DEFAULT_STREAM_PROVIDER`、`LLM_DEFAULT_TOOL_PROVIDER` 切换到 `vercel`。
- [x] 3.2 确认 `/chat` 的请求体、响应体、UI message stream 和 server-side tool execution contract 不需要前端改动。
- [x] 3.3 保持 `/transcribe` 默认 provider 独立配置，不把 `vercel` 设为转写默认能力。

## 4. 测试与验证

- [x] 4.1 新增 Vercel adapter 单元测试，覆盖 completion 请求、tool call 解析、stream delta、API key/OIDC 鉴权和错误映射。
- [x] 4.2 更新 `apps/agent-api/src/services/llm-gateway/index.test.mjs` 或 provider registry 测试，覆盖 `vercel` capability 和默认 provider 路由。
- [x] 4.3 运行 `pnpm --filter @infinite-canvas/agent-api test` 验证 agent-api 单元测试。
- [x] 4.4 运行 `pnpm lint` 或 `pnpm --filter @infinite-canvas/agent-api build` 验证服务端 lint/build 检查。
- [ ] 4.5 使用本地 `.env` 灰度配置 `LLM_DEFAULT_TEXT_PROVIDER=vercel`、`LLM_DEFAULT_STREAM_PROVIDER=vercel`、`LLM_DEFAULT_TOOL_PROVIDER=vercel` 和 Vercel Gateway 凭据，手动验证 `/chat` 能完成工具决策与流式回复。
