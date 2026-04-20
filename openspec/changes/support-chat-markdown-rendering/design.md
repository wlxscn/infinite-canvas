## Context

当前聊天消息在 `apps/web/src/features/chat/components/AgentSidebar.tsx` 中直接以字符串塞入 `<p>`，并通过 `white-space: pre-wrap` 保留换行。这种方式对普通段落足够，但当设计助理输出步骤列表、参数对照、代码块或表格时，阅读体验会迅速下降。现有消息模型 `ChatMessage.text` 仍然只有纯字符串，服务端 `/chat` 也只返回文本内容，因此本次设计需要在不改变消息协议、持久化结构和流式状态机的前提下提升最终态展示能力。

这次变更会同时触及几类前端模块：
- `apps/web/src/features/chat/components/AgentSidebar.tsx`：消息正文的渲染入口、流式草稿与已落库消息去重、最终态与流式态切换逻辑。
- `apps/web/src/features/chat/hooks/useTypewriterText.ts`：继续负责流式纯文本打字机节流，不承担 Markdown 解析责任。
- `apps/web/src/features/chat/hooks/useAgentChat.ts` 与 `useChatSidebarController.ts`：数据流仍保持字符串消息，不新增富文本结构。
- `apps/web/src/index.css`：需要从单一 `<p>` 排版扩展为消息正文容器样式体系，覆盖列表、代码块、引用、链接和表格。
- `apps/web/tests/unit/agent-sidebar.test.tsx` 以及相关消息渲染测试：需要验证最终态 Markdown/GFM 渲染与流式纯文本阶段的边界行为。

本变更不修改文档模型、不会影响本地项目持久化，也不会改变 undo/redo 语义。聊天消息依然作为字符串保存在现有 `project.chat.sessions[].messages[]` 中，已有保存数据继续兼容。

## Goals / Non-Goals

**Goals:**
- 让助理最终消息支持基于 `react-markdown` 的 Markdown 渲染。
- 启用 `remark-gfm`，支持表格等 GFM 扩展语法。
- 保持流式阶段继续显示纯文本打字机，不在流式过程中做 Markdown 实时解析。
- 在右侧窄栏中让表格和代码块保持可读，避免撑破聊天气泡或整个侧栏。
- 不改变现有消息数据结构、服务端响应协议和本地持久化兼容性。

**Non-Goals:**
- 不在流式阶段实时渲染 Markdown 或表格。
- 不支持原始 HTML 透传，不引入 `rehype-raw` 之类的 HTML 直通能力。
- 不把用户消息一起升级成完整 Markdown 渲染，第一版只覆盖助理最终消息。
- 不引入新的消息富文本 schema，也不调整 agent-api 返回结构。

## Decisions

### 1. 最终态使用 `react-markdown + remark-gfm`，流式态继续保持纯文本

选择在助理最终消息落库后使用 `react-markdown` 渲染，并启用 `remark-gfm` 支持表格、删除线等 GFM 语法。流式态继续沿用当前 `useTypewriterText` 输出的纯文本字符串。

原因：
- 现有数据模型只存 `text: string`，天然适配 `react-markdown`，无需修改 `packages/shared` 或服务端协议。
- 纯文本流式已经完成打字机节流、去重和落库接续；若在每个 chunk 上实时做 Markdown 解析，未闭合语法会频繁重排，破坏当前体验。
- 通过把 Markdown 渲染限定在最终态，可以把“内容生成中”和“格式化完成”两个阶段清晰分开。

备选方案：
- 对流式文本实时做 Markdown 解析：体验上更统一，但中间态闪烁和结构跳变风险高。
- 引入后端结构化 rich-text AST：超出当前范围，而且会放大协议和持久化改动。

### 2. 新增独立的消息正文渲染组件边界，而不是继续直接渲染 `<p>`

应将消息正文从 `AgentSidebar` 内联 `<p>` 抽离为可复用的正文渲染单元，例如区分 `PlainTextMessageBody` 与 `MarkdownMessageBody`。其中：
- 流式消息与用户消息使用纯文本正文。
- 助理最终消息使用 Markdown 正文。

原因：
- 当前 `.chat-message p` 的样式只适用于单段文本，无法承载列表、代码块和表格。
- 独立正文组件可以让“选择哪种渲染器”成为显式决策，而不是在一个 `<p>` 上堆叠条件分支。
- 未来如果用户消息也要支持 Markdown，这个边界可以直接复用。

备选方案：
- 在 `AgentSidebar` 中通过条件表达式直接渲染 `ReactMarkdown`：实现短平快，但会让消息去重、打字机和正文样式逻辑继续耦合在一个文件里。

### 3. 表格与代码块在消息正文内部做局部横向滚动

对于 GFM 表格和 fenced code block，正文容器应提供局部滚动包装层，而不是让整个聊天气泡或整个右侧面板横向滚动。

原因：
- 当前右侧 sidebar 宽度有限，聊天气泡最大宽度约为侧栏的 `92%`。稍宽的表格和代码块都无法在固定宽度内完整显示。
- 局部滚动能保持消息泡整体布局稳定，只让超宽内容在内部滚动，更符合聊天界面预期。

备选方案：
- 强制单元格换行压缩表格：可读性差，特别是对齐型表格会失真。
- 让整个消息气泡横向滚动：会破坏聊天主区阅读体验。

### 4. 默认不允许原始 HTML

Markdown 渲染只启用 `remark-gfm`，不启用原始 HTML 解析。若未来需要更严格的白名单控制，再考虑接入 `rehype-sanitize`。

原因：
- 当前消息来自模型输出，直接允许 HTML 会扩大 XSS 和样式逃逸面。
- 第一版只需要 Markdown/GFM，不需要嵌入任意 HTML 片段。

备选方案：
- 允许原始 HTML：能力更强，但安全与样式治理成本不成比例。

### 5. 测试按“渲染边界”而不是“依赖实现细节”组织

测试需要覆盖三类边界：
- 助理最终消息能够正确渲染 Markdown/GFM 结构，尤其是表格与代码块。
- 流式阶段保持纯文本打字机，不因为 Markdown 渲染引入重复消息或提前结构化。
- 完成阶段从纯文本流式消息切换到 Markdown 最终态时，不出现重复消息或正文丢失。

原因：
- 当前 `agent-sidebar.test.tsx` 已经落后于最新 UI 结构，只验证旧版任务模块已经没有价值。
- 这次变更真正高风险的是“渲染阶段切换”，不是单纯某个 CSS 类是否存在。

## Risks / Trade-offs

- [Markdown 最终态与流式态存在一次视觉跳变] → 通过明确区分“生成中”和“最终阅读态”来接受这一切换，并保持切换时消息不重复、不闪烁。
- [表格和代码块在窄侧栏中容易破坏布局] → 为正文中的 `table` 和 `pre` 提供局部横向滚动与受限宽度样式，不让整个 bubble 扩张。
- [消息渲染组件拆分后，现有测试会大面积失效] → 在实现时同步重写相关单测，围绕渲染结果和状态边界断言，而不是旧版 sidebar 文案。
- [新增依赖带来体积和样式复杂度] → 仅引入 `react-markdown` 与 `remark-gfm`，不额外扩大插件链；优先使用现有 CSS 系统完成样式，而不是再引入一套 Markdown 主题。
- [未来如果用户消息也要支持 Markdown，当前第一版边界会显得不一致] → 先把助理消息做好，保留正文渲染组件边界，后续扩展时复用同一机制。
