## Context

当前画布的对象反馈分布在两条链路里：一条是 `packages/canvas-engine/src/scene.ts` 中 `drawSelectionOutline(...)` 负责的 canvas 内选中轮廓，另一条是 `apps/web/src/canvas/CanvasStage.tsx`、`VideoOverlayLayer.tsx` 和 `index.css` 中的 overlay / DOM 样式反馈。普通 `rect / text / image / video` 节点基本只有 selected 轮廓，没有通用 hover 预览；connector 则拥有锚点 hover、端点 handle 和折线 waypoint handle；视频节点还额外通过 DOM overlay 暴露 `.video-overlay-item-selected`。

这种结构在功能上能工作，但交互语言并不统一：hover 不是系统级状态，只在 connector 编辑场景中存在；selected 的视觉来源混合了 canvas 与 DOM；editing 也没有明确独立层级，导致用户需要 click 之后才知道对象是否命中。这个 change 需要在不改节点模型和持久化结构的前提下，把 hover / selected / editing 三态收敛成统一反馈系统。

Likely modules involved:
- `packages/canvas-engine/src/controller-state.ts`: 为普通节点补充通用 hover 状态，并定义 hover / selected / editing 的交互状态边界。
- `packages/canvas-engine/src/controller.ts`: 在 pointer move / pickTopCanvasNode 链路中维护 hovered node，并保证它与拖拽、缩放、connector 编辑不冲突。
- `packages/canvas-engine/src/scene.ts`: 为普通节点与 connector 提供统一的 hover / selected 轮廓渲染策略。
- `packages/canvas-engine/src/canvas-registry.ts` 与命中 helper：复用现有 top-hit 选择结果，不新增平行命中系统。
- `apps/web/src/canvas/CanvasStage.tsx`: 承接 hover / editing overlay，统一 connector handle 和普通节点 chrome 的视觉层级。
- `apps/web/src/canvas/VideoOverlayLayer.tsx`: 让视频 DOM overlay 的选中态与 canvas 主轮廓语言保持一致。
- `apps/web/src/components/SelectionToolbar.tsx`: 保持 contextual toolbar 与新 selection chrome 协同，不与 hover 态混淆。
- `apps/web/src/index.css`: 定义三态样式基线与对象类型间的一致表现。

## Goals / Non-Goals

**Goals:**
- 为普通画布节点建立通用 hover 预选中反馈，而不是只在 connector 锚点场景下存在 hover 语义。
- 明确 hover、selected、editing 三态的视觉与交互边界，并让普通节点、connector、视频 overlay 的反馈语言一致。
- 保持 connector 的端点/拐点编辑能力，但让其作为 editing 态的一部分表达，而不是完全独立的特殊样式。
- 不改变现有节点模型、工具集合、撤销/重做和持久化兼容性。
- 用增量方式扩展现有 engine 与 overlay，而不是新建第二套“交互层系统”。

**Non-Goals:**
- 不引入多选、框选、group、锁定或新的节点类型。
- 不大改 workspace 三栏布局、侧栏结构或聊天/素材系统的样式。
- 不将此变更扩展为全新的设计系统重构。
- 不修改 connector 的 attachment、polyline 数据模型或导出格式。

## Decisions

### 1. 将普通对象 hover 提升为系统级状态，而不是继续只维护 `hoveredAnchor`

在 `CanvasInteractionState` 中增加通用 `hoveredNodeId`，其来源是 `select` 模式下 pointer move 对 `pickTopCanvasNode(...)` 的结果。connector 的 `hoveredAnchor` 继续保留，但属于 connector 工具或编辑态下的补充状态，而不是通用 hover 的替代品。

Why:
- 当前缺的不是单个组件样式，而是“对象 hover 是不是一等状态”的系统定义。
- 复用现有 top-hit 命中逻辑最稳，不需要新增并行的 hover hit test 管道。
- 将 hover 从 connector 专属状态提升为通用状态后，普通节点与 connector 才能共享统一三态语言。

Alternative considered:
- 只改 CSS，不增加 `hoveredNodeId`，通过 DOM hover 或 canvas 事件临时表现。
Rejected because 这会让 hover 仍然是零散的表现层技巧，无法稳定作用于 canvas 绘制、overlay 和视频节点。

### 2. 将对象反馈拆成三层：canvas 轮廓、overlay handle、contextual toolbar

本次不把所有反馈都塞进一个层级里，而是明确：
- canvas 层：负责对象边界的 hover / selected 轮廓
- overlay 层：负责 editing 态的 resize handle、connector 端点与 waypoint handle
- toolbar 层：负责 selection 上下文操作

