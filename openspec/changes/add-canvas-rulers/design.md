## Context

当前画布已经具备稳定的 world/screen 坐标变换、平移缩放交互和基于 viewport 的选区定位能力，但这些空间信息主要存在于内部实现中，还没有以持续可见的界面形式暴露给用户。`packages/canvas-engine` 负责维护 `viewport` 与坐标变换，`apps/web/src/canvas/CanvasStage.tsx` 负责画布容器和输入转发，`apps/web/src/hooks/useWorkspaceViewModel.ts` 已经证明了基于 `worldToScreen` 派生界面数据是现有架构中的自然模式。

这次变更看起来只是界面增强，实际上涉及一组需要提前定清楚的边界：
- 刻度尺应该依附在 viewport 之上，而不是成为 board 文档的一部分。
- 刻度尺需要和现有 canvas、video overlay、selection toolbar 共存，不能破坏当前交互或持久化模型。
- 这次需求只覆盖“读数层”，而不是完整的 guide/snap 系统，否则范围会迅速膨胀。

Likely modules involved:
- `apps/web/src/canvas/CanvasStage.tsx`: 为画布增加刻度尺容器层，并向派生 UI 暴露 hover/selection 相关数据
- `apps/web/src/index.css`: 定义顶部和左侧刻度尺的布局、gutter、层级与响应式行为
- `apps/web/src/hooks/useWorkspaceViewModel.ts` 或相邻 hooks: 从 `board.viewport`、选中对象和容器尺寸派生刻度尺展示数据
- `packages/canvas-engine/src/transform.ts`: 复用现有 world/screen 坐标换算，不新增并行坐标体系
- `apps/web/tests/e2e/canvas.spec.ts` 与相关单元测试: 覆盖平移、缩放、负坐标与选中范围投影的可见行为

## Goals / Non-Goals

**Goals:**
- 为画布提供顶部和左侧刻度尺，并保持其在工作区中持续可见。
- 让刻度尺完全由当前 `viewport` 派生，随平移和缩放连续更新。
- 在常见缩放级别下动态调整主次刻度密度，避免刻度过密或过稀。
- 支持基于 world 坐标显示负值，保持原点移出视口后的连续空间语义。
- 在选中对象时，将其边界范围投影到横向和纵向刻度尺上。
- 保持当前 `CanvasProject`、undo/redo 和 local persistence 兼容，不引入文档迁移。

**Non-Goals:**
- 不引入可拖拽参考线、吸附、网格联动或零点拖拽。
- 不增加 mm/cm/in 等精确单位切换体系，默认沿用现有 world 坐标语义。
- 不把刻度尺并入 `canvas-engine` 的持久化模型或渲染内核。
- 不借此变更重构当前画布渲染架构或替换现有 canvas/video overlay 组合。

## Decisions

### 1. 将刻度尺实现为 `apps/web` 层的派生 UI，而不是 `canvas-engine` 内部渲染职责

刻度尺应作为 `CanvasStage` 周边的工作区 chrome 存在，由 `apps/web` 根据 `board.viewport`、容器尺寸和选中对象状态派生显示数据，而不是直接并入 `renderScene()` 的 canvas 绘制路径。

Why:
- 刻度尺更接近 workspace UI，而不是 board 内容。
- DOM/CSS 更适合表达固定在工作区边缘的尺槽、数字和高亮区间。
- 可以避免把只读显示逻辑耦合进 `canvas-engine` 的核心渲染职责。

Alternative considered:
- 直接在 `packages/canvas-engine/src/scene.ts` 里把刻度尺画进 canvas。
Rejected because 这会把工作区 chrome 和 board 内容混在一个渲染通道里，使文本清晰度、边缘布局和未来交互扩展都更别扭。

### 2. 刻度尺只消费已有 `viewport`，不修改 `CanvasProject` 或本地持久化结构

刻度尺显示状态、刻度密度和对象范围投影都应该由运行时派生，不应成为 `CanvasProject` 的持久化字段。

Why:
- 当前 `CanvasProject` 是 board、assets、jobs、chat 的用户内容模型，刻度尺属于视图层信息。
- 不引入新持久化字段可以保证现有本地项目完全兼容，无需 migration。
- 这与当前选区工具条等派生 UI 的模式一致。

Alternative considered:
- 在 `project` 或 `board` 内保存 `showRulers`、`unit`、`guides` 等字段。
Rejected because 本次 scope 仅覆盖读数层；现在把视图偏好和未来 guide 系统写入文档会过早扩大模型责任。

### 3. 使用保留 gutter 的布局，而不是让刻度尺浮在画布内容之上

