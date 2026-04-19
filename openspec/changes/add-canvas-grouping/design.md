## Context

当前编辑器已经具备单节点编辑、锚点连线、吸附线与本地持久化，也已经有一套可进入的层级编辑基础。但如果继续在实现里保留 `container`，同时再把成组能力命名为 `group`，系统会长期维护两套高度相似的层级语义：

- `container`：旧实现中的可进入、可退出内部编辑上下文
- `group`：这次要统一后的整体移动、缩放、拆分组和内部编辑语义

这种双轨设计会同时增加产品和实现复杂度：

- 用户要学习两套相似名词和入口
- `packages/canvas-engine` 要分别处理两类层级节点
- `apps/web` 的工具栏、文案、持久化兼容与测试都要区分两套语义

因此这次 change 的设计目标，不是让 `group` 和 `container` 共存，而是统一到单一 `group` 概念：一个 group 既可以被整体编辑，也可以在需要时进入内部继续编辑。

受影响的主要模块：

- `packages/canvas-engine/src/model.ts`
  需要定义统一的 `group` 节点结构，并直接移除 `container` 类型分支。
- `packages/canvas-engine/src/hierarchy.ts`
  需要把现有 container 相关 helper 泛化为 group hierarchy helper。
- `packages/canvas-engine/src/scene.ts`、`canvas-registry.ts`、相关 adapter
  需要统一渲染 group 本体、其 children 以及内部编辑时的上下文 chrome。
- `packages/canvas-engine/src/controller.ts`
  需要统一“整体编辑 group”和“进入 group 内部编辑”的状态语义。
- `apps/web/src/state/store.ts`
  需要提供成组、拆分组、进入组、退出组等 mutation / navigation 能力，并移除旧 `container` alias。
- `apps/web/src/components/SelectionToolbar.tsx`、`App.tsx`
  需要统一入口与文案，不再暴露 `container` 名称。
- `apps/web/tests/unit` 与 `apps/web/tests/e2e`
  需要覆盖 group 的整体编辑、内部编辑和拆分，并验证仓库里不再暴露 `container` 概念。

约束条件：

- 需要尽量复用现有 hierarchy、history、selection chrome 和 connector 解析链路。
- 第一版避免把统一后的 group 继续扩展成 frame / layout / clip 系统。

## Goals / Non-Goals

**Goals:**

- 提供统一的 `group` 节点，让多个节点能作为单一编辑单元被整体选中、移动、缩放、调层级和删除。
- 支持进入某个 group 的内部编辑上下文，并支持退出回到外层。
- 支持从当前选择创建 group，并支持将 group 拆分回原始子节点。
- 让 group 参与本地持久化、undo/redo、hover/selection chrome 与 connector world 解析。
- 直接将现有 `container` 实现重命名并收敛为 `group`，产品与代码都不再保留 `container` 概念。

**Non-Goals:**

- 不支持嵌套 group。
- 不支持 group 样式系统、clip/mask、自动布局、约束或 layout 规则。
- 不支持单独的 frame/container 产品概念继续并存。
- 不引入完整多选系统的大规模重构；第一版只扩展到足以支撑成组创建与组内编辑。

## Decisions

### 1. 用统一的 `group` 节点取代产品层面的 `container`

决定：

- 统一产品与文档语义，只保留 `group` 名称。
- 现有 `container` 能力合并进 `group`：
  - group 可被整体编辑
  - group 可进入内部编辑

原因：

- 避免两套高度重叠的层级节点长期并存。
- 减少工具栏、文案、帮助信息和持久化模型的双轨成本。

备选方案：

- 继续保留 `container` + `group`：实现上可以细分职责，但会把产品心智和维护成本一起抬高。

### 2. group 继续使用 children 局部坐标，保留现有层级解析思路

决定：

- `group.children` 使用相对 group 本体的局部坐标保存。
- group 本体维护自己的 bounds；子节点 world 几何通过 hierarchy helper 解析。

原因：

- 能最大化复用现有层级编辑实现方向，同时避免继续维护双轨类型。
- 拆分组时可以稳定还原子节点 world 坐标。

备选方案：

- 子节点继续用 world 坐标：实现更轻，但会让整体缩放、拆分与持久化恢复更脆弱。

### 3. group 同时承担“选择目标”和“导航上下文”两种角色

决定：

- 当用户只选中 group 时，它是整体编辑目标。
- 当用户进入 group 后，它又成为当前导航上下文边界。
- 进入/退出 group 继续视为运行时导航状态，不写入文档历史。

原因：

- 这正是统一 `container` 与 `group` 后必须承接的双重职责。
- 可以复用现有“导航上下文 + 选择目标”的状态框架，而不是再造新状态机。

备选方案：

- 让 group 仅整体编辑、不支持进入：会失去这次统一的核心价值。
- 让 group 一旦创建就只能进入编辑：会让轻量成组场景变重。

### 4. connector 继续附着具体子节点，group 只参与几何传递

决定：

- group 不成为 connector attachment 的直接目标。
- 如果 connector 连接的是 group 内子节点，group 整体移动/缩放后，connector 通过子节点 world 几何自动重算。

原因：

- 现有 connector 模型已经以具体节点为 attachment 单位，保持不变可避免 schema 和工具行为大改。
- 用户更关心组内元素的关系稳定，而不是让线挂在 group 边框上。

备选方案：

- 允许 connector 直接连 group：可扩展，但会新增锚点策略与视觉语义，不适合作为这次统一的首版目标。

### 5. 成组/拆分组作为文档 mutation，进入/退出组作为导航状态

决定：

- 创建 group、拆分组、整体拖拽/缩放 group 都进入现有 undo/redo。
- 进入组与退出组不进入文档历史。

原因：

- 保持现有“一次手势一条历史”的用户预期。
- 维持现有 container 导航与文档 mutation 的清晰边界。

备选方案：

- 把进入/退出组也写入历史：会让撤销堆栈污染导航操作，不利于编辑体验。

## Risks / Trade-offs

- [统一名称后，需要一次性拔掉现有 container 分支] → 先统一模型与导出面，再借助编译器和测试把残留引用全部清掉。
- [一个 group 同时承担整体编辑和内部编辑，交互语义更复杂] → 通过 selection toolbar、context bar 和明确的进入/退出 affordance 区分两种状态。
- [没有完整多选系统时，成组入口可能受限] → 第一版只扩展到可支撑 group 创建的受控选择路径，避免把多选本身做成新的大 change。
- [connector、吸附和 hover chrome 在 group 态下可能出现边界问题] → 继续复用统一 hierarchy world 解析，并补 group 整体编辑与内部编辑两类测试。
- [统一后 scope 容易继续膨胀成完整 frame/layout 系统] → 在 spec 和 tasks 中明确排除嵌套、clip/mask、自动布局和样式系统。
