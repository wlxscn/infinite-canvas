## Context

当前画布系统支持矩形、文本、图片、视频、connector 和 group，但几何解析仍然建立在“局部坐标 + 父组平移偏移 + 轴对齐 bounds”之上。`packages/canvas-engine` 中的 `pointInBounds`、`getBoxBounds`、`getAnchorPoint`、`drawNodeChrome`、`resizeBoxNode` 等 helper 都假设节点没有旋转；`hierarchy.ts` 也只解析 group 的平移偏移，不解析任何局部角度。

这意味着一旦加入旋转，受影响的不只是节点渲染本身，还包括：

- 文档模型：哪些节点持久化旋转角度，哪些不持久化
- 层级解析：group 旋转如何传递到子节点世界几何
- 命中与交互：pointer 命中、resize、rotate handle 和 selection chrome 如何计算
- connector：锚点在节点旋转后的位置如何变化
- 派生反馈：marquee、snap、ruler 这类依赖 bounds 的功能是否升级

本次设计目标是在不引入完整矩阵系统的前提下，让画布进入“轻量 transform”阶段：对用户可见的渲染、命中和选择反馈使用真实旋转几何，对辅助反馈链路继续保留 AABB 近似。

## Goals / Non-Goals

**Goals:**

- 为 `rect`、`text`、`image`、`video` 和 `group` 提供明确的旋转数据模型与交互能力。
- 提供悬浮 rotate handle，让用户可直接旋转当前选中对象，并保持一次手势一条历史记录。
- 让 group 的整体旋转可以驱动其子节点世界几何更新，并在拆组时恢复与旋转前视觉一致的子节点位置。
- 让 connector 在所附着节点或 group 子节点发生旋转后继续保持正确的锚点与路径结果。
- 继续允许 marquee selection、snap、ruler 等派生反馈依赖旋转后 AABB，而不是在本次变更中全面切到 OBB。
- 保持旧项目兼容读取：缺少旋转字段的持久化文档仍可加载并视为角度为 0。

**Non-Goals:**

- 不引入通用矩阵栈、任意 pivot 编辑器或完整属性检查器。
- 不支持 freehand 旋转。
- 不要求 marquee、snap、ruler、group 外围提示升级为精确 OBB 几何。
- 不在本次变更中扩展多选整体旋转；多元素整体旋转通过先成组再旋转完成。
- 不在本次变更中定义独立于附着关系之外的“attached connector 自由旋转”高级语义。

## Decisions

### 1. 为可旋转节点引入显式 `rotation` 字段，缺省值视为 0

决定：

- 对 `rect`、`text`、`image`、`video` 和 `group` 增加可持久化的 `rotation` 字段。
- 旧文档缺少该字段时按 `0` 处理，不触发迁移失败。
- `rotation` 语义为“围绕节点自身视觉中心旋转”。

原因：

- 当前模型已经围绕每种节点的显式字段构建，增量加入 `rotation` 比引入并行 transform 对象更贴近现有架构。
- 以中心点作为默认旋转轴可以让渲染、命中、rotate handle 和拆组后的视觉恢复规则保持一致。

备选方案：

- 为所有节点引入通用 matrix/transform 对象：更灵活，但会立刻把这次变更扩大成全系统重写。

### 2. 真实几何与派生几何分层处理

决定：

- 渲染、命中测试、锚点解析、旋转 handle、selection chrome 使用旋转后的真实几何。
- marquee selection、snap、ruler range projection 和其他依赖 bounds 的派生反馈继续使用旋转后的 AABB。

原因：

- 这是把用户最容易感知的能力先做对，同时避免将 OBB 选择、精确吸附和标尺系统一起卷入。
- 现有 `getCanvasNodeBounds`、`normalizeBounds` 和相关派生链路已经以矩形 bounds 为中心，保留 AABB 能显著缩小首版复杂度。

备选方案：

- 全链路统一为 OBB：几何更精确，但会明显扩大 controller、snap 和测试覆盖面。

### 3. 用现有 hierarchy helper 演进到“局部旋转 + 父级旋转”的轻量 world 解析

决定：

- 保留当前“节点存局部坐标”的方向，不引入单独的 scene graph runtime。
- `hierarchy.ts` 从只处理 group 平移偏移，升级为能解析父 group 旋转对 child 世界位置与世界角度的影响。
- world-space helper 需要能返回：
  - 节点世界中心点
  - 节点世界角度
  - 旋转后的四角或外接 AABB

