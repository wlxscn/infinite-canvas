## 1. Gateway foundations

- [x] 1.1 在 `apps/agent-api/src/services` 下新增统一 gateway 模块与标准化类型，定义 `complete`、`stream`、`callTools`、`transcribe` 的内部接口，以及标准化结果、stream event、tool call 和错误码模型。
- [x] 1.2 新增 provider capability registry 与配置读取约束，明确 provider/model 的文本流式、tool calling、转写支持面，并移除任何硬编码 provider credential 默认值。
- [x] 1.3 为 gateway 核心模型补充单元测试，覆盖 capability 校验、错误标准化、tool 参数解析失败和 provider 未配置场景。

## 2. Provider adapters

- [x] 2.1 将现有 `minimax.service.mjs` 的文本 completion、stream 和 tool-calling 相关逻辑下沉为 MiniMax adapter，保留图片/视频生成功能在独立媒体路径中。
- [x] 2.2 将现有 `transcription.service.mjs` 的 OpenAI 音频转写逻辑下沉为 OpenAI transcription adapter，并通过统一 gateway 暴露标准化转写结果。
- [x] 2.3 为 MiniMax 和 OpenAI adapter 补充 contract tests，覆盖成功响应、上游错误、超时和流式解析失败。

## 3. Chat orchestration migration

- [x] 3.1 收缩 `apps/agent-api/src/services/openai.service.mjs` 的职责，使其成为设计 agent 编排层，通过统一 gateway 完成工具决策与文本流式输出。
- [x] 3.2 调整 `apps/agent-api/src/services/conversation.service.mjs` 的状态模型，分离应用 `conversationId` 与 provider continuation state，并保持现有 `/chat` 请求兼容。
- [x] 3.3 更新 `apps/agent-api/src/controllers/chat.controller.mjs` 与相关测试，确保内部使用统一 gateway 后，前端仍收到现有 UI message stream 协议和结构化 effects。

## 4. Additional provider onboarding

- [x] 4.1 为 Claude、Gemini、GLM、Kimi 预留 adapter 接口与配置入口，并至少接入一个支持文本和 tool calling 的新增 provider 来验证抽象稳定性。
- [x] 4.2 为 provider/model 路由策略补充默认模型映射与显式失败路径，避免不支持的能力静默降级。

## 5. Specs and validation

- [x] 5.1 校准 `openspec/specs/agent-chat-service/spec.md` 对应实现与新增 `unified-llm-gateway` capability 的覆盖关系，确保 gateway、chat orchestration 和 transcription 行为都可追溯到 spec。
- [x] 5.2 运行 `pnpm test`、`pnpm lint` 和与 `agent-api` 相关的验证脚本，确认 gateway 迁移没有破坏现有聊天与转写流程。
