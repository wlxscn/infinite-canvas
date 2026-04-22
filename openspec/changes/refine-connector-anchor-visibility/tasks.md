## 1. 交互状态与命中范围

- [x] 1.1 调整 `packages/canvas-engine/src/controller-state.ts` 与 `controller.ts`，为 connector 相关空闲态、拖拽态和 endpoint 编辑态维护独立于 `hoveredAnchor` 的“当前邻近节点”运行期状态
- [x] 1.2 在 `packages/canvas-engine` 中增加 node-level proximity 判定，使“接近节点本体”先于“命中具体锚点”，并确保远离目标时清空邻近节点与 `hoveredAnchor`
- [x] 1.3 统一 connector 起笔、拖拽预览、endpoint 重挂接与 overlay 显示的候选范围，复用当前上下文节点集合而不是默认对 `currentBoard.nodes` / `getAllDescendantNodes(board.nodes)` 走全局命中

## 2. Overlay 渲染与样式收敛

- [x] 2.1 更新 `apps/web/src/canvas/CanvasStage.tsx` 中的 `CanvasAnchorOverlay`，只渲染当前邻近节点的锚点集合，并保留“节点已邻近但尚未命中锚点”与“当前命中锚点高亮”的两层反馈
- [x] 2.2 调整 `apps/web/src/index.css` 中 `.canvas-anchor` 相关样式，确保“邻近节点锚点可见”和“命中锚点高亮”层级清晰，同时不破坏现有 connector handle 视觉语言

## 3. 测试与验证

- [x] 3.1 为 `packages/canvas-engine` 相关测试补充 connector proximity 行为覆盖，验证默认不全量显示、接近节点才暴露、接近节点但未命中锚点时 `hoveredAnchor` 可为空、远离后清空，以及 group 上下文边界
- [x] 3.2 更新 `apps/web/tests/e2e/canvas.spec.ts`，覆盖“进入 connector 工具后无全量锚点 -> 接近节点后显示该节点锚点 -> 命中锚点后单点高亮 -> 组外节点不可被隐藏吸附”的关键路径
- [ ] 3.3 运行 `pnpm test`、`pnpm lint` 和必要的 `pnpm test:e2e`，确认锚点显示策略收敛后未破坏现有 connector 交互
