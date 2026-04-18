## Context

当前画布引擎只支持独立节点的绘制、命中、拖拽、缩放和持久化，节点类型主要是 `rect`、`freehand`、`text`、`image` 和 `video`。`packages/canvas-engine/src/model.ts`、`canvas-registry.ts`、各类 `adapters/*`、`controller.ts` 与 `apps/web/src/canvas/CanvasStage.tsx` 都默认“画布对象就是独立节点”，不存在节点间关系对象、锚点定义或连线交互状态。

这意味着如果直接把连线当成一条普通自由线，会失去“跟随节点移动、重挂接、可持久化关系表达”的核心价值；但如果单独引入并行的 `connections[]` 系统，又会与现有的 `selectedId`、图层顺序、命中测试和历史操作形成双轨结构。本次设计需要在尽量复用现有引擎的前提下，引入锚点连线的数据模型、渲染方式和交互状态机。

Likely modules involved:
- `packages/canvas-engine/src/model.ts`: 扩展连线节点与端点锚定数据模型。
- `packages/canvas-engine/src/adapters/`: 新增连线适配器，负责绘制、命中和边界计算。
- `packages/canvas-engine/src/canvas-registry.ts`: 注册连线节点类型，使其进入统一渲染与命中链路。
- `packages/canvas-engine/src/controller-state.ts`: 增加连线创建与端点重挂接相关状态。
- `packages/canvas-engine/src/controller.ts`: 实现 connector tool、锚点命中、预览线与端点编辑状态转换。
- `apps/web/src/types/canvas.ts`: 为工具类型和前端类型导出增加 connector。
- `apps/web/src/canvas/CanvasStage.tsx`: 渲染锚点提示和连线预览反馈，并接入新的工具状态。
- `apps/web/src/App.tsx` / `ToolDock`: 暴露连线工具入口。
- `apps/web/src/persistence/local.ts` 与相关 store/helper：确保连线节点可本地保存、恢复与导出。

## Goals / Non-Goals

**Goals:**
- 为支持的节点提供可连接的锚点，并允许用户基于锚点创建稳定连线。
- 将连线作为一等画布对象纳入统一渲染、命中、选择、撤销/重做和持久化体系。
- 在当前版本中支持创建直线或折线连线、选中连线、拖动端点重新挂接、编辑折线拐点以及节点移动时连线自动更新。
- 保持当前画布的 pan/zoom、节点拖拽、缩放和本地保存体验兼容。
- 使用尽量增量的方式扩展现有 canvas engine，而不是引入并行的关系系统。

**Non-Goals:**
- 不在本次实现自动避障、自动正交路由、复杂箭头样式、端点标签或连线文本。
- 不支持 `freehand` 节点作为锚点目标。
- 不把这次变更扩展成完整流程图编辑器或自动布局系统。
- 不改写聊天协议、素材系统或与连线无关的生成能力。

## Decisions

### 1. 将连线建模为新的 `connector` 节点，而不是单独维护 `connections[]`

`BoardDoc.nodes` 中新增 `connector` 类型。连线和现有节点一样进入 `canvas-registry`、adapter、命中测试、图层顺序和 `selectedId` 语义，而不是新增一套独立关系数组。

Why:
- 现有引擎的渲染、命中、选择、历史和图层管理全部围绕 `CanvasNode` 设计。
- 让连线成为节点可以复用 `upsertNode`、`removeNodeById`、`bringNodeForward` 等现有流程，避免双轨状态。
- 对 `CanvasStage` 和 `controller.ts` 来说，统一对象模型更容易接入工具状态机。

Alternative considered:
- 在 `BoardDoc` 上新增 `connections[]` 关系层。
Rejected because 这会引入与 `nodes[]` 并行的选择、排序、命中和历史语义，超出增量变更范围。

### 2. 连线端点使用“attached | free”的统一端点模型，但第一版仅通过交互创建 attached-to-attached 连线

为连线定义端点结构：
- `attached`: 记录 `nodeId` 与 `anchor` 标识
- `free`: 记录绝对世界坐标

第一版用户创建路径只允许从一个有效锚点拖到另一个有效锚点完成连接，不提供自由端点的直接创建 UI；但保留 `free` 端点数据类型，方便未来扩展以及在目标节点缺失时进行兼容处理。

