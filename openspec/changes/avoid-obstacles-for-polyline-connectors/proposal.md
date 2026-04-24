## Why

当前 polyline connector 只能基于起终点生成简单默认折线，不感知画布中间的其他元素，因此常常直接穿过节点本体。随着 anchored connector、group 和曲线路径能力已经补齐，这个限制开始明显影响流程图和结构图的可读性，需要先补上一层“创建时的一次性默认避障”，而不是直接进入持续智能路由。

## What Changes

- 为 polyline connector 增加创建时的一次性默认避障路径生成，使系统在连接两个有效锚点时优先生成不穿过中间元素的折线路径。
- 将默认 waypoint 生成从“固定一拐点”扩展为“障碍物感知的正交路由 + 回退策略”，但只在创建和初始预览阶段生效。
- 明确避障范围只作用于 polyline path mode，不改变 straight / curve 的现有行为，也不在本轮为 curve 引入自动避障。
- 明确自动避障不是持续状态：connector 创建完成后，`waypoints` 仍然是普通 polyline 数据；后续若用户手动编辑 bend point，系统不再持续重算。
- 保持现有 connector 文档结构兼容，不新增必须迁移的 schema 字段；避障结果直接写入现有 `waypoints`。
- 补充单元测试与端到端验证，覆盖 polyline 默认避障、回退路径和创建后编辑不回归。
- 明确非目标：不实现节点移动后的持续自动重路由、不引入全局 obstacle graph 系统、不让 connector 之间互相避让、不修改 curve connector 的默认行为。

## Capabilities

### New Capabilities

### Modified Capabilities

- `ai-design-canvas`: 修改 polyline connector 的创建行为，使其在创建时优先生成避开中间元素的默认折线路径

## Impact

- 受影响代码主要集中在 `packages/canvas-engine` 的 connector 默认路径解析、障碍物采样与创建交互链路，以及 `apps/web` 的 polyline connector 相关测试。
- 不涉及新的服务接口或外部依赖；本次变更应复用现有 `waypoints`、anchor、context node 和 controller 交互结构。
- 本地项目文档保持兼容，不新增必须迁移的字段；旧项目中的 polyline connector 继续按已有 `waypoints` 读取。
- 用户可见变化集中在 polyline connector 的“初始路径更合理”，而不是编辑模型、历史模型或工具栏入口变化。
