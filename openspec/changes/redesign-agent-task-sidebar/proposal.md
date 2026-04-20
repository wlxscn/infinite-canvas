## Why

当前右侧 assistant 侧栏已经支持多会话、建议动作和服务端对话，但整体信息结构仍然以“聊天记录”为中心。对于持续性的设计协作任务，用户很难快速判断当前正在做什么、agent 执行到了哪一步，以及下一步该如何推进，这使侧栏更像消息面板而不是任务协作面板。

现在推进这次改造，是因为前后端已经具备会话、effects、generation jobs 和建议动作等结构化信号，足以先把右侧侧栏升级为更接近 Cursor/Copilot 的任务协作界面，而不必等待新的后端协议。

## What Changes

- 将右侧 assistant 侧栏的信息结构从“会话列表 + 上下文卡片 + 聊天气泡”调整为“当前任务 + 执行过程 + 下一步动作 + 对话记录”。
- 基于当前活跃会话、最新消息、agent effects、generation jobs 和 chat transport 状态，派生一个前端任务视图模型，用于展示当前任务标题、任务类型、任务状态和粗粒度时间线。
- 将 assistant 返回的建议动作从消息级附件提升为会话级“下一步”操作区，同时保留现有对话连续性。
- 弱化历史会话在默认视图中的权重，将其表达为任务历史入口，而不是当前侧栏的主叙事。
- 保持现有 agent service、structured effects、画布状态 ownership 和本地持久化机制不变，不在本次改造中引入新的服务端任务事件协议。
- 明确非目标：本次 change 不重做 canvas engine、不更改 board schema，也不要求后端新增正式的任务时间线 API。

## Capabilities

### New Capabilities

### Modified Capabilities
- `ai-design-canvas`: 右侧 assistant 侧栏的用户可见行为从聊天导向调整为任务协作导向，新增当前任务、执行过程和会话级下一步动作的展示要求。

## Impact

- 主要影响 `apps/web/src/features/chat` 下的侧栏组件、controller、chat mapper、相关样式以及 `App.tsx` 中的侧栏布局组织。
- 需要更新 `apps/web/src/types` 和可能的 shared chat/effect 映射逻辑，以支持前端派生任务视图模型，但不改变后端 `/chat` API 合约。
- 需要补充或更新 Vitest/Playwright，用于覆盖任务状态展示、下一步动作区和历史会话入口的关键交互。
