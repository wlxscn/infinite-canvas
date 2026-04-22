## Context

当前 connector 相关的运行期状态已经分成两层：`packages/canvas-engine/src/controller.ts` 在连线工具或 endpoint 编辑过程中通过 `findAnchorTarget(...)` 计算单个 `hoveredAnchor`，而 `apps/web/src/canvas/CanvasStage.tsx` 中的 `CanvasAnchorOverlay` 会在 `tool === 'connector'` 时直接遍历 `getAllDescendantNodes(board.nodes)`，渲染所有节点的全部锚点。结果是命中层面已经是“按 proximity 命中单点”，显示层面却仍是“进入工具即全量暴露”。

这次改动主要涉及 interaction state、overlay 派生渲染和测试，不需要改变 connector 文档模型。现有代码已经具备大部分基础能力：`hoveredAnchor` 可表达当前命中的单个锚点，`getNodesInContext(...)` 可表达当前 group 作用域，`findAnchorTarget(...)` 已经具备 tolerance 命中逻辑。但因为用户已经明确要“靠近节点就显示该节点锚点”，本次不再是简单复用 `hoveredAnchor.nodeId` 的视觉调整，而是需要补出一个独立于 anchor hit 的 node-level proximity 语义。

## Goals / Non-Goals

**Goals:**

- 让连线工具默认保持干净画面，不再一次性显示全画布所有锚点。
- 当指针接近可连接节点本体时，只暴露该节点的四个锚点，并继续对当前命中的锚点提供高亮反馈。
- 让锚点暴露范围与当前编辑上下文保持一致，在激活 group 时不泄漏根层或其他上下文节点的锚点。
- 让节点 proximity、锚点命中与最终吸附使用同一套上下文和候选范围，避免显示和实际可操作结果错位。
- 保持 connector 创建、endpoint 重挂接、polyline waypoint 编辑和现有 selection chrome 语义不变。
- 为 proximity 暴露规则补充单元测试与端到端测试，防止回归到“进入工具即全量显示”。

**Non-Goals:**

- 不修改 connector 的 attachment、polyline 或 persistence 数据结构。
- 不引入新的 pointer mode、工具栏入口或独立的“显示锚点”模式。
- 不在本轮重做 connector 线段 hover 样式、endpoint handle 视觉样式或整体 selection chrome 体系。
- 不扩展到按拖拽方向、压力或其他高级手势改变锚点显示规则。

## Decisions

### 1. 将锚点 overlay 从“全量渲染”改为“基于邻近节点渲染”

`CanvasAnchorOverlay` 不再在 connector 工具下直接渲染 `getAllDescendantNodes(board.nodes)` 的全部锚点，而是只渲染当前“邻近节点”的四个锚点。这里的“邻近节点”来自现有命中链路附近的可连接 box node，而不是另起一套 DOM hover 规则。

这样做能把当前已有的 `hoveredAnchor` 扩展成更清晰的两层反馈：
- 附近节点：显示四个可连接锚点
- 命中锚点：在这四个锚点中高亮当前目标

备选方案是只渲染 `hoveredAnchor` 单点，或者仅在接近某个锚点时才显示该节点锚点。这个方案视觉最干净，也最容易复用现有状态，但不符合“靠近节点就显示该节点锚点”的交互目标，因此不采用。

### 2. 邻近节点使用独立于锚点命中的 node-level proximity 状态

当前 controller 已经能在 pointer move 中通过 `findAnchorTarget(...)` 计算单个 `hoveredAnchor`，但这只能表达“已经靠近某个锚点”，不能表达“已经靠近某个节点本体，但尚未命中其中任一锚点”。因此需要在运行期状态中新增一个轻量的 node-level proximity 状态，例如“当前应暴露锚点的节点 id”，并将其与 `hoveredAnchor` 并存。

设计上优先选择扩展现有 `CanvasInteractionState`，增加一个轻量的 proximity 节点派生状态，并只在空闲连线态、连线拖拽态和 endpoint 编辑态更新它。这样 `CanvasStage` 无需自行重复做 proximity 判断，状态来源也继续保持在 controller 内部。交互层级应明确为：
- 接近节点：暴露该节点四个锚点
- 命中锚点：高亮单个锚点
- 开始拖拽：以当前命中锚点作为起点或目标

备选方案是让 `CanvasAnchorOverlay` 在 React 层根据 pointer 坐标和 board 自己重复计算附近节点。这个方案会复制 hit-testing 逻辑，并容易与 controller 的 pointer mode 边界失步，因此不采用。

### 3. 节点 proximity、锚点命中和最终吸附必须共用同一候选范围

当前 overlay 用 `getAllDescendantNodes(board.nodes)` 收集锚点，而 connector 的起笔、拖拽和 endpoint 重挂接命中也直接对 `currentBoard.nodes` 执行 `findAnchorTarget(...)`。新的显示策略必须把这两类逻辑统一到同一候选集合：当前上下文中真正允许连接的节点。