画布工作区应为顶部和左侧刻度尺预留固定 gutter，使实际 canvas 内容区域从尺槽之后开始，而不是让刻度尺直接覆盖在内容上层。

Why:
- 这样可以避免刻度尺与选区描边、视频 overlay 和未来辅助线出现视觉打架。
- 用户更容易把尺理解为工作区边框，而不是悬浮装饰。
- 对 selection toolbar、sidebar 缩进和响应式布局更稳定。

Alternative considered:
- 将刻度尺作为绝对定位 overlay 直接覆盖在现有 `.canvas-stage` 上。
Rejected because 它会与内容层共享边缘空间，放大层级和遮挡问题。

### 4. 使用“目标屏幕间距”驱动的动态步长算法，而不是固定 world 步长

刻度尺应根据 `viewport.scale` 从一组候选 world 步长中选择最合适的主刻度间距，使相邻主刻度在屏幕上大致落在稳定的像素区间内。

Why:
- 固定 world 步长在缩小时会过密，在放大时会过稀。
- 设计工具中的尺需要在不同缩放下都保持可读。
- 该算法是纯函数，适合放入派生 hook 并通过单元测试验证。

Alternative considered:
- 始终使用固定的 `10` 或 `100` world units 作为主刻度。
Rejected because 它无法跨缩放级别维持稳定的信息密度。

### 5. 第一版将对象范围投影作为核心反馈，悬停投影作为可选增强

刻度尺必须支持选中对象范围投影；鼠标悬停位置投影可以保留为实现时的次级增强，只要不改变规格中的核心边界。

Why:
- 选中范围投影直接服务于布局与编辑，是最具设计价值的反馈。
- 悬停投影需要额外共享 pointer hover 数据，复杂度略高。
- 先确保对象范围投影成立，可以让第一版 feature 更聚焦。

Alternative considered:
- 同时把 hover crosshair、测量线和选中范围全部纳入第一版必做。
Rejected because 这会把 feature 从读数层推向测量辅助系统，超出当前 change 边界。

### 6. 现有交互与历史语义保持不变，刻度尺不参与命令式状态写入

刻度尺只观察 `viewport`、选中节点和局部 hover 状态，不创建新的 undoable mutation，也不影响当前平移、缩放、选择或持久化节奏。

Why:
- 刻度尺属于可视反馈，不应制造历史记录或额外项目写入。
- 这样可以把风险控制在 UI 派生和布局层，而不是交互核心。
- 与当前 `replaceProjectNoHistory` / `finalizeMutation` 路径天然兼容。

Alternative considered:
- 为刻度尺引入独立 store 或命令式同步机制。
Rejected because 当前需求不需要并行状态系统，额外状态只会增加维护成本。

## Risks / Trade-offs

- [保留 gutter 会缩小可见画布区域] → 将尺槽尺寸控制在紧凑范围内，并与当前浮动 header/sidebar 布局统一协调。
- [刻度步长算法选得不好会导致数字跳变突兀] → 使用有限候选序列和目标屏幕间距，补单元测试覆盖典型 scale 边界。
- [DOM 尺层与 canvas/video overlay 可能出现层级或命中冲突] → 保持刻度尺非交互化并明确 z-index，避免它截获现有画布输入。
- [悬停投影如果纳入第一版，可能引入额外的 pointer 同步复杂度] → 将 hover 投影视为可选增强；先确保选中范围投影完成。
- [响应式布局下 sidebar、header、尺槽和 canvas 容器可能互相挤压] → 在 `CanvasStage` 级别定义清晰的工作区内边距和移动端降级方案。

## Migration Plan

- 在不修改 `CanvasProject` 结构的前提下，为 `CanvasStage` 增加刻度尺布局容器和相关样式。
- 新增基于 `viewport` 与容器尺寸的派生计算逻辑，生成主次刻度和标签数据。
- 接入选中对象的边界投影，并验证取消选择后投影及时清除。
- 通过单元测试锁定步长算法和范围投影计算，通过 E2E 验证平移、缩放和选中对象时的用户可见行为。
- 如果上线后需要回滚，可直接移除刻度尺 UI 层和相关派生逻辑；无需迁移或回滚持久化数据。

## Open Questions

- 悬停位置投影是否应作为本次 change 的默认行为，还是留作实现期可选增强？
- 顶部/左侧尺槽的默认厚度应更偏“工具感”还是“轻量感”，以便与当前 canvas-first UI 保持一致？
- 移动端或窄宽度场景下，是否应保留完整双边刻度尺，还是允许只保留顶部刻度尺作为降级？
