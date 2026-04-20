## Context

当前右侧 assistant 侧栏的实现主要集中在以下模块：

- `apps/web/src/features/chat/components/AgentSidebar.tsx`：负责渲染会话列表、上下文卡片、消息线程和输入区。
- `apps/web/src/features/chat/hooks/useChatSidebarController.ts`：负责组装 active session、提交消息、应用 suggestions 和 effects。
- `apps/web/src/features/chat/hooks/useAgentChat.ts`：负责消费 `/chat` 的 SSE 结果，并回填 assistant 消息与 `data-agentResponse`。
- `apps/web/src/features/chat/session-state.ts`：负责会话创建、查找、消息追加和 session 更新。
- `apps/web/src/types/canvas.ts` 与 `packages/shared/src/chat.ts` / `tool-effects.ts`：定义 chat session、消息、generation job 和 structured effects。

现状的问题不是“没有数据”，而是已有数据以聊天线程为中心散落在多个层级：

- 当前任务线索分散在 `activeSession.messages`
- agent 动作线索分散在 `effects`
- 媒体执行状态分散在 `project.jobs`
- transport 状态只存在于 `useAgentChat().status`

因此，侧栏目前更像聊天面板，而不是任务协作面板。用户需要自己从消息文本中推断当前任务和执行进度，这与 Cursor/Copilot 风格的“当前任务 + 执行过程 + 下一步动作”不一致。

本次设计约束：

- 保持现有 `CanvasProject` 文档 schema 兼容，不引入新的持久化任务实体。
- 不修改 `/chat` API 合约，不要求 agent-api 新增正式的任务事件协议。
- 优先复用现有 session、messages、effects、jobs 和 suggestions，不创建平行状态系统。

## Goals / Non-Goals

**Goals:**

- 将右侧侧栏重构为以“当前任务”为主叙事的任务协作面板。
- 在前端基于现有数据派生 `DerivedCurrentTask` 视图模型，用于统一表达任务标题、意图、状态、时间线和下一步动作。
- 保留多会话能力，但将其从“主布局顶部列表”调整为“历史任务入口”。
- 将 assistant suggestions 提升为会话级“下一步动作区”，使用户能直接推进当前任务。
- 维持现有本地持久化、undo/redo、board ownership 与 effects 应用方式不变。

**Non-Goals:**

- 不在本次 change 中新增后端 task event 协议或 server-side timeline。
- 不重构 canvas engine、board document、asset/job schema 或 local persistence 版本。
- 不改变 chat session 的基本语义；session 仍是共享画布上的对话线程，而不是独立 board snapshot。
- 不把所有 assistant 文本拆成结构化消息块；第一阶段仅在 UI 层做更强的任务化展示。

## Decisions

### 1. 使用前端派生的 `DerivedCurrentTask`，而不是新增持久化任务实体

决策：

- 在 `useChatSidebarController.ts` 内或其相邻的派生 helper 中，根据以下数据生成当前任务视图模型：
  - active session
  - 最近一条 user message
  - 最近一条 assistant message
  - 最近一条 response effects
  - `project.jobs`
  - `useAgentChat().status` / `error`

理由：

- 现有数据已经足够表达粗粒度的“当前任务”。
- 如果现在引入 `Task` 持久化实体，会立即牵涉 `CanvasProject` schema、迁移、持久化兼容与测试成本。
- 用户当前最直接的问题是 UI 信息组织，而不是缺少新的后端数据源。

备选方案：

- 新增 `project.tasks[]` 并持久化每轮任务。
  - 放弃原因：范围过大，会把 UI 改造升级为数据模型重构。
- 依赖后端新增明确的 task event 协议。
  - 放弃原因：这次 change 的价值是前端可先落地；后端协议可以作为后续增强。

### 2. 将任务状态建模为视图层状态，而不是复用 session title 或消息文本

决策：

- 定义一组只存在于前端的派生字段，例如：
  - `title`
  - `intent`
  - `status`
  - `timeline[]`
  - `nextActions[]`

状态来源优先级：

- `intent`：优先看 structured effects，再看 jobs，最后才回退到文本推断。
- `status`：优先看 transport / job 状态，再映射到 `thinking`、`responding`、`generating`、`completed`、`failed`。

理由：