这意味着同一套候选范围要同时决定：
- 哪个节点可以进入 proximity 态并显示锚点
- 哪个节点上的锚点可以进入 `hoveredAnchor`
- 拖拽或重挂接时最终允许吸附到哪些节点

否则会出现三类错位：
- 看见某节点锚点，但实际上不能吸附
- 看不见某节点锚点，却仍能被吸附
- group 上下文里泄漏上下文外节点的连接目标

备选方案是保持“命中按当前上下文，显示按全局”，只解决默认全量显示的问题。这个方案虽然实现更快，但会继续让 affordance 与真实可操作范围不一致，因此不采用。

### 4. 不修改 connector schema，所有变化保持为运行期派生状态

这次变更只收敛交互反馈，不改变 connector 的 `start/end` attachment、polyline waypoint 或任何持久化字段。无论是邻近节点 id、当前命中锚点，还是 overlay 是否显示，都只存在于 `CanvasInteractionState` 和渲染派生层。

这样可以保证：
- 旧项目零迁移
- undo/redo 不新增文档层 mutation
- 回滚成本低，只需撤回运行期状态和 overlay 逻辑

备选方案是把“锚点显示偏好”或“最近目标”写入 store / project。这个方案会污染内容状态，没有必要，因此不采用。

### 5. 节点 proximity 先按节点邻近带实现，不把本次范围扩大到新的精确几何系统

由于本次目标是“靠近节点就显示锚点”，而不是“进入节点就立即连线”，node-level proximity 不需要与 anchor hit 完全重合。第一版更适合基于节点本体外扩的邻近带判断当前 proximate node，再在该节点内继续用现有 anchor tolerance 判断 `hoveredAnchor`。

这样可以保持：
- 节点 proximity 先于锚点命中
- 锚点显示比最终吸附更早暴露，帮助可发现性
- 不把本次变更扩大成新的精确 hover 几何系统

后续如 rotation change 落地并要求更高精度，可将该邻近带从普通 bounds 外扩逐步演进到旋转后的真实几何外扩，但不阻塞本次 change。

备选方案是直接把 proximity 与 anchor hit 绑定，只有接近某个锚点时才显示四锚点。这个方案实现更轻，但不符合用户已经明确的交互目标，因此不采用。

### 6. 测试策略分成 controller 单元测试和舞台交互测试两层

单元测试应覆盖：
- connector 工具空闲移动时，只有接近节点本体才产生可见锚点范围
- 远离所有节点时清空邻近节点与 `hoveredAnchor`
- 在 group 上下文中只暴露组内节点锚点
- 在同一节点 proximity 区内但尚未命中锚点时，四锚点已可见而 `hoveredAnchor` 仍可为空
- drawing / endpoint editing 时目标节点切换不会泄漏旧锚点

端到端测试应覆盖：
- 进入 connector 工具后初始画面不出现全量锚点
- 鼠标移动到节点附近后才出现该节点锚点
- 拖拽连线到另一个节点时只显示目标节点锚点并保持当前命中高亮

## Risks / Trade-offs

- [Risk] 节点 proximity 阈值过小会让锚点难以发现，过大又会重新引入画面噪音 → Mitigation：将节点 proximity 与 anchor tolerance 拆成两级阈值，并通过测试固定基础行为。
- [Risk] 新增邻近节点状态后，如果 pointer mode 切换时未及时清空，可能残留旧锚点 → Mitigation：把清空逻辑并入现有 `endInteraction()` 和非 connector 场景的 pointer move 分支。
- [Risk] group 上下文和 overlay / 命中 / 吸附作用域不一致，会出现“能看到但不能连”或“能连但看不到” → Mitigation：显示、命中和最终吸附统一依赖当前上下文节点集合，而不是一处看全局、一处看局部。
- [Risk] 只显示邻近节点四锚点后，首次接触该功能的用户可能不如全量显示直观 → Mitigation：保留当前命中锚点高亮，并让节点接近阈值与锚点阈值足够宽松，优先保证可发现性。

## Migration Plan

该改动不涉及 schema、持久化或服务发布依赖，可以作为前端交互优化直接上线。

若上线后发现 proximity 暴露规则影响连线可发现性，回滚策略是恢复旧的 overlay 收集逻辑，同时保留 controller 的现有命中与 attachment 能力，不影响任何已保存项目。

## Open Questions

- 邻近节点暴露时，是否需要对整个节点本体增加一层轻量 hover ring，帮助用户理解“为什么此时出现四个锚点”，还是只显示锚点本身即可。
- 对触屏场景是否需要沿用当前“不维护 hover”的处理，还是为 connector 工具单独设计长按后显示附近锚点的机制；本轮先保持现有 pointer type 边界不变。
- 在节点旋转能力落地后，node-level proximity 是否需要从普通 bounds 外扩升级为旋转后真实几何外扩，可以在 rotation change 实施时复查。
