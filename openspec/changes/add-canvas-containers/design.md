## Context

当前画布系统围绕单平面 `BoardDoc.nodes[]` 建模。`packages/canvas-engine/src/model.ts` 中的节点都默认处于同一个 world 坐标系内；`controller.ts`、`canvas-registry.ts`、`scene.ts` 和相关几何 helper 也都默认“选择目标 = 一个顶层节点”“命中范围 = 所有节点的平面 top-hit”。在 Web 侧，`apps/web/src/state/store.ts` 只有 `selectedId`，`App.tsx` 和 `SelectionToolbar.tsx` 也都围绕“当前选中的是哪个单一节点”组织 UI。

这种结构在单平面编辑里是合理的，但一旦容器需要“可进入、可编辑”，系统就必须区分：
- 我当前在哪个编辑上下文中
- 我当前选中了哪个对象
- 一个对象的几何是在 root world 坐标中定义，还是在某个父容器的局部坐标中定义

这意味着本次 change 不是新增一个普通节点类型，而是把文档模型从“平面节点列表”推进到“层级场景树”的第一阶段。Likely modules involved:

- `packages/canvas-engine/src/model.ts`: 新增 `ContainerNode` 与层级节点结构，显式定义局部坐标与 children。
- `packages/canvas-engine/src/canvas-registry.ts`: 从只处理扁平节点，升级为理解容器与子节点 bounds / hit-test / draw 入口。
- `packages/canvas-engine/src/scene.ts`: 需要以层级方式渲染节点，并表现 root / container editing context 下的不同 chrome。
- `packages/canvas-engine/src/controller-state.ts`: 需要引入“导航上下文 + 选中目标”的运行期状态，而不仅仅是一个 `selectedId` 的消费结果。
- `packages/canvas-engine/src/controller.ts`: 需要支持 root 选择容器、进入容器、退出容器，以及在当前上下文内的 pointer hit/move/resize 行为。
- `apps/web/src/types/canvas.ts` 与 `apps/web/src/state/store.ts`: 持久化项目结构与 store 选择语义要升级，旧文档仍需可读。
- `apps/web/src/App.tsx`, `CanvasStage.tsx`, `SelectionToolbar.tsx`, `useWorkspaceViewModel.ts`: UI 需要表达容器选中态、容器内部编辑态与退出 affordance。

## Goals / Non-Goals

**Goals:**
- 将画布从单平面编辑器升级为支持容器层级的编辑器基础能力。
- 引入正式的 `container` 节点，并允许其他支持的画布节点作为其子节点存在。
- 为容器内子节点建立局部坐标语义，使父容器变换能传递到子节点。
- 将运行期交互模型拆为“导航上下文”和“选择目标”，支持 root / inside-container 两种主要编辑上下文。
- 支持容器本身的选择、整体移动/缩放，以及进入/退出容器编辑上下文。
- 保持 connector 继续附着到具体节点，并允许跨容器连线在第一版中继续工作。
- 让旧的本地保存项目继续可读，同时允许新文档开始持久化容器层级结构。

**Non-Goals:**
- 不支持嵌套容器。
- 不引入自动布局、约束、padding、gap、frame 样式或背景系统。
- 不支持 clip/mask/scroll container。
- 不要求 connector 成为容器子节点，也不为 connector 单独建立容器内层级语义。
- 不在本次 change 中引入多选、框选或完整 group 系统。

## Decisions

### 1. 使用正式的层级节点结构，而不是“平铺 nodes + groupId”

本次 change 采用真正的 `ContainerNode`，由其持有 `children`，而不是继续维持平铺 `nodes[]` 再附加 `groupId` 或外部 group metadata。

Why:
- 用户目标已经不是轻量分组，而是“真正可进入/可编辑的容器”。
- 只有正式 children 结构才能让“进入容器”“局部坐标”“父变换影响子节点”这些语义保持一致。
- 这能让系统清晰地向 scene-graph 方向演进，而不是堆叠更多平面补丁。

Alternative considered:
- 维持平铺 `nodes[]`，通过 `groupId` + `groups[]` 表达容器关系。
Rejected because 这种方案更适合轻量 group，不足以支撑容器内部编辑上下文和局部坐标语义。

### 2. 子节点使用容器局部坐标，而不是继续使用 root world 坐标

容器内部子节点的几何以容器局部坐标定义。渲染、命中、connector attachment 解析时，再通过祖先链将局部坐标转换为 world geometry。

Why:
- 如果子节点继续保留 world 坐标，系统只会得到“带父子关系的单平面文档”，而不是真正层级编辑器。
- 局部坐标是后续容器移动、缩放和结构化布局的必要前提。
- 这能让“进入容器编辑”拥有真实语义，而不是仅仅改变 UI chrome。