Why:
- 当前 canvas 与 DOM 已经混合存在，继续把所有东西都画进 canvas 会放大复杂度。
- handle 属于 editing 语义，天然更适合 overlay。
- 这样能避免 hover 一出现就把所有编辑 affordance 都暴露出来。

Alternative considered:
- 把 hover、selected、editing 全部统一绘制在 canvas 内。
Rejected because connector handle、视频 overlay 和 contextual toolbar 已经在 DOM / overlay 层，强行全部画进 canvas 会造成更大重构。

### 3. 采用“轻 hover、明确 selected、操作型 editing”的层级语言

三态职责定义如下：
- `hover`: 仅表示“如果现在 click，会选中这个对象”，使用轻量轮廓或柔和强调，不显示完整编辑 handle
- `selected`: 表示对象进入编辑上下文，显示稳定明确的轮廓，并允许 selection toolbar 贴附
- `editing`: 表示对象正处于可操作细节编辑中，显示 resize / connector endpoint / waypoint 等 handle

Why:
- 这能避免当前 `rest -> selected` 的突变式反馈。
- hover 如果过重，会和 rulers、snap guides、connector anchor 同时竞争注意力。
- editing 需要与 selected 区分，否则 connector handle 和普通对象 handle 会让画面显得噪杂。

Alternative considered:
- hover 时就显示完整 handle。
Rejected because 这会让画布信息密度过高，并与 connector 锚点 hover 打架。

### 4. connector 保持专属可编辑结构，但在视觉语言上服从统一规则

connector 仍然保留：
- anchor hover
- endpoint handle
- polyline waypoint handle

但它们要遵循与普通对象一致的状态层级：
- hover：线段命中后先给轻量 hover 轮廓
- selected：统一选中主轮廓
- editing：再暴露 endpoint / waypoint handles

Why:
- connector 的交互语义确实比普通节点复杂，不能硬压成同一组 handle。
- 但如果继续维持一套完全独立的高亮语言，画布状态会割裂。

Alternative considered:
- connector 完全沿用现在的特殊样式，不纳入统一 selection chrome。
Rejected because 这正是当前视觉不统一的来源之一。

### 5. 不改文档模型，只改交互派生状态和渲染输出

此次 change 不引入新的持久化字段，不修改 `BoardDoc` 或节点 schema。hover / selected / editing 都是运行期派生状态；selected 仍通过现有 `selectedId` 表达，hover 则通过新增运行期状态维护。

Why:
- 这是交互和视觉优化，不应污染持久化模型。
- 旧项目和本地保存必须零迁移。
- 这也让 rollback 成本更低。

Alternative considered:
- 把 hover 或 selection chrome 的偏好写入文档。
Rejected because 没有必要，且会让视觉状态污染内容状态。

## Risks / Trade-offs

- [hover 状态过重会让画布噪音明显上升] → 将 hover 限制为轻轮廓，不显示完整 handle，避免与 ruler / snap / anchor 竞争。
- [普通节点与 connector 的反馈仍可能不完全一致] → 统一三态职责，再允许 connector 在 editing 层保留必要特例。
- [video overlay 的 DOM 边框与 canvas 轮廓可能双重叠加] → 明确视频选中主反馈由哪一层主导，并压缩另一层到补充状态。
- [增加 `hoveredNodeId` 后 pointer move 频率更高] → 复用现有 top-hit 逻辑，并只在 hover 结果变化时触发必要渲染。
- [hover 与 drag / resize / connector 编辑可能冲突] → 仅在空闲 `select` 场景维护 hover，进入 active interaction 后冻结或清空 hover 状态。

## Migration Plan

- 先在 controller-state 和 controller 中引入通用 hovered node 状态，并接到现有命中链路。
- 再调整 `scene.ts` 的 hover / selected 轮廓绘制逻辑，使普通节点与 connector 共享统一三态语言。
- 然后在 `CanvasStage.tsx`、`VideoOverlayLayer.tsx` 和 `index.css` 上收敛 overlay / DOM 层样式与 handle 层级。
- 最后更新测试，验证 hover 命中、selected chrome 和 connector editing 反馈不回归。
- 因为不改文档模型和持久化结构，所以不需要迁移脚本；如需回滚，可直接回退交互和样式文件。

## Open Questions

- hover 态是否需要覆盖 connector 线段本体，还是保持线段只有 selected 后才明显强化？
- 普通节点的 selected 轮廓是否要继续使用虚线，还是换成更稳定的实线/双层轮廓？
- 视频节点的主选中反馈应该以 DOM overlay 为主，还是以 canvas 主轮廓为主？
