## Why

当前连线只支持直线和折线，两者都能表达结构关系，但在流程图、概念图和画布排版里，用户常常需要更柔和、更具方向感的连接路径。缺少曲线会让交叉连线显得生硬，也会限制用户在视觉上弱化线段转折、避开对象边缘和形成更自然的层次关系。

本次变更需要补齐 connector 的曲线路径能力，但范围保持聚焦，只扩展现有 connector 的路径模式和编辑体验，不改 attachment 语义、不引入新的节点类型，也不在本轮加入高级路由算法。

## What Changes

- 为 connector 增加曲线路径模式，使连线可表示为平滑曲线而不仅是直线或折线。
- 让曲线 connector 与现有 anchored connector 语义兼容，起点和终点仍可附着在节点锚点上。
- 为曲线 connector 提供可编辑控制点或等价的曲率编辑 affordance，使用户能调整曲线形状。
- 保持曲线 connector 的选中、hover、编辑、持久化和撤销重做行为与现有 connector 体系一致。
- 补充单元测试与端到端测试，覆盖曲线创建、编辑、重挂接和刷新恢复。
- 明确非目标：不实现自动避障路由、不引入独立贝塞尔绘图工具、不改变 connector 的删除/分组/历史语义。

## Capabilities

### New Capabilities

### Modified Capabilities

- `ai-design-canvas`: 扩展 connector 路径模式，使 anchored connector 支持可创建、可编辑、可持久化的曲线路径

## Impact

- 受影响代码主要集中在 `packages/canvas-engine` 的 connector 模型、路径解析、命中测试与编辑状态，以及 `apps/web` 的工具栏、overlay 和测试。
- 不涉及新的服务接口或外部依赖，但会影响本地项目文档中 connector 的持久化字段，需要明确旧项目兼容策略。
- 现有 straight / polyline connector 行为应保持不变，曲线路径作为增量模式加入。
