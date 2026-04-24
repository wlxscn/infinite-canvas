## 1. 默认路由与障碍物采样

- [x] 1.1 扩展 `packages/canvas-engine/src/anchors.ts` 中 polyline 默认 waypoint 生成逻辑，为创建阶段增加一次性的 obstacle-aware orthogonal route 求解
- [x] 1.2 复用当前上下文与世界空间几何解析链路，明确 `rect / text / image / video` 作为默认障碍物，并排除起点节点、终点节点与 connector 自身
- [x] 1.3 为默认路由增加稳定回退策略：当避障求解失败时，退回现有简单默认 bend point 生成，而不阻止 connector 创建

## 2. 创建交互与编辑语义

- [x] 2.1 调整 `packages/canvas-engine/src/controller.ts` 中 polyline connector 的创建/预览路径生成，确保 obstacle-aware 默认路由只在创建阶段参与
- [x] 2.2 保持 `waypoints` 作为普通 polyline 数据，不新增持续自动重路由状态，并验证用户后续手动编辑 bend point 不会再次触发默认路由接管
- [x] 2.3 明确 endpoint 重挂接场景是否复用一次性默认避障；若复用，则在 controller 中保持与创建阶段一致的回退语义

## 3. 测试与验证

- [x] 3.1 更新 `apps/web/tests/unit/canvas-engine.test.ts`，覆盖 polyline 默认避障、回退路径和创建后 bend point 编辑不回归
- [x] 3.2 更新 `apps/web/tests/e2e/canvas.spec.ts`，验证存在中间元素时 polyline connector 的初始路径不会直接穿过目标元素
- [ ] 3.3 运行 `pnpm --filter @infinite-canvas/web test -- tests/unit/canvas-engine.test.ts`、必要的 `pnpm --filter @infinite-canvas/web exec playwright test ...` 和 `pnpm --filter @infinite-canvas/web exec tsc --noEmit`，确认 polyline 避障未破坏现有 connector 流程
