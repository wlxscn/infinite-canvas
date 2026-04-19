## 1. 交互状态与选择语义

- [x] 1.1 在 `packages/canvas-engine/src/controller-state.ts` 和 `packages/canvas-engine/src/controller.ts` 中新增框选交互状态、框选矩形数据和空白区域拖拽进入框选的 pointer 生命周期
- [x] 1.2 扩展 controller 与 `apps/web/src/canvas/CanvasStage.tsx` 的选择回调，使框选完成后可以按当前修饰键更新整组 `selectedIds`
- [x] 1.3 在框选命中阶段复用 `getNodesInContext` 与 `getCanvasNodeBounds`，并显式排除 connector，确保根层与激活组上下文行为一致

## 2. 画布反馈与测试

- [x] 2.1 在 `packages/canvas-engine/src/scene.ts` 中绘制框选矩形反馈，并保持与现有 hover/selection chrome 共存
- [x] 2.2 为 `apps/web/tests/unit/canvas-engine.test.ts` 增加框选状态机与组内作用域单元测试
- [x] 2.3 为 `apps/web/tests/e2e/canvas.spec.ts` 增加根层框选多选场景，并验证上下文工具栏显示多选结果；组内作用域由 controller 单元测试覆盖

## 3. 验证

- [x] 3.1 运行 `pnpm --filter @infinite-canvas/web test -- tests/unit/canvas-engine.test.ts`
- [x] 3.2 运行 `pnpm lint`
