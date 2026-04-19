## 1. Ruler Data And Layout Foundation

- [x] 1.1 在 `apps/web/src/canvas/CanvasStage.tsx` 与相关样式中为顶部和左侧刻度尺预留固定 gutter，并确保现有 canvas 与 `VideoOverlayLayer` 在尺槽之外正常布局。
- [x] 1.2 在 `apps/web/src/hooks/` 下新增或扩展派生逻辑，从 `project.board.viewport`、容器尺寸和选中对象边界计算刻度尺的主次刻度、标签和范围投影数据。
- [x] 1.3 复用 `packages/canvas-engine/src/transform.ts` 的现有 world/screen 变换，不新增持久化字段，并确认 `apps/web/src/types/canvas.ts` 与 `apps/web/src/persistence/local.ts` 无需 schema 变更。

## 2. Ruler Canvas Integration

- [x] 2.1 在 `apps/web/src/canvas/CanvasStage.tsx` 中渲染顶部和左侧刻度尺，使其随 viewport 平移和缩放连续更新，并支持负坐标读数。
- [x] 2.2 接入当前选中对象的边界框信息，在横向和纵向刻度尺上高亮对象范围，并在取消选择时清除投影。
- [x] 2.3 如果决定纳入本次范围，在不影响现有 pointer 交互的前提下增加 hover 位置投影；否则保持实现边界只覆盖对象范围投影。

## 3. Snap Foundations

- [x] 3.1 在拖拽派生逻辑中定义可见对象边缘与中心线的吸附候选，并基于 screen-space 阈值计算命中结果。
- [x] 3.2 为对象拖拽过程增加吸附结果的数据结构，包含目标轴、命中线、修正后的落点与可视反馈信息。
- [x] 3.3 明确吸附逻辑不引入新的持久化字段、不生成独立历史记录，并与现有 selection/drag mutation 路径兼容。

## 4. Snap Integration

- [x] 4.1 在对象拖拽更新路径中接入轻量吸附计算，使拖拽中的对象可对齐到其他对象的边缘与中心。
- [x] 4.2 在命中吸附时渲染清晰但非侵入式的视觉反馈，并确保未命中时不影响现有自由拖拽体验。
- [x] 4.3 验证刻度尺范围投影、对象拖拽吸附与现有 viewport/pointer 交互可以共存，不造成命中冲突或交互回归。

## 5. Validation

- [x] 5.1 添加单元测试，覆盖刻度步长选择、负坐标标签、对象范围到尺上投影的派生计算，以及吸附阈值与落点修正规则。
- [x] 5.2 更新 `apps/web/tests/e2e/canvas.spec.ts`，验证打开编辑器可见刻度尺、平移/缩放后刻度连续更新、选中对象后尺上范围高亮，以及拖拽对象时的吸附反馈与对齐结果。
- [x] 5.3 运行 `pnpm lint`、`pnpm test`、`pnpm build`，并在适用时运行 `pnpm test:e2e` 验证刻度尺、吸附与现有画布交互未回归。
