## Context

当前 connector 已经支持 `straight` 与 `polyline` 两种路径模式，数据模型集中在 `packages/canvas-engine/src/model.ts`、路径解析主要在 `anchors.ts` 与 `adapters/connector.ts`，交互状态集中在 `controller.ts` 和 `CanvasStage.tsx`。现有 polyline 使用 waypoint 表达折点，并通过 endpoint / waypoint handle 完成编辑。

曲线路径会影响的不只是渲染表现，还包括：
- 数据模型：曲线如何在文档中表示
- 路径解析：如何从 endpoint 与控制点推导实际绘制路径
- 命中测试：曲线 hover / selection 不能继续只按折线段处理
- 编辑 affordance：用户如何调整曲率
- 持久化与兼容：旧 connector 没有曲线路径字段时如何继续可读

## Goals / Non-Goals

**Goals:**

- 为 connector 增加第三种路径模式，支持平滑曲线。
- 让曲线 connector 与现有 attached endpoint 兼容，节点移动、旋转和重挂接后仍保持正确路径。
- 提供最小可用的曲线编辑 affordance，使用户能调整曲线形状而不是只生成默认曲线。
- 保持曲线 connector 的 selected / editing / persistence / undo redo 语义与现有 straight / polyline connector 一致。
- 为 engine 和 e2e 增加覆盖曲线创建、编辑、重挂接和恢复的测试。

**Non-Goals:**

- 不实现自动避障、智能路由或根据周边对象自动重新绕行。
- 不引入新的“曲线绘制工具”；仍沿用当前 connector 工具和路径模式切换。
- 不在本轮支持多段复合贝塞尔或任意数量曲线控制点编辑器。
- 不改变 connector 的 attachment 数据结构和删除语义。

## Decisions

### 1. 曲线路径作为现有 connector 的新 `pathMode`

不新增新的 node type，而是在现有 `ConnectorPathMode` 中加入例如 `curve` 的新模式。这样工具栏、持久化、撤销重做和选择逻辑都可以继续沿用 connector 现有入口。

备选方案是新增 `curved-connector` 节点类型。这个方案会让渲染和编辑分叉过多，也会放大持久化和历史兼容成本，因此不采用。

### 2. 第一版使用单段贝塞尔曲线和有限控制点模型

第一版更适合使用单段二次或三次贝塞尔曲线，并限制控制点数量，让曲线表达和现有 polyline waypoint 一样维持在“少量关键点可编辑”的复杂度。这样可以在不引入复杂 path editor 的前提下得到足够可用的曲线表达。

备选方案是直接支持多段连续贝塞尔。这个方案灵活，但会明显扩大控制点编辑、命中测试和持久化复杂度，因此不采用。

### 3. 曲线编辑 affordance 进入 connector editing 层，而不是 hover 层

曲线控制点应该像 endpoint / waypoint handle 一样，只在 connector 进入 editing 态后暴露。hover 和 selected 仍保持轻量，不让曲线引入新的视觉噪音。

备选方案是选中曲线 connector 后始终显示全部控制点。这个方案更直观，但会让普通选中态过重，因此不采用。

### 4. 曲线命中测试与路径解析统一放在 engine

渲染、bounds 与 hit-test 必须共享同一套曲线几何推导，不能在 web 层单独拼 path。应优先扩展 `packages/canvas-engine` 的 connector adapter 和解析 helper，让 canvas 绘制、hover 和 selection 使用同一条路径结果。

备选方案是先只在渲染层画曲线，命中仍按直线近似。这个方案会导致看起来是曲线、选中却是直线段的错位，因此不采用。

### 5. 持久化采用增量字段并保持旧项目兼容

曲线 connector 应通过新增可选字段表达控制点或曲线参数；旧项目没有这些字段时仍按现有 straight / polyline 解析。这样无需迁移脚本，已有项目保持可读。

备选方案是重写 connector 路径结构为统一 path DSL。这个方案更通用，但超出本次范围，因此不采用。

## Risks / Trade-offs

- [Risk] 曲线几何会让 hit-test 和 bounds 复杂度上升 → Mitigation：把解析、绘制、命中统一收敛到 engine，不在多层重复实现。
- [Risk] 控制点过少会限制表达力，过多又会让编辑过重 → Mitigation：第一版只支持有限控制点模型，先验证基础交互。
- [Risk] 曲线与旋转中的锚点同步叠加后更容易出现路径异常 → Mitigation：复用现有 endpoint 解析，曲线只建立在已解析的世界空间端点之上。
- [Risk] 工具栏继续膨胀路径模式入口 → Mitigation：沿用现有 connector path mode switch，不新增独立工具。

## Migration Plan

该改动需要为 connector 持久化新增可选字段，但不应破坏旧项目读取。上线策略是：

- 旧 connector 文档不带新字段时继续按原 straight / polyline 逻辑解析
- 新建曲线 connector 时写出新字段
- 如需回滚，可忽略新模式并保留已有 straight / polyline 行为

## Open Questions

- 第一版应使用二次贝塞尔还是三次贝塞尔，控制点数量和心智模型哪个更稳。
- 曲线模式下是否允许从当前 polyline 一键转换，还是只支持新建曲线 connector。
- 曲线控制点是否需要在工具栏提供“重置曲率”或“镜像控制柄”等辅助操作。
