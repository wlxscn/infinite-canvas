## Context

当前画布的选择交互已经具备单选、组合键追加单选、组内上下文选择以及多选状态展示，但缺少“在空白区域按下并拖拽形成选择框”的交互链路。现有选择逻辑主要集中在 `packages/canvas-engine/src/controller.ts`，渲染反馈集中在 `packages/canvas-engine/src/scene.ts`，而 `apps/web/src/canvas/CanvasStage.tsx` 负责把 pointer 输入和 controller 状态接回 React。

这次改动跨越交互状态机、画布渲染和测试，但不需要变更项目文档模型。现有 `selectedIds`、`getNodesInContext`、`getCanvasNodeBounds` 已经提供了多选、组内作用域和统一边界计算的基础，适合在当前架构上增量扩展，而不是增加一套平行的选择系统。

## Goals / Non-Goals

**Goals:**

- 在 `select` 工具下支持从空白区域拖拽生成框选矩形，并在松开后批量更新 `selectedIds`。
- 保持与现有单击选中、Shift/Ctrl/Cmd 追加选择和激活组上下文语义一致。
- 让框选只影响选择状态，不写入文档，不改变 persistence 和 undo/redo 语义。
- 为 controller 层和端到端交互补充测试，覆盖根层与组内两类作用域。

**Non-Goals:**

- 不新增独立的“框选工具”或新的工具栏入口。
- 不修改画布文档结构，不引入持久化迁移。
- 不在本轮为 connector 提供框选命中规则。
- 不实现按拖拽方向切换“包含”与“相交”两种高级框选模式。

## Decisions

### 1. 在现有 controller 状态机中增加 `marquee-selecting`

框选是一次短生命周期的 pointer 交互，最合适的位置仍是 `packages/canvas-engine/src/controller-state.ts` 与 `controller.ts`。新增 `pointerMode` 和一段临时 `selectionBox` 状态，可以复用现有的 `renderCurrent()`、`onStateChange`、pointer down/move/up 生命周期，而不需要把框选判断拆到 React 层。

备选方案是把框选矩形完全放在 `CanvasStage` 内部用 React state 管理，再在松手后调用 selection API。这个方案会把 hit-testing 与组上下文逻辑拆散到两层，容易和现有 controller 的拖拽、resize、connector 编辑优先级冲突，因此不采用。

### 2. 仅在“按下空白区域”时进入框选，节点命中仍优先走现有拖拽逻辑

框选不能抢占已存在的节点拖动、resize handle 或 connector handle 交互。`handlePointerDown` 中仍保留当前优先级：先判断已选节点可编辑 handle，再判断命中对象；只有命中结果为空时，才进入 `marquee-selecting`。这样可以保持用户对当前操作手感的预期，并避免把“拖动节点”误识别成“框选开始”。

### 3. 框选命中使用当前上下文节点列表 + 统一 bounds 相交规则

命中集合直接复用 `getNodesInContext(board, activeGroupId)`，这样根层和组内上下文天然一致。节点是否被选中，统一使用 `getCanvasNodeBounds(node, board)` 与框选 bounds 的相交关系判定，第一版不做“必须完全包含”区分。

备选方案是按对象类型分别做精细几何命中，例如 freehand 用点集、text 用排版框、group 用内部内容范围。这个方案复杂度更高，且第一版收益不大，因此暂不采用。

### 4. connector 暂不参与框选集合

connector 的 bounds 通常覆盖较长路径，若直接使用 bounds 相交，很容易出现擦边误选。当前 proposal 已明确 connector 非目标，因此在框选命中过滤阶段直接排除 `connector`，保留后续单独设计空间。

### 5. 框选可视化放在 `scene.ts`，作为临时交互层

框选矩形应由 canvas 渲染，而不是额外叠一个 DOM 层。这样可以直接使用 world/screen 坐标变换，与缩放和平移保持一致，也能和现有 hover/selected chrome 统一刷新。实现上在 `renderScene` 里根据 controller state 追加一个半透明矩形和虚线边框即可。

### 6. 选择状态更新复用既有 `onSelect`/`selectedIds` 语义

框选完成后不引入新的 store API，而是在 controller 内根据当前修饰键决定：
- 无修饰键：直接替换为框选结果
- `Shift/Ctrl/Cmd`：与当前 `selectedIds` 做追加或切换

如果现有 `onSelect` 接口不足以一次提交多选结果，则扩展 controller 与 React 层的选择回调，使其可以提交整组 `selectedIds`，但仍以当前 store 的 `setSelectedIds` 为唯一状态入口。

## Risks / Trade-offs

- [Risk] 框选状态与已有拖拽/resize/connector 编辑优先级冲突，导致误进入框选 → Mitigation：保持 pointer down 判定顺序，把“命中空白区域”作为框选前置条件，并为 controller 增加状态单测。
- [Risk] 在 active group 中误选根层节点或父 group → Mitigation：所有框选命中只基于 `getNodesInContext` 返回值，不直接遍历 `board.nodes`。
- [Risk] 使用 bounds 相交会让边缘擦碰也被选中，体验可能与部分设计工具不同 → Mitigation：在 spec 中明确第一版命中规则，后续如需要再独立引入方向性框选策略。
- [Risk] connector 被 bounds 误选影响可用性 → Mitigation：本轮显式排除 connector，并在测试中固定这一行为。

## Migration Plan

该改动不涉及文档 schema、持久化字段或服务接口迁移。发布策略为直接随前端代码上线。

如果上线后发现框选与现有拖拽冲突，回滚策略是移除 `marquee-selecting` 状态和对应渲染逻辑，保留 `selectedIds` 的现有多选能力，不影响已保存项目数据。

## Open Questions

- 当前多选追加逻辑对单击已支持 toggle；框选追加阶段是否也需要“已命中节点从当前选择中切出”的 toggle 语义，还是仅做并集。实现时先保持与现有修饰键语义一致。
- 后续若用户希望 connector 参与框选，是采用路径几何命中还是单独的“完全包围才选中”规则，需要后续单独设计。
