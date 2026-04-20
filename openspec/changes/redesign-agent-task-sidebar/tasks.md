## 1. 派生任务视图模型

- [x] 1.1 在 `apps/web/src/features/chat` 下新增当前任务派生 helper 和相关类型，基于 active session、messages、effects、jobs 与 `useAgentChat().status` 计算 `DerivedCurrentTask`。
- [x] 1.2 在 `apps/web/src/features/chat/hooks/useChatSidebarController.ts` 中接入当前任务派生逻辑，并为无会话、纯问答、生成中、失败等分支提供稳定的 view model 输出。
- [x] 1.3 为当前任务派生逻辑补充 Vitest 单测，覆盖任务标题、意图优先级、状态映射和时间线节点生成。

## 2. 右侧侧栏信息结构重排

- [x] 2.1 重构 `apps/web/src/features/chat/components/AgentSidebar.tsx`，将主布局调整为“当前任务 + 执行过程 + 下一步动作 + 对话记录 + 输入区”。
- [x] 2.2 调整 `apps/web/src/index.css` 和相关样式，使 active session 的任务摘要成为主视觉区，并将历史会话降级为次级入口。
- [x] 2.3 保留现有消息线程和 composer 提交行为，但更新文案与容器层级，使其表达“继续当前任务”而不是单纯聊天。

## 3. 会话历史与下一步动作

- [x] 3.1 调整会话列表展示逻辑，使 `project.chat.sessions` 以历史任务入口的形式呈现，同时保持 `activeSessionId` 切换行为不变。
- [x] 3.2 将最新 assistant suggestions 提升为固定的“下一步动作区”，并复用现有 `handleSuggestion` 流程触发后续操作。
- [x] 3.3 校验空态与历史会话切换时的布局行为，确保没有 active session 时仍显示空态，引入 active session 后优先显示当前任务区域。

## 4. 测试与验证

- [x] 4.1 更新 `apps/web/tests/unit` 下与 chat sidebar 相关的单测，覆盖当前任务展示、下一步动作区和历史会话入口的渲染逻辑。
- [x] 4.2 更新 `apps/web/tests/e2e/canvas.spec.ts` 或新增等价 E2E 用例，验证用户发送消息后能看到当前任务、执行过程和 suggestions 驱动的后续操作。
- [x] 4.3 运行 `pnpm test`、`pnpm lint` 和必要的 `pnpm test:e2e`，确认右侧侧栏重构未破坏现有画布与 chat 流程。