Why:
- `attached` 端点是实现“节点移动时连线自动更新”的关键。
- 预留 `free` 端点类型可以避免未来重构端点 schema。
- 交互层先只做 attached-to-attached，可以显著降低状态机复杂度。

Alternative considered:
- 第一版仅定义 attached 端点，不保留 free 结构。
Rejected because 这会让未来扩展到自由端点或缺失目标兼容时需要再次修改持久化模型。

### 3. 第一版锚点只支持 box-like 节点的四个边中点

`rect`、`text`、`image`、`video` 提供 `north / east / south / west` 四个锚点，锚点位置从节点 bounds 派生，不把实际坐标持久化到普通节点数据中。`freehand` 不提供锚点。

Why:
- 现有 box 节点都有稳定的边界盒，容易从 bounds 派生锚点。
- 四个边中点足以覆盖第一版流程图/关系表达需求，同时保持 UI 简洁。
- 派生锚点能避免在节点移动和缩放时维护额外持久化坐标。

Alternative considered:
- 一开始就支持八点、中心点或按节点类型自定义 ports。
Rejected because 会显著提高命中和反馈复杂度，不利于第一版落地。

### 4. 交互入口使用专门的 `connector` 工具，而不是在普通选择态直接从锚点拖出连线

工具栏新增 `connector` 工具。处于该工具时，hover 支持节点可显示锚点；pointer down 在锚点上后进入连线创建状态，pointer up 命中有效终点锚点时创建连线。已有连线选中后，只允许拖动起点或终点 handle 重新挂接，不支持整条连线平移。

Why:
- 现有 `select` 模式已经承担节点选择、拖拽和缩放，如果再叠加锚点拖出语义，状态冲突会很大。
- 专门工具能把第一版状态机控制在增量范围内。
- 禁止整条连线平移，能让连线始终保持“关系对象”而不是普通几何线段。

Alternative considered:
- 在 `select` 模式下选中节点后显示锚点，并直接从锚点拖线。
Rejected because 这会让节点拖拽与锚点拖线共享同一入口，第一版更难稳定实现。

### 5. 连线几何是派生值，节点移动时自动重算，而不是在拖动节点时直接修改连线端点坐标

连线渲染时根据端点 attachment 与当前节点 bounds 计算实际起终点坐标。拖动、缩放或重排普通节点时，只改变节点自身；所有关联连线在下一次渲染中自动更新几何。

Why:
- 关系信息的源头应是“连到了哪个节点的哪个锚点”，而不是一组缓存坐标。
- 这能降低节点移动时的联动写入量，避免历史记录中出现一批伴随写入的连线坐标更新。
- 与当前渲染模型兼容，便于在 adapter 中实现。

Alternative considered:
- 节点移动时同步写回所有关联连线端点坐标。
Rejected because 容易导致模型冗余和历史语义膨胀。

### 6. 删除被连接节点时同步删除关联连线，保持第一版数据语义简洁

当普通节点被删除时，所有引用其 `nodeId` 的连线一并删除，而不是保留悬空端点。

Why:
- 第一版交互不暴露自由端点，保留悬空连接会让恢复和编辑语义变得模糊。
- 自动清理能让用户理解更直接，也更利于本地持久化兼容。

Alternative considered:
- 删除节点后把相关端点转换为 `free`。
Rejected because 这会让第一版在未提供自由端点 UI 的前提下出现难以解释的半成品状态。

### 7. Connector 需要支持 `straight | polyline` 两种路径模式，折线通过显式拐点数组建模

在现有 `connector` 节点上增加路径模式字段：
- `straight`: 起点到终点直接连线
- `polyline`: 起点、`waypoints[]`、终点组成折线路径

`waypoints` 使用世界坐标持久化，表示端点之间的中间拐点序列。折线的真实渲染路径始终由 `start -> ...waypoints -> end` 派生，而不是把完整 path 字符串写入模型。

Why:
- 这允许在不拆分 connector 节点模型的前提下扩展折线能力。
- `waypoints` 是最小且稳定的数据结构，既能表达单拐点也能表达多拐点。
- 把路径计算收敛在 adapter 和几何 helper 内部，能复用现有 hit test / bounds / selection 体系。

Alternative considered:
- 为折线新增独立 `polyline-connector` 节点类型。
Rejected because 这会让直线与折线重新分叉为两套对象模型，增加工具和持久化复杂度。

### 8. 折线创建默认走“单工具 + 默认折线路径 + 选中后编辑拐点”模式