- `session.title` 当前只是会话名，不能稳定代表当前轮任务。
- assistant 文本既可能是解释，也可能是结果，不适合作为唯一状态来源。
- 明确的优先级能减少 UI 随消息文本漂移。

备选方案：

- 继续只显示 session title + latest message。
  - 放弃原因：仍然是聊天列表语义，无法支撑任务协作体验。

### 3. 保留消息线程，但将其降级为“对话记录”区

决策：

- `AgentSidebar.tsx` 的主体信息结构调整为：
  - Header
  - Current Task
  - Execution Timeline
  - Next Actions
  - Conversation Log
  - Composer

理由：

- 用户首先需要知道当前任务和当前进度，而不是先浏览历史消息。
- 保留对话记录仍然有助于用户理解 agent 的决策过程，但不再作为面板的唯一主角。

备选方案：

- 继续以聊天线程为主，只做视觉优化。
  - 放弃原因：这会得到“更好看的聊天面板”，而不是任务协作面板。

### 4. 将多会话展示弱化为“历史任务入口”，不改变其底层数据结构

决策：

- 保持 `project.chat.sessions[]` 与 `activeSessionId` 结构不变。
- 侧栏默认突出 active session 对应的当前任务，历史会话仅作为次级入口展示。

理由：

- 现有 session 数据模型和持久化逻辑已经成立。
- 本次需要改的是用户感知层级，而不是会话抽象本身。

备选方案：

- 把 session 全部重命名为 task 并改造存储。
  - 放弃原因：会模糊“线程”和“当前轮任务”的边界，并引入迁移问题。

### 5. 不修改本地持久化 schema，保持历史项目可直接读取

决策：

- `CanvasProject.version` 维持不变。
- `DerivedCurrentTask` 不写入文档，仅在渲染时生成。

理由：

- 当前 change 是 UI/交互层改造，不需要文档迁移。
- 旧项目在刷新后依然可以通过现有 session、message、job 数据派生相同视图。

备选方案：

- 升级版本并缓存任务派生结果。
  - 放弃原因：收益低，增加兼容性负担。

### 6. 测试策略以派生逻辑单测和侧栏关键路径 E2E 为主

决策：

- 单元测试覆盖：
  - 当前任务派生逻辑
  - 任务状态优先级（effects > jobs > text）
  - 无 session / 纯问答 / 生成中 / 失败等分支
- E2E 覆盖：
  - 无会话空态
  - 新建会话后当前任务区域可见
  - 生成型消息时显示 timeline 和 next actions
  - 历史会话切换后当前任务区域随 active session 更新

理由：

- 风险集中在视图模型推断和 UI 布局切换，而不是底层算法。

## Risks / Trade-offs

- [任务状态由前端推断，可能与 agent 内部真实步骤不完全一致] → 优先使用 structured effects 和 jobs，减少对自然语言文本的依赖，并将时间线保持在粗粒度级别。
- [侧栏布局重排可能让已有用户一时找不到历史会话入口] → 保留历史会话入口，只是降低权重，不删除多会话能力。
- [新的派生逻辑可能让 `useChatSidebarController.ts` 继续膨胀] → 将 `DerivedCurrentTask` 计算抽成独立 helper，而不是把所有规则堆进组件中。
- [assistant suggestions 提升为会话级区域后，消息级建议与会话级建议可能重复] → 第一阶段允许复用最新一条 assistant suggestions；如果视觉重复明显，再在实现时决定是否只保留固定区域。

## Migration Plan

1. 新增当前任务派生 helper 和相关类型，但不改持久化 schema。
2. 重排 `AgentSidebar.tsx` 信息结构，先接入 `Current Task`、`Timeline` 和 `Next Actions`。
3. 保留现有消息线程和 composer 行为，避免一次性改动过多交互。
4. 更新样式和测试。
5. 由于无 schema 变更，发布时不需要数据迁移；回滚也只需恢复旧侧栏组件布局和派生逻辑。

## Open Questions

- 历史会话入口最终是默认展开、折叠，还是只展示最近若干条，需要在实现时结合视觉稿再定。
- assistant 消息区是否要在第一阶段引入“计划 / 状态 / 结果”的结构化子块，目前设计允许先仅做容器级重排。
- 如果后续需要更精确的执行时间线，是否应在单独 change 中为 `/chat` 增加显式 task events，而不是继续加重前端推断。
