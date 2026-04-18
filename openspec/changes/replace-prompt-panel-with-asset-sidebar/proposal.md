## Why

当前首页仍以左侧 `PromptPanel` 作为“首版生成入口”，而右侧 `AgentSidebar` 又承担后续对话迭代，导致用户需要在两个不同区域表达生成意图。与此同时，现有 `AssetsPanel` 只是一个浮层托盘，难以承担持续沉淀生成结果和上传素材的职责，使整体工作流停留在“启动面板 + 浮层素材 + 画布 + 对话”的混合状态。

现在需要把页面收敛为更清晰的三栏创作模型：右侧纯对话负责表达意图，左侧素材管理负责承接结果，中间画布负责编辑操作。这样可以减少重复入口，提高首屏信息架构一致性，并为后续扩展素材管理能力留下稳定布局基础。

## What Changes

- 移除左侧 `PromptPanel`，不再提供独立的左侧首版生成入口。
- 将现有 `AssetsPanel` 重构为可展开/收起的左侧素材管理侧边栏，用于展示上传素材和生成结果，并支持插入画布。
- 保持右侧 `AgentSidebar` 为纯对话入口，不新增结构化快捷生成区。
- 将首页和空态文案改写为“右侧表达需求 -> 左侧接收素材 -> 中间编辑画布”的三栏模型。
- 将工作区布局从“整页画布 + 左侧浮层 + 右侧侧栏”调整为“Header + 左侧素材栏 + 中间画布工作区 + 右侧对话栏”。
- 明确本次范围不包含素材删除、重命名、分组管理、搜索筛选或新的文档持久化字段。

## Capabilities

### New Capabilities

### Modified Capabilities

- `ai-design-canvas`: 调整首页工作区的信息架构与交互模型，使生成入口统一收敛到右侧纯对话，并将左侧升级为可折叠的素材管理侧栏。

## Impact

- 受影响的前端代码预计主要位于 `apps/web/src/App.tsx`、`apps/web/src/components/PromptPanel.tsx`、`apps/web/src/components/AssetsPanel.tsx`、`apps/web/src/components/CanvasHero.tsx`、`apps/web/src/features/chat/components/AgentSidebar.tsx` 以及对应样式文件。
- 该变更会修改 `ai-design-canvas` 的用户可见布局和生成流程，但不要求变更当前 `CanvasProject`、本地持久化格式、undo/redo 历史语义或画布文档结构。
- 需要更新单元测试和 E2E，用于覆盖新三栏布局、左侧素材栏展开/收起、空态引导以及“右侧对话生成 -> 左侧素材承接”的行为。
- 非目标：
  - 不新增素材删除、重命名、收藏、搜索或复杂筛选能力。
  - 不在右侧对话栏加入新的结构化 prompt 表单或图片/视频快捷生成区。
  - 不借此次变更重构 canvas engine、聊天协议或素材持久化模型。