`connector` 工具仍然是唯一创建入口。创建连线时，系统允许用户选择路径模式；若选择折线，默认生成一条带基础拐点的折线预览。创建完成后，用户可在选中态通过拐点 handle 调整已有折线路径。

第一阶段不要求用户在创建过程中逐点绘制多段路径，也不要求自动避开其他节点；重点是支持折线路径的保存、渲染和后续编辑。

Why:
- 保持现有工具状态机稳定，不把创建流程扩展成复杂的多段绘制模式。
- “创建后编辑拐点”比“创建时逐段落点”更容易与当前 selection / drag / resize 体系兼容。
- 这能提供足够可用的折线能力，同时把后续高级路由能力留给未来。

Alternative considered:
- 创建折线时让用户逐次点击落下每一个拐点。
Rejected because 这会显著扩大状态机和取消/确认语义，不适合作为当前 change 的增量扩展。

### 9. 折线拐点进入统一选中编辑语义，不新增独立编辑模式

当选中 `polyline` connector 时，系统展示：
- 起点与终点 handle，用于重挂接
- 中间拐点 handle，用于拖动调整
- 相邻拐点或端点之间的线段命中区域，用于整体选中

拖动拐点只修改对应 waypoint 的世界坐标；节点移动或缩放仅重算 attachment 对应的起终点，不自动改写中间 waypoint。

Why:
- 拐点编辑和端点重挂接都属于“选中 connector 后的局部编辑”，共享选中态更自然。
- 避免为折线再引入一套独立工具或模式切换。
- 保持历史记录粒度清晰：一次拐点拖动就是一次 connector 更新。

Alternative considered:
- 节点移动时自动重排全部折线拐点。
Rejected because 这会接近自动路由语义，超出当前范围且会让用户失去对折线路径的可预期控制。

## Risks / Trade-offs

- [连线命中区域过细，用户难以选中] → 为 connector adapter 增加 screen-space 容差命中，而不是按 1px 几何线直接判断。
- [新工具状态与现有拖拽/缩放状态打架] → 第一版通过专门 `connector` 工具隔离创建入口，并把端点重挂接限制在选中连线后的 handle 拖拽。
- [持久化模型变化可能影响旧项目读取] → 连线作为新增节点类型处理，旧文档保持可读；无连线的旧文档不需要迁移。
- [节点删除联动删线可能让部分用户意外] → 在 spec 中明确该行为，并通过撤销/重做保证可恢复。
- [折线拐点过多会让命中和选中变复杂] → 通过统一的 waypoint handle、大于几何线宽的命中容差和明确的选中态反馈降低误操作。
- [节点移动后折线可能看起来不够“聪明”] → 明确当前是手动控制拐点而非自动路由，节点变化只更新 attachment 端点，不自动重排中间 waypoint。
- [未来若要支持更高级路由，当前模型可能需要扩展] → 预留 `straight | polyline` 路径模式，并把 path 解析收敛在 connector adapter 与几何 helper 内部。

## Migration Plan

- 扩展 `CanvasNode` 联合类型与本地持久化读取，使 `connector` 成为可识别的新节点类型。
- 新增 connector adapter、锚点派生工具与端点解析逻辑，把连线纳入统一渲染和命中链路。
- 扩展 connector 几何模型与渲染逻辑，支持 `waypoints` 持久化、折线 bounds / hit test / selection 反馈。
- 为控制器增加 `connector` 工具和相应的状态转换，接入锚点预览与端点重挂接。
- 在选中态补充拐点 handle 的渲染与拖动编辑，并保证其与端点 handle、节点拖拽和缩放不冲突。
- 更新删除、撤销/重做、导出与恢复路径，确保连线节点与普通节点关系一致。
- 旧项目无需迁移脚本；不包含 connector 的文档按现状加载即可。若需要回滚，只需停止写入/读取 connector 节点并保留既有节点结构。

## Open Questions

- 第一版是否需要在选中普通节点时显示锚点，还是仅在 `connector` 工具激活时显示？
- 连线选中态是否需要支持箭头方向切换，还是先固定单一视觉样式？
- 折线创建默认应该生成单拐点还是双拐点路径，哪种对当前画布场景更自然？
- 如果后续需要 agent/tool effect 直接创建连线，是否要复用同一 `connector` 节点模型还是单独抽象指令层？
