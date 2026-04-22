## Why

当前连线交互已经支持锚点吸附与 endpoint 编辑，但在进入 `connector` 工具后会一次性暴露画布中所有可连接节点的四个锚点，导致画面噪音过高，也削弱了 hover / selected / editing 之间已经建立的层级边界。随着 group、hover chrome 与旋转能力持续补齐，这种“全量暴露 affordance”的做法开始明显影响可读性，并让当前上下文范围变得模糊。

本次变更需要尽快把连线锚点反馈收敛为“按接近程度渐进暴露”的模式，但范围保持克制，只调整锚点的显示时机与作用域，不改 connector 数据模型、不引入新的连线工具模式，也不改变持久化格式。

## What Changes

- 调整连线工具下的锚点显示策略：默认不显示全画布所有锚点，只有指针接近可连接节点本体时才暴露该节点的锚点。
- 保持当前命中的锚点高亮，但将“附近节点的四个锚点可见”和“单个命中锚点高亮”区分为两层反馈。
- 将锚点暴露范围与当前编辑上下文对齐，在激活 group 时仅显示当前上下文内可连接节点的锚点。
- 统一节点 proximity、锚点命中与最终吸附的作用域规则，避免出现“看得见但不能连”或“看不见却能吸附”的状态错位。
- 保持 connector 创建、endpoint 重挂接与 polyline 编辑的现有能力不变，只收敛 affordance 的可见性规则。
- 补充对 proximity 命中、上下文范围和 connector 编辑场景的测试覆盖。
- 明确非目标：不修改 connector attachment 数据结构，不新增新的工具栏入口，不在本轮调整 connector 的路径命中或 hover 主轮廓语言。

## Capabilities

### New Capabilities

### Modified Capabilities

- `ai-design-canvas`: 调整 anchored connector 相关 affordance 的显示规则，使锚点只在接近当前上下文中的可连接节点时暴露，而不是在进入连线工具后全量显示

## Impact

- 受影响代码主要集中在 `packages/canvas-engine` 的锚点命中与交互状态，以及 `apps/web/src/canvas/CanvasStage.tsx` 和相关样式中的 overlay 渲染策略。
- 不涉及 `BoardDoc`、connector schema、持久化读写格式或 undo/redo 语义调整，旧项目数据保持兼容。
- 不引入新的外部依赖；主要影响前端交互反馈、画布视觉密度与对应测试用例。
