## 1. 依赖与消息正文渲染入口

- [x] 1.1 在 `apps/web/package.json` 中加入 `react-markdown` 与 `remark-gfm`，并确认 Vite/TypeScript 构建可正常解析相关依赖。
- [x] 1.2 在 `apps/web/src/features/chat/components/` 下拆分消息正文渲染边界，为助理最终消息引入独立的 Markdown 正文组件，并保持用户消息与流式消息继续走纯文本正文。
- [x] 1.3 调整 `apps/web/src/features/chat/components/AgentSidebar.tsx`，让流式消息、已落库消息和去重逻辑在“纯文本流式态”与“Markdown 最终态”之间稳定切换，不重复显示同一条助理消息。

## 2. Markdown/GFM 与宽内容展示

- [x] 2.1 在助理最终消息渲染路径中接入 `react-markdown + remark-gfm`，支持段落、列表、强调、引用、链接、行内代码、代码块和 GFM 表格。
- [x] 2.2 更新 `apps/web/src/index.css` 中的聊天消息正文样式，新增面向 Markdown 容器的排版规则，而不是继续只依赖 `.chat-message p`。
- [x] 2.3 为 Markdown 表格和代码块补充局部横向滚动与边界样式，确保超宽内容不会撑破右侧聊天气泡、会话浮层和输入区布局。
- [x] 2.4 明确不启用原始 HTML 直通渲染，并在消息正文实现中保持字符串输入到安全 Markdown 渲染器的单向链路。

## 3. 流式打字机与最终态衔接

- [x] 3.1 保持 `apps/web/src/features/chat/hooks/useTypewriterText.ts` 的纯文本节流职责不变，不在流式阶段实时解析未完成的 Markdown。
- [x] 3.2 校准 `AgentSidebar.tsx` 中最后一条助理消息的显示策略，使打字机文本在消息完成前持续可见，并在完成后平滑切换为 Markdown/GFM 最终态。
- [x] 3.3 验证表格、列表和代码块场景下从 SSE chunk 到最终消息落库的状态转换，确保不会出现正文闪烁、结构提前解析或双份消息。

## 4. 测试与验证

- [x] 4.1 更新 `apps/web/tests/unit/agent-sidebar.test.tsx` 或拆分新的消息正文单测，覆盖助理最终消息的 Markdown/GFM 渲染、表格可见性和局部横向滚动容器。
- [x] 4.2 为流式回复补充单测，覆盖纯文本打字机阶段、消息完成后的 Markdown 切换，以及去重逻辑在最终态下仍然成立。
- [x] 4.3 如有必要，补充或更新 `apps/web/tests/e2e/canvas.spec.ts` 中与聊天侧栏相关的场景，确认窄侧栏下代码块和表格不会破坏界面布局。
- [x] 4.4 运行 `pnpm test`、`pnpm lint` 和 `pnpm build`；若新增了与聊天体验相关的端到端验证，再运行 `pnpm test:e2e` 确认消息渲染变更未破坏现有对话流程。
