## 1. Interaction State

- [x] 1.1 扩展 `packages/canvas-engine/src/controller-state.ts` 与 `controller.ts`，为普通对象增加通用 `hoveredNodeId` 或等价运行期状态，并限定其只在空闲选择场景生效。
- [x] 1.2 复用现有 `pickTopCanvasNode(...)` 命中链路，确保 hover、drag、resize 与 connector 编辑状态之间不会互相覆盖或泄漏。

## 2. Selection Chrome

- [x] 2.1 更新 `packages/canvas-engine/src/scene.ts`，为普通节点和 connector 建立统一的 hover / selected 主轮廓表达。
- [x] 2.2 调整 `apps/web/src/canvas/CanvasStage.tsx` 与相关 overlay，使 connector endpoint / waypoint handle 仅在 editing 语义下暴露，并与通用 selected chrome 协同。
- [x] 2.3 收敛 `apps/web/src/canvas/VideoOverlayLayer.tsx` 与 `apps/web/src/index.css` 中的视频选中反馈，使其与 canvas 主轮廓语言一致而不重复强化。

## 3. UI Consistency

- [x] 3.1 更新 `apps/web/src/components/SelectionToolbar.tsx` 及其定位依赖，确保 toolbar 与新的 selected chrome 关系清晰，不被误用为 hover 反馈。
- [x] 3.2 优化 `apps/web/src/index.css` 中 `.canvas-anchor`、`.canvas-connector-handle`、selected 边框与 hover 样式，明确三态层级。
- [x] 3.3 保持现有工具栏、刻度尺、吸附线和 connector 工具行为不变，不让样式优化引入新的交互模式。

## 4. Validation

- [x] 4.1 为 canvas engine / interaction 相关单元测试补充 hover top-hit、selected chrome 与 connector editing 反馈覆盖。
- [x] 4.2 更新 `apps/web/tests/e2e/canvas.spec.ts`，验证普通对象 hover 预览、connector 选中/编辑态以及视频节点选中反馈不回归。
- [x] 4.3 运行 `pnpm test`、`pnpm test:e2e`、`pnpm lint` 和 `pnpm build`，确认交互反馈优化未破坏现有编辑流程。
