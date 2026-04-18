## 1. 文档模型与持久化基础

- [x] 1.1 扩展 `packages/canvas-engine/src/model.ts` 与 `apps/web/src/types/canvas.ts`，引入 `container` 节点和容器 children 结构，并明确子节点局部坐标语义。
- [x] 1.2 更新本地项目加载与保存链路，保证旧的平面文档仍可读取，新项目能够持久化容器层级结构。
- [x] 1.3 明确容器创建、将节点纳入容器、将节点移出容器和拆容器的 mutation 边界，并让这些操作进入现有 undo/redo 历史。

## 2. 几何、渲染与命中链路

- [x] 2.1 扩展 `packages/canvas-engine/src/canvas-registry.ts`、相关几何 helper 与 bounds/hit-test 逻辑，使其能解析容器内子节点的 world-space 几何。
- [x] 2.2 更新 `packages/canvas-engine/src/scene.ts` 与相关渲染入口，使 root 与 container editing context 下都能正确绘制容器和子节点。
- [x] 2.3 保持 `connector` 继续附着具体节点，并升级 attachment 解析链路以支持跨容器 world-space 锚点计算。

## 3. 交互状态与选择上下文

- [x] 3.1 扩展 `packages/canvas-engine/src/controller-state.ts` 与 `controller.ts`，引入“导航上下文 + 选择目标”的运行期状态，而不是只依赖单个 `selectedId`。
- [x] 3.2 实现 root 选择容器、进入容器、退出容器的状态切换，并保证进入/退出仅作为导航，不生成新的文档历史记录。
- [x] 3.3 调整 hover、selection、drag、resize 与 hit-test 行为，使其只作用于当前激活的编辑上下文。

## 4. Web 侧工作区与容器编辑体验

- [x] 4.1 更新 `apps/web/src/App.tsx`、`CanvasStage.tsx`、`SelectionToolbar.tsx` 和相关 view model，表达容器选中态、容器内部编辑态与退出 affordance。
- [x] 4.2 为容器提供创建入口和基础操作入口，并保证第一版不引入嵌套容器、自动布局或 clip/mask 等超范围行为。
- [x] 4.3 校准容器与现有刻度尺、吸附线、selection chrome 和 connector 工具的共存行为，避免层级化引入新的交互冲突。

## 5. 验证

- [x] 5.1 为 engine/store 层补充单元测试，覆盖容器文档读写、局部坐标解析、root/container hit-test、进入/退出上下文和 connector world 解析。
- [x] 5.2 更新 `apps/web/tests/e2e/canvas.spec.ts`，验证容器创建、进入/退出、容器内编辑、持久化恢复与旧项目兼容读取。
- [x] 5.3 运行 `pnpm test`、`pnpm test:e2e`、`pnpm lint` 和 `pnpm build`，确认层级编辑器基础能力未破坏现有画布流程。
