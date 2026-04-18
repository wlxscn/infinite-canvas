## Why

当前画布里的对象编辑能力已经可用，但 hover、selected 和 editing 三种状态的视觉反馈并不统一：普通节点几乎没有通用 hover 预选中反馈，connector 又拥有单独一套锚点与 handle 样式，视频 overlay 的选中反馈也与 canvas 轮廓分离。这会让用户更容易“确认已经选中了什么”，却不容易“预判接下来会选中什么”，降低画布操作的直接性。

现在补这层反馈是合适的，因为三栏布局、刻度尺、吸附和锚点连线都已经落地，画布交互的核心结构基本稳定。继续堆能力之前，先把对象 hover / selection chrome 收敛成统一语言，能明显改善编辑感受，也能为后续多对象或更复杂节点类型打基础。

## What Changes

- 为画布对象增加统一的 hover 预选中反馈，使用户在 click 前就能感知当前命中的主要对象。
- 优化 selected 与 editing 两种状态的视觉层级，让普通节点、视频 overlay 和 connector 共享一致的反馈语言。
- 保持 connector 的锚点、端点和折线拐点编辑能力，但将其纳入统一的选中/编辑样式系统，而不是继续维持割裂的特殊表现。
- 明确 hover / selected / editing 三态的职责边界：hover 负责命中预览，selected 负责对象进入编辑上下文，editing 负责暴露可操作 handle。
- 保持现有节点模型、持久化 schema、撤销/重做和工具集合不变，不借此 change 引入多选、群组或新的对象类型。

## Capabilities

### New Capabilities

### Modified Capabilities
- `ai-design-canvas`: 画布对象需要提供一致的 hover、selected 和 editing 反馈，使用户可预判命中对象并清楚理解当前编辑上下文。

## Impact

- 主要影响 `packages/canvas-engine/src/controller-state.ts`、`controller.ts`、`scene.ts` 与相关命中逻辑，需要为普通节点建立通用 hover 状态并统一 selection chrome。
- 前端会影响 `apps/web/src/canvas/CanvasStage.tsx`、`VideoOverlayLayer.tsx`、`SelectionToolbar.tsx` 与 `index.css`，用于落地 hover / selected / editing 的样式层级和 overlay 表达。
- 不修改 `BoardDoc`、节点持久化结构或历史语义；旧项目读取和本地保存保持兼容。
- 需要补充单元测试与 E2E，覆盖 hover 命中反馈、选中样式一致性、connector 编辑态可见性，以及现有拖拽/缩放/重挂接行为不回归。
- 非目标：
  - 不引入多选、框选、群组或新的对象编辑工具。
  - 不在本次重做整体 workspace 布局或聊天/素材侧栏样式。
  - 不把 hover 优化扩展为复杂的智能命中预测或自动避让系统。
