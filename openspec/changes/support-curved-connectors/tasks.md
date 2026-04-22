## 1. 数据模型与路径解析

- [x] 1.1 扩展 `packages/canvas-engine/src/model.ts` 与相关 shared types，为 connector 增加曲线路径模式和最小曲线参数字段，并明确旧文档兼容语义
- [x] 1.2 更新 `packages/canvas-engine/src/anchors.ts`、`adapters/connector.ts` 与相关 helper，使曲线 connector 可以解析绘制路径、bounds 和 hit-test

## 2. 交互与工作区入口

- [x] 2.1 调整 `packages/canvas-engine/src/controller.ts` 与 `controller-state.ts`，支持曲线 connector 的创建、控制点编辑和 endpoint 重挂接
- [x] 2.2 更新 `apps/web/src/App.tsx`、`components/ToolDock.tsx`、`canvas/CanvasStage.tsx` 和相关样式，使用户可以选择曲线路径模式并看到对应的 editing affordance

## 3. 持久化与验证

- [x] 3.1 更新 `apps/web/src/persistence` 与相关 store / compatibility 逻辑，确保曲线 connector 可保存、可恢复且不破坏旧项目读取
- [x] 3.2 为 `apps/web/tests/unit/canvas-engine.test.ts` 和相关 engine tests 增加曲线创建、控制点编辑、重挂接与恢复覆盖
- [x] 3.3 更新 `apps/web/tests/e2e/canvas.spec.ts`，覆盖曲线 connector 的创建、编辑、刷新恢复和撤销重做
- [x] 3.4 运行 `pnpm test`、`pnpm lint` 和必要的 `pnpm test:e2e`，确认曲线路径模式未破坏现有 connector 流程
