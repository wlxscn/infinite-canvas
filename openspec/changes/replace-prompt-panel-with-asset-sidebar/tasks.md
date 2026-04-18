## 1. Layout Restructure

- [x] 1.1 重构 `apps/web/src/App.tsx` 的工作区骨架，将现有“左侧浮层 + 整页画布 + 右侧聊天栏”调整为“Header + 左侧素材栏 + 中间画布工作区 + 右侧聊天栏”的三栏布局。
- [x] 1.2 从工作区中移除 `apps/web/src/components/PromptPanel.tsx` 的使用，并清理与其直接耦合的顶层布局占位与样式。
- [x] 1.3 更新 `apps/web/src/index.css` 中与 `prompt-panel`、`assets-panel`、`canvas-stage-wrap` 和侧栏偏移相关的布局规则，使中央画布宽度由左右侧栏状态自然驱动。

## 2. Asset Sidebar

- [x] 2.1 将 `apps/web/src/components/AssetsPanel.tsx` 重构为左侧素材管理侧栏，展示素材标题、导入动作、素材列表和空态说明。
- [x] 2.2 为左侧素材栏增加展开/收起状态与重新展开入口，并在 `App.tsx` 中接入对应的 UI 状态管理。
- [x] 2.3 保持现有素材插入逻辑，确保点击左侧素材项仍通过 `useCanvasGenerationController` 的插入路径将素材放入画布。

## 3. Conversation And Empty States

- [x] 3.1 调整 `apps/web/src/features/chat/components/AgentSidebar.tsx` 的说明文案和输入 placeholder，使右侧纯对话同时覆盖首版生成与后续迭代。
- [x] 3.2 重写 `apps/web/src/components/CanvasHero.tsx` 的空态叙事，使其引导用户通过右侧对话生成内容，并理解左侧素材栏的承接角色。
- [x] 3.3 更新左侧素材空态文案，明确“生成结果和上传素材会先出现在这里”，但不新增结构化生成表单。

## 4. Validation

- [x] 4.1 添加或更新单元测试，覆盖左侧素材栏展开/收起状态、素材列表展示与顶层布局相关的视图模型行为。
- [x] 4.2 更新 `apps/web/tests/e2e/canvas.spec.ts`，验证新三栏布局可见、左侧素材栏可展开/收起，以及右侧对话生成/左侧素材承接的核心路径。
- [x] 4.3 运行 `pnpm test`、`pnpm test:e2e`、`pnpm lint` 和 `pnpm build`，确认三栏布局与现有画布编辑交互未回归。
