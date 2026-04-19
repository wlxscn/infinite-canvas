## Context

当前 `agent-api` 已经具备服务端 AI 编排雏形，但职责边界比较混杂：

- `chat.controller.mjs` 负责请求解析、SSE 写回、工具决策后的延迟生成调度。
- `openai.service.mjs` 名称上像 OpenAI 封装，实际上承担了设计 agent 编排职责，并直接依赖 `createMiniMaxService()` 做工具选择和文本流式输出。
- `minimax.service.mjs` 同时承担普通文本 completion、SSE 流、图片生成、视频生成、调试接口等多种职责。
- `transcription.service.mjs` 直接对接 OpenAI 音频转写接口，错误模型与 MiniMax 调用路径完全分裂。
- `conversation.service.mjs` 当前只是在请求缺失时补 `conversationId` 和 `previousResponseId`，尚未区分业务会话标识和 provider continuation state。

如果继续新增 `claude.service.mjs`、`gemini.service.mjs`、`glm.service.mjs`、`kimi.service.mjs`，现有结构会退化成“业务编排直接感知 provider 差异”的平行分支系统，难以保证 tool calling、stream event、会话续接和错误处理的一致性。

## Goals / Non-Goals

**Goals:**

- 为 `apps/agent-api` 建立统一的内部 LLM Gateway，给聊天编排层提供稳定的 `complete`、`stream`、`callTools`、`transcribe` 语义。
- 用 provider adapter 隔离各家上游协议差异，让 controller、tool runner 和业务编排不直接处理不同 provider 的 payload 细节。
- 统一标准化数据模型：
  - 文本结果
  - 流式事件
  - tool definition / tool choice / tool call result
  - provider capability 与错误码
- 把业务 `conversationId` 与 provider-specific continuation state 分层，避免把 `previousResponseId` 误当成跨 provider 的统一会话协议。
- 在不破坏现有 `/chat` 和 `/transcribe` 对外行为的前提下，支持从 MiniMax/OpenAI 扩展到更多 provider。

**Non-Goals:**

- 不统一图片和视频生成协议；`generateImage` / `generateVideo` 继续作为独立媒体能力演进。
- 不提供对外开放的 OpenAI 兼容 `/chat/completions` 或 `/responses` API。
- 不构建完整的多工具循环 agent framework；第一版只支持当前设计聊天所需的单轮工具决策和文本输出闭环。
- 不要求第一版完成所有 provider 的生产接入；允许先以 MiniMax、OpenAI 为基线，再逐步接入 Claude、Gemini、GLM、Kimi。

## Decisions

### 1. 在 `apps/agent-api` 内引入 gateway + adapter 两层，而不是继续加平级 provider services

决策：
- 新增统一网关层，作为聊天编排与 provider adapter 之间的唯一入口。
- 每个 provider 通过独立 adapter 实现自身请求格式、stream 解析、tool schema 映射和错误处理。

理由：
- 业务层真正需要的是稳定语义，而不是某家 provider 的原生 payload。
- adapter 能把 MiniMax 的 `/chat/completions`、OpenAI 的音频转写，以及后续 Claude/Gemini 等差异压缩在 provider 边界内。

备选方案：
- 继续为每个 provider 增加平级 service，并在 `openai.service.mjs`/controller 中做条件分支。
  - 放弃原因：差异会扩散到业务层，后续每增加一个 provider 都要修改聊天主流程。

### 2. 统一网关只暴露最小动作集：`complete`、`stream`、`callTools`、`transcribe`

决策：
- 第一版只统一文本非流式、文本流式、工具调用和转写。
- 图片/视频生成不并入 `llm-gateway`，继续保留独立媒体调用路径。

理由：
- 当前业务痛点主要在聊天编排，而不是媒体生成。
- 不同 provider 的图片/视频能力差异更大，强行并入第一版会污染文本网关抽象。

备选方案：
- 一次性做全能 AI Gateway，统一文本、图片、视频、音频和 embedding。
  - 放弃原因：范围过大，会让 capability 协商与请求模型迅速失控。

### 3. 标准化 tool calling 结果，而不是透传 provider 原始 tool payload

决策：
- 网关内部定义统一的 `AppToolDefinition`、`ToolChoicePolicy`、`LlmToolCallResult`。
- adapter 负责把 provider 原始 tool call 数据解析成标准结构，包含：
  - 解析后的 `arguments`
  - 原始 `rawArguments`
  - 工具名、调用 id、finish reason

理由：
- 当前 `tool-runner.service.mjs` 已经有自己的工具定义和执行语义，后续应始终接收标准化结果，而不是继续解析厂商差异。
- 统一工具调用结果之后，聊天编排层才能无感切换 provider。

