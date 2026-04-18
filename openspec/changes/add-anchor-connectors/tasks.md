## 1. Connector Data Model

- [x] 1.1 扩展 `packages/canvas-engine/src/model.ts` 与 `apps/web/src/types/canvas.ts`，新增 `connector` 节点、端点 attachment 类型以及 `connector` 工具定义。
- [x] 1.2 更新本地持久化与相关 helper（如 `apps/web/src/persistence/local.ts`、store 读写路径），确保包含 connector 的文档可保存、恢复和导出，同时兼容旧项目读取。
- [x] 1.3 为节点删除与基础 mutation 路径补充 connector 清理语义，确保删除被连接节点时同步移除相关连线。

## 2. Rendering And Geometry

- [x] 2.1 在 `packages/canvas-engine/src/adapters/` 中新增 connector adapter，并在 `canvas-registry.ts` 注册，使连线进入统一绘制、边界和命中测试链路。
- [x] 2.2 增加锚点派生与端点解析逻辑，为 `rect`、`text`、`image`、`video` 提供四个边中点锚点位置计算。
- [x] 2.3 实现连线选中态、端点 handle 与命中容差策略，确保细线对象仍可被稳定选中和编辑。

## 3. Interaction State Machine

- [x] 3.1 扩展 `packages/canvas-engine/src/controller-state.ts` 与 `controller.ts`，新增 `connector` 工具下的创建预览、有效锚点命中和取消流程。
- [x] 3.2 在 `apps/web/src/canvas/CanvasStage.tsx` 中渲染锚点 hover 提示、连线预览与端点重挂接反馈。
- [x] 3.3 支持选中 connector 后拖动起点或终点 handle 重新挂接，并在无效释放时回退到原 attachment。
- [x] 3.4 保证普通节点拖拽和缩放时，关联 connector 根据 attachment 自动更新，而不破坏现有 pan/zoom、selection 和 resize 语义。

## 4. Workspace Integration

- [x] 4.1 更新 `apps/web/src/App.tsx`、`ToolDock` 和相关 UI 文案，暴露 connector 工具并保持现有工具切换体验一致。
- [x] 4.2 约束第一版支持范围，只在 box-like 节点上显示锚点，不让 `freehand` 暴露可连接端口。
- [x] 4.3 如有必要，补充轻量说明或空态提示，让用户理解 connector 工具需要从锚点到锚点完成连接。

## 5. Validation

- [x] 5.1 添加单元测试，覆盖 connector 数据模型、锚点派生、命中测试、节点删除联动和撤销/重做语义。
- [x] 5.2 更新 `apps/web/tests/e2e/canvas.spec.ts`，验证连线创建、端点重挂接、节点移动联动和 reload 恢复行为。
- [x] 5.3 运行 `pnpm test`、`pnpm test:e2e`、`pnpm lint` 和 `pnpm build`，确认锚点连线没有破坏现有画布编辑流程。
