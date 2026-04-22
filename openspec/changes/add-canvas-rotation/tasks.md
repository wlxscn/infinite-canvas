## 1. 文档模型与几何底座

- [ ] 1.1 扩展 `packages/canvas-engine/src/model.ts` 与 `apps/web/src/types/canvas.ts`，为支持旋转的节点补充角度字段，并明确旧文档缺省角度的兼容语义。
- [ ] 1.2 在 `packages/canvas-engine/src/geometry.ts`、`hierarchy.ts` 与相关 helper 中补充局部旋转、父级旋转传递、旋转后角点和 AABB 解析能力。
- [ ] 1.3 调整 `packages/canvas-engine/src/adapters/shared.ts` 与相关 adapter 的 bounds helper，使节点可同时提供真实旋转几何与派生 AABB。

## 2. 渲染、命中与 connector 解析

- [ ] 2.1 更新 `packages/canvas-engine/src/adapters/rect.ts`、`text.ts`、`image.ts`、`video.ts`、`group.ts` 的渲染与 hit-test 逻辑，使其基于旋转后的真实几何工作。
- [ ] 2.2 更新 `packages/canvas-engine/src/scene.ts` 中的 selection chrome、hover feedback、resize handle 与 rotate handle 渲染逻辑，使其与旋转后对象对齐。
- [ ] 2.3 调整 `packages/canvas-engine/src/anchors.ts`、`connector.ts` 与相关 world-space helper，使 connector 在节点或 group 子节点旋转后继续解析正确的锚点与路径。
- [ ] 2.4 明确 marquee selection、snap、ruler 与其他派生反馈继续使用旋转后 AABB，并校准相关 helper 的调用边界。

## 3. 交互状态与工作区入口

- [ ] 3.1 在 `packages/canvas-engine/src/controller-state.ts` 与 `controller.ts` 中增加旋转交互状态，保持 rotate 手势与 drag/resize 一样按一次手势提交历史。
- [ ] 3.2 更新 `packages/canvas-engine/src/canvas-registry.ts` 与 resize / rotate 命中链路，使 pointer 可在节点局部坐标系中执行旋转与缩放。
- [ ] 3.3 在 `apps/web/src/canvas/CanvasStage.tsx`、相关 hooks 和选择工具栏入口中接入 rotate handle 与旋转后的选中反馈。
- [ ] 3.4 校准 group 旋转后的拆组、选中和组内编辑语义，确保现有 group 流程不因旋转而失效。

## 4. 持久化与兼容性

- [ ] 4.1 更新 `apps/web/src/persistence` 与项目读取逻辑，使旧项目在缺少旋转字段时继续可读，并在保存时写出新角度信息。
- [ ] 4.2 校准 `apps/web/src/state/store.ts` 与相关 mutation，确保旋转、拆组和 connector 同步可以稳定进入 undo/redo 与项目切换流程。

## 5. 验证

- [ ] 5.1 为 `packages/canvas-engine` 增加单元测试，覆盖旋转后的 bounds、hit-test、group world 解析、connector 锚点同步和旧文档兼容读取。
- [ ] 5.2 为 `apps/web` 增加单元测试，覆盖 rotate handle 交互、旋转手势历史提交、group 拆组恢复与工作区选择反馈。
- [ ] 5.3 更新 `apps/web/tests/e2e/canvas.spec.ts`，覆盖“旋转节点 -> 刷新恢复 -> 撤销重做”和“旋转 group -> connector 同步 -> 拆组”的关键路径。
- [ ] 5.4 运行 `pnpm test`、`pnpm test:e2e`、`pnpm lint` 和 `pnpm build`，确认旋转能力未破坏现有画布流程。