备选方案：
- 让 `tool-runner` 继续处理不同 provider 的原始 tool call JSON/string。
  - 放弃原因：tool runner 会被迫理解 provider 协议，破坏职责边界。

### 4. 统一 stream event 模型，并把它与前端 UI stream 协议分层

决策：
- 网关内部定义 provider-neutral stream events，例如：
  - `text-start`
  - `text-delta`
  - `text-end`
  - `tool-call-start`
  - `tool-call-delta`
  - `tool-call-end`
  - `usage`
  - `done`
  - `error`
- `chat.controller.mjs` 继续负责把这些内部事件映射到当前前端消费的 UI message stream 协议。

理由：
- 前端当前协议服务于 UI，而 provider stream 协议服务于上游调用，两者不应直接绑定。
- 先统一内部事件，后续接入支持流式 tool calling 的 provider 时，不需要重写 controller 语义。

备选方案：
- 让每个 provider 直接在 controller 中写回 UI stream。
  - 放弃原因：controller 会越来越了解 provider 细节，无法复用。

### 5. 业务会话状态与 provider continuation state 分离

决策：
- `conversation.service.mjs` 只维护应用自己的会话标识，如 `conversationId`、当前 turn 元数据和 history policy。
- provider-specific 的 `responseId`、session id、cached context key 等状态归入 gateway/provider state，不暴露为通用业务协议。

理由：
- 不同 provider 对会话续接的支持差异很大，有些依赖完整消息列表，有些支持 response pointer。
- 把 `previousResponseId` 直接作为业务协议会让未来的跨 provider 路由和 fallback 变得脆弱。

备选方案：
- 继续沿用当前 `conversationId + previousResponseId` 的扁平模型。
  - 放弃原因：看似简单，但会把 provider-specific continuation 误包装成统一语义。

### 6. 显式 capability registry 和统一错误码，而不是依赖调用失败后兜底

决策：
- 网关维护 provider/model capability registry，至少覆盖：
  - 是否支持文本流式
  - 是否支持 tool calling
  - 是否支持转写
- 返回统一错误码，例如：
  - `provider_not_configured`
  - `provider_unsupported`
  - `model_unsupported`
  - `capability_unsupported`
  - `upstream_timeout`
  - `upstream_rate_limited`
  - `upstream_auth_failed`
  - `stream_parse_failed`
  - `invalid_tool_arguments`

理由：
- controller 和编排层需要稳定地判断失败类型并决定降级路径。
- 统一日志和错误分类后，才能做 provider fallback 和运行期诊断。

备选方案：
- 沿用各 service 当前的 `null`、通用 502 和 provider-specific 文本日志。
  - 放弃原因：一旦 provider 增多，诊断与告警几乎不可维护。

## Risks / Trade-offs

- [抽象过早] → 第一版只覆盖文本、tool calling、stream 和转写，避免把图片/视频也纳入统一层。
- [现有命名与职责错位] → 在迁移中把 `openai.service.mjs` 收缩为 agent orchestration 职责，避免文件名继续误导实现。
- [不同 provider 功能面不完全一致] → capability registry 显式声明支持面，遇到不支持的能力时返回明确错误而不是静默降级。
- [会话状态迁移引入兼容风险] → 对外请求协议先保留现有 `conversationId`/`previousResponseId` 字段，内部逐步改为分层状态模型。
- [测试范围扩大] → 通过 adapter contract tests、chat orchestration 单元测试和现有 `/chat` 集成验证，控制回归面。

## Migration Plan

1. 引入 gateway 接口、标准化类型与 capability/error model，同时保留现有 MiniMax/OpenAI service 作为实现来源。
2. 先将 MiniMax 文本/tool/stream 和 OpenAI 转写封装为第一批 adapter，保证现有 `/chat`、`/transcribe` 行为不变。
3. 让 `openai.service.mjs` 迁移为聊天编排服务，通过 gateway 而不是具体 provider service 工作。
4. 收缩 `conversation.service.mjs`，把 provider continuation state 从业务会话状态中剥离。
5. 为新增 provider 逐步接入 adapter，并在 registry 中声明能力与默认模型映射。
6. 若迁移中发现网关抽象不足，可回退到原 provider service 调用路径，因为外部 controller 协议保持不变。

## Open Questions

- 第一版是否只落地 MiniMax + OpenAI，还是至少同时接入一个支持 tool calling 的第二 provider 作为抽象验证？
- provider/model 路由是否需要在第一版就支持“profile”级别选择，例如 `tool-calling-balanced`，还是先只支持显式 provider + model？
- 当前 `/chat` 的请求体是否需要马上暴露 provider 选择字段，还是继续由服务端固定策略决定？
- 转写是否也应该走与文本相同的 provider registry，还是单独保留 `transcription` 领域的 provider 配置入口？
