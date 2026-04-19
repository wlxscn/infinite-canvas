## Why

当前 `apps/agent-api` 的模型调用能力分散在 `openai.service.mjs`、`minimax.service.mjs` 和 `transcription.service.mjs` 中，聊天编排、provider 协议细节和媒体/转写调用直接耦合在一起。随着系统准备兼容 OpenAI、Claude、Gemini、MiniMax、GLM、Kimi 等不同 provider，继续沿用当前按厂商堆叠 service 的方式，会让 tool calling、流式事件、多轮会话和错误处理迅速碎片化。

现在推进统一网关的价值在于，先为 `agent-api` 建立稳定的内部 AI 调用语义，让业务层只依赖统一的文本生成、流式事件、工具调用和转写接口，而不是直接绑定某一家厂商的请求格式。这样后续扩展 provider、切换默认模型和做降级/fallback，才不会反复改写聊天主流程。

## What Changes

- 新增一个统一的 `llm-gateway` 能力，负责在服务端归一化文本生成、流式输出、tool calling 和音频转写调用。
- 在 `apps/agent-api` 中引入 provider adapter 分层，把 MiniMax、OpenAI 以及后续 Claude、Gemini、GLM、Kimi 的 HTTP 协议细节下沉到 adapter，而不是散落在 controller 和业务 service 中。
- 为统一网关定义稳定的内部请求/响应模型，包括 provider 选择、capability 检查、标准化工具定义、标准化 tool call 结果、标准化 stream event 和统一错误码。
- 调整当前 agent chat 编排，使 `chat.controller` 和设计 agent workflow 通过统一网关完成工具决策与文本流式输出，不再直接依赖某个 provider service。
- 将会话标识与 provider continuation state 解耦：保留业务侧 `conversationId`，并把 provider-specific 的 `responseId`、session pointer 等状态限制在网关内部或 provider state 中。
- 第一版显式限定非目标，避免该变更膨胀成完整的 AI 平台重写：
  - 不在第一版统一图片和视频生成协议
  - 不提供对外兼容 OpenAI 的公共 API 壳
  - 不引入完整的多工具循环 agent runtime
  - 不要求所有 provider 在第一版同时达到完全功能对齐

## Capabilities

### New Capabilities
- `unified-llm-gateway`: 定义服务端统一的 LLM 网关接口、provider adapter 约束、标准化流式事件、工具调用结果和转写能力。

### Modified Capabilities
- `agent-chat-service`: 将设计聊天服务的模型编排依赖从具体 provider service 调整为统一网关，并明确多轮会话状态与 provider continuation state 的边界。

## Impact

- 主要影响 `apps/agent-api/src/services` 下现有的 `openai.service.mjs`、`minimax.service.mjs`、`transcription.service.mjs`、`conversation.service.mjs` 和聊天编排相关模块。
- 会新增 provider adapter、gateway registry、能力检查、标准化错误与事件模型，可能同时影响 `packages/shared` 中与 agent chat 请求/响应、tool effects 或内部 runtime 常量相关的共享类型。
- 会影响 `/chat` 与 `/transcribe` 的服务端实现，但不要求前端立即切换外部接口协议。
- 会引入新的环境变量组织方式和 provider 配置约束，并需要明确缺省 provider、模型映射与缺失配置时的降级行为。