Alternative considered:
- 第一版先保留 world 坐标，容器只作为逻辑归属。
Rejected because 这会削弱层级编辑器的根本价值，并让后续从假层级迁移到真层级的成本更高。

### 3. 运行期状态拆为“导航上下文 + 选择目标”

当前系统只有 `selectedId`，但层级编辑器需要至少两层状态：
- `navigation context`: 当前在 root 还是在某个容器内部编辑
- `selection target`: 当前选中的是容器本身、容器内子节点，还是没有选中目标

Why:
- “我在哪里编辑”和“我选中了谁”是不同概念，不能继续混在单个 id 上。
- 进入容器、退出容器通常是运行期导航，不应自动等同于文档 mutation。
- 这能让 toolbar、hover、hit-test 和键盘行为在层级系统中保持可推理。

Alternative considered:
- 继续保留 `selectedId`，额外用若干布尔值表示“是否在容器中”。
Rejected because 容易导致状态泄漏和语义冲突，尤其是在 hit-test、退出容器和 undo/redo 边界上。

### 4. 第一版只支持 root 与单层 container editing context，不支持 nested container

虽然目标是层级编辑器，但第一版只需要两种导航上下文：
- `root`
- `inside container X`

Why:
- 这样能把核心复杂度集中在第一层层级转换上，而不是立刻进入任意深度树编辑。
- 对当前产品来说，一层容器已经足够验证局部编辑上下文和结构化内容组织的价值。
- 这降低了 hit-test、breadcrumb、exit 行为与 connector world resolution 的复杂度。

Alternative considered:
- 从第一版就支持任意深度嵌套容器。
Rejected because 会显著放大 mutation path、selection path 和渲染递归复杂度。

### 5. connector 继续附着具体节点，并在 world geometry 解析时穿过容器层级

connector 的数据模型第一版保持不变：端点仍附着到具体节点 id 与 anchor。变化点在于，attachment 解析需要沿祖先链将子节点局部几何转换到 world 坐标。

Why:
- 这可以避免同时重写 connector schema 和容器 schema。
- 对用户来说，“连到某个具体元素”比“连到容器本身”更符合直觉。
- 允许跨容器 connector 继续工作，能减少本次 change 对现有 diagram 能力的破坏。

Alternative considered:
- connector 成为容器子节点，或自动提升为附着 container。
Rejected because 两者都会显著增加层级规则复杂度，且并非第一版必需。

## Risks / Trade-offs

- [文档模型从平铺升级到层级后，旧 helper 会大面积失效] → 优先升级现有 `model / registry / controller / scene` 主干，而不是添加平行层级系统。
- [局部坐标和 world 几何转换容易引入命中、渲染、connector 偏移 bug] → 把坐标解析集中在共享几何 helper，避免在 Web 层和 Engine 层分别做临时换算。
- [进入/退出容器如果与选择状态混用，会让交互感觉“卡住”] → 将导航上下文和选择目标明确拆开，定义 root / inside-container 两层状态机。
- [旧的本地持久化项目可能无法直接读取新 schema] → 维持旧版本可读，在加载阶段提供从平面文档到新结构的兼容路径；新容器能力只在新文档字段出现时启用。
- [第一版不支持 nested container，可能让未来设计受限] → 在 schema 和状态设计中预留祖先链与递归遍历接口，但明确只开放一层容器行为。
- [connector 跨容器解析会增加心智负担] → 第一版坚持“connector 连具体节点，不连容器”，把容器只视为几何上下文而不是关系语义目标。

## Migration Plan

- 为 `BoardDoc` 和 `CanvasNode` 增加容器层级结构，并保留旧项目读取兼容。
- 先升级几何与渲染链路，使系统能够正确解析容器内子节点的 world bounds。
- 再升级 controller / store 的选择与导航上下文，使 root 与 inside-container 行为可切换。
- 最后补 UI affordance、toolbar、退出入口和测试覆盖。
- 如果需要回滚，可先停止创建新容器节点，并保留旧平面文档读取逻辑；但一旦新文档已持久化容器结构，完全回退到旧编辑器需要额外降级逻辑。

## Open Questions

- 第一版进入容器的入口应该是双击、显式按钮，还是两者都支持？
- 退出容器是否允许点击 outside area 直接退出，还是只允许通过 Esc / breadcrumb？
- 容器 resize 在第一版是仅改变容器 bounds，还是也要按比例影响所有子节点局部几何？
- 容器是否需要默认可见背景/标题区域，还是第一版只提供边界 chrome？
- 新文档 schema 是否需要直接提升 `BoardDoc.version`，还是通过可选字段做到向后兼容读取？
