## 1. 文档模型与层级底座

- [x] 1.1 扩展 `packages/canvas-engine/src/model.ts` 与 `apps/web/src/types/canvas.ts`，定义统一的 `group` 节点及其 children 局部坐标结构。
- [x] 1.2 更新 `packages/canvas-engine/src/hierarchy.ts` 与相关持久化读取逻辑，把现有 `container` helper 直接迁移为 `group` hierarchy helper，并删除旧类型兼容分支。
- [x] 1.3 在 `apps/web/src/state/store.ts` 中实现成组、拆分组、整体删除与整体调层级 mutation，并让这些操作进入现有 undo/redo 历史。

## 2. 几何、渲染与命中

- [x] 2.1 扩展 `packages/canvas-engine/src/canvas-registry.ts`、相关 adapter 与几何 helper，使 group 与子节点都能正确解析 world-space bounds 和 hit-test。
- [x] 2.2 更新 `packages/canvas-engine/src/scene.ts` 与 selection chrome 渲染链路，使 group 在整体编辑态与组内编辑态下都能正确呈现。
- [x] 2.3 保持 connector、锚点、吸附与 ruler 继续通过 group children 的 world-space 几何工作，不因统一命名而失去定位准确性。

## 3. 交互状态与导航语义

- [x] 3.1 在 `packages/canvas-engine/src/controller.ts` 中扩展受控范围内的选择路径，使用户能从当前选择创建 group。
- [x] 3.2 统一 group 的整体选择、拖拽、缩放、删除与拆分组行为，并保持“一次手势一条历史”的语义。
- [x] 3.3 保留进入组与退出组的导航状态，但将产品与运行期术语统一为 group，不再暴露 `container` 概念。

## 4. Web 工作区入口

- [x] 4.1 更新 `apps/web/src/components/SelectionToolbar.tsx`、`App.tsx` 与相关 view model，提供“成组 / 拆分组 / 进入组 / 退出组”的统一入口。
- [x] 4.2 在 `apps/web/src/state/store.ts`、`CanvasStage.tsx` 和相关 hooks 中接入 group 选择、组内编辑导航与 mutation 调度。
- [x] 4.3 校准文案与 affordance，移除或隐藏面向用户的 `container` 术语，统一使用 `group`。

## 5. 验证

- [x] 5.1 为 engine / store 层补充单元测试，覆盖 group 创建、拆分、局部坐标恢复、整体编辑、进入/退出组以及 `container` 术语和类型已被清除。
- [x] 5.2 更新 `apps/web/tests/e2e/canvas.spec.ts`，验证成组、拆分组、进入/退出组、持久化恢复以及与 connector 共存的行为。
- [x] 5.3 运行 `pnpm test`、`pnpm test:e2e`、`pnpm lint` 和 `pnpm build`，确认统一后的 group 能力未破坏现有画布流程。