原因：

- group 旋转是本次变更的中心复杂度；如果不把层级解析升级为 transform-aware，group 只能“框旋转”，子元素和 connector 无法跟上。
- 继续复用现有 hierarchy 入口可以把影响面集中在 engine，而不是在 web 层额外拼一套几何状态。

备选方案：

- 只允许根层节点旋转、暂不支持 group 旋转：范围更小，但与本次用户目标不符。

### 4. rotate handle 作为 selection chrome 的一部分，而不是新工具

决定：

- 在单节点或单个 group 被选中时显示悬浮 rotate handle。
- rotate handle 位置基于旋转后对象的顶部中心外侧计算。
- 旋转交互继续走 controller 的手势状态机，与 drag/resize 一样按完整手势提交历史。

原因：

- 当前交互系统已经有 `dragging-node`、`resizing-node`、`editing-connector-*` 等模式，扩展一个 `rotating-node` 比新增工具模式更自然。
- rotate handle 属于选择后的上下文编辑 affordance，符合现有选择工具栏和 selection chrome 的心智。

备选方案：

- 独立旋转工具：实现可行，但会让简单对象旋转变重，也更难复用现有交互状态。

### 5. connector 在本次变更中以“旋转感知的附着几何”优先，而不是完整独立旋转系统

决定：

- attached connector 的核心要求是：所附着节点或 group 子节点旋转后，connector endpoint 与路径继续正确。
- 锚点命名仍沿用 `north/east/south/west`，但其世界位置改为基于旋转后节点几何求解。
- 本次不把“attached connector 独立绕自身中心旋转且仍保持附着”定义为必须支持的首版行为。

原因：

- 对已附着 connector 来说，“独立旋转且保持 attachment”语义天然冲突；用户更稳定的预期是线会跟着目标节点一起转。
- 现有 connector 系统已经以 endpoint attachment 为核心，优先保 attachment 一致性比引入新的 connector transform 语义更稳妥。

备选方案：

- 为所有 connector 引入独立 rotation：会立即牵涉 attached endpoint、waypoint、polyline 路径与撤销语义的复杂冲突。

### 6. resize 继续保留单 handle，但在节点局部坐标系中执行

决定：

- 第一版继续保留当前右下单 resize handle。
- 用户拖动的是旋转后的 handle，但写回的是节点局部坐标系中的 `w/h`。
- 命中逻辑先把 pointer 映射到节点局部坐标，再执行已有 resize 规则。

原因：

- 这样能最大化复用当前 `resizeBoxNode` 模型，而不是在同一次变更里引入八向 handle 和复杂约束。
- 对旋转场景来说，局部坐标 resize 至少语义自洽，不会出现“手在对象外、宽高却沿世界坐标增长”的明显错位。

备选方案：

- 直接扩展为八向 resize：用户体验更完整，但不是这次旋转能力的最小闭环。

## Risks / Trade-offs

- [group 旋转会把 hierarchy 从 offset helper 推向 transform helper] → 先把能力限定在局部旋转 + 父级旋转传递，不引入任意 matrix API。
- [旋转后的命中、chrome 与 AABB 派生反馈可能不完全一致] → 在 spec 中明确“真实几何用于编辑，AABB 用于辅助反馈”的首版边界。
- [旧持久化文档缺少 `rotation` 字段] → 读取时统一默认 `0`，并补兼容测试覆盖旧项目恢复。
- [connector 语义容易膨胀] → 明确本次只承诺“附着几何随旋转同步”，不承诺 attached connector 独立旋转。
- [resize 在旋转场景下仍只有单 handle，体验不如成熟设计工具] → 作为已知折中写入非目标，避免 scope 继续膨胀。

## Migration Plan

- 本次不要求一次性迁移已有持久化文档。
- schema 读取层对缺省 `rotation` 采用兼容默认值 `0`。
- 若实现过程中发现现有 group 持久化或 connector 恢复逻辑依赖旧 bounds 假设，可通过增量测试先锁定兼容行为，再调整 helper。

## Open Questions

- 是否需要在后续迭代中为 free-end connector 定义显式的独立旋转行为。
- 是否需要为旋转后的多选集合提供“不先成组即可整体旋转”的交互。
