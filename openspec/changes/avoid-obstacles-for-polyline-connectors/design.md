## Context

当前 connector 已支持 `straight`、`polyline` 和 `curve` 三种路径模式。`polyline` 的默认路径仍来自 `packages/canvas-engine/src/anchors.ts` 中的简单 waypoint 生成逻辑，只依据起终点与锚点方向给出固定折点，不会检查中间是否有节点占据路径。结果是用户在常见流程图布局中，即使选择了 polyline，也会得到直接穿过其他元素的默认路径。

这次变更的目标不是做完整智能路由系统，而是把“默认 waypoint 生成”升级为一次性的障碍物感知路由。范围仍保持在现有架构内：

- `packages/canvas-engine/src/anchors.ts`：扩展 polyline 默认路径求解逻辑，输入起终点、锚点方向和障碍物集合，输出 `waypoints`
- `packages/canvas-engine/src/controller.ts`：继续在 connector 创建和预览阶段调用默认路径生成，但不引入新的持续状态
- `packages/canvas-engine/src/hierarchy.ts` / 现有 world-space helper：复用已解析节点几何作为障碍物输入
- `apps/web/tests/unit/canvas-engine.test.ts` 与 `apps/web/tests/e2e/canvas.spec.ts`：验证默认路径不会穿过中间元素，并且创建后仍能正常编辑 bend point

约束包括：

- 保持当前 `ConnectorNode` 文档结构不变，不新增 route ownership 或 auto-routed 标记
- 保持创建后 `waypoints` 仍然是普通 polyline 数据，后续编辑不再触发自动重算
- 遵守当前 group / active context 语义，只在当前可连接上下文内采样障碍物

## Goals / Non-Goals

**Goals:**

- 让 polyline connector 在创建时优先生成一条避开中间元素的默认折线路径。
- 保持默认路径为正交折线，尽量少拐点，并遵守起终点锚点方向的“出头”语义。
- 当避障求解失败时稳定回退到现有简单默认 waypoint，而不是阻止 connector 创建。
- 保持现有数据模型、持久化和 undo/redo 语义不变。
- 为单位测试和端到端测试补充可验证的避障场景。

**Non-Goals:**

- 不在节点移动、resize、group 变化后持续自动重路由。
- 不为 curve connector 提供自动避障或“先求骨架再圆角化”的二阶段曲线路由。
- 不让 connector 之间互相视为障碍物。
- 不引入新的工具栏模式、route lock 状态或 schema 字段。

## Decisions

### 1. 只对 polyline connector 的默认路径生成启用避障

`polyline` 已经有 `waypoints` 作为路径骨架，最适合承接自动路由结果；`curve` 当前更接近表现层和手工编辑层，不适合在本轮混入自动避障。

备选方案是同时让 `curve` 也避障，但这会把问题升级成“先求骨架再平滑”或“直接求 obstacle-free bezier”，明显超出本轮范围，因此不采用。

### 2. 路由器只在创建和初始预览阶段运行一次

系统在 polyline connector 创建过程中，根据当前起终点和障碍物生成默认路径；connector 创建完成后，`waypoints` 就是普通用户数据，不再持续自动重算。

备选方案是节点移动后持续维持“不穿过元素”，但这会引入 route ownership、用户编辑被覆盖等新状态，因此不采用。

### 3. 优先采用正交路由，并保留稳定回退

默认路径应保持水平/垂直段和 90 度转折，这与 polyline 的既有视觉语言一致。路由器先尝试 obstacle-aware orthogonal route，失败时回退到当前简单 waypoint 规则，确保创建永远可完成。

备选方案是任意角度的自由 polyline 搜索。这个方案更灵活，但会降低路径可读性，也更难和当前 waypoint 编辑语义对齐，因此不采用。

### 4. 障碍物只纳入当前上下文中的 box-like 节点，排除起终点目标与 connector

第一版障碍物集合应只包含当前上下文中的 `rect / text / image / video` 世界空间 bounds；起点所属节点、终点所属节点和其他 connector 都不作为障碍物。这样可以避免“目标节点自己挡住自己”和 connector 之间互相放大复杂度。

备选方案是把 group 外框和 connector 也纳入障碍物，但这会让路由结果更难预测，也会把层级语义和 visual chrome 混进来，因此不采用。

### 5. 默认路径生成拆成“锚点出口段 + 中间连接段”

起点和终点不应直接在锚点位置开始网格搜索，而应先沿锚点方向各自走出一段安全出口，再连接这两个出口点。这样生成的折线路径更像 connector，而不是贴边抖动的网格线。

```text
anchor A -> start exit ──┐
                         ├─ orthogonal route ─┐
anchor B <- end exit  ───┘                    └─ target
```

备选方案是从锚点原点直接开始搜索，但这更容易产生紧贴节点边界的路径，因此不采用。

## Risks / Trade-offs

- [Risk] 一次性默认避障会让用户误以为系统之后也会持续自动绕行 → Mitigation：保持 scope 明确，创建后 waypoint 仍按普通 polyline 编辑语义工作，不新增“智能锁定”暗示。
- [Risk] 当前上下文中的障碍物判定过于保守或过于激进，可能导致路径过度绕远或仍然穿模 → Mitigation：第一版限制障碍物类型，并保留回退到简单默认路径的兜底。
- [Risk] 路由求解加入后会让创建时 pointer move 更重 → Mitigation：先采用轻量正交搜索和有限候选，不引入全局图结构；必要时只在 polyline 模式下运行。
- [Risk] 组上下文和世界空间 bounds 混用会让路径与实际可见对象错位 → Mitigation：复用现有 `getNodesInContext(...)` 与世界空间几何解析链路，保证连接目标与障碍物采样来自同一上下文。

## Migration Plan

本次变更不引入新的持久化字段，也不需要项目迁移：

- 旧项目中的 polyline connector 仍按已有 `waypoints` 解析
- 新建 polyline connector 仅在创建时写出更合理的 `waypoints`
- 如需回滚，可直接恢复到旧的默认 waypoint 生成逻辑，而不影响已保存文档可读性

## Open Questions

- 第一版正交路由应采用怎样的有限候选策略：简单 Manhattan 通道搜索，还是更明确的稀疏网格节点图。
- group 节点本身是否需要在某些场景下被视为障碍物，还是始终只看具体可连接子节点。
- 默认路径生成是否也应在 endpoint 重挂接时重新运行一次；产品上这很自然，但需要在测试中单独锁定。
