## Context

当前 `App.tsx` 将工作区组织为“整页画布底板 + 左侧两个浮层卡片 + 右侧聊天侧栏”的结构：`PromptPanel` 提供首版生成入口，`AssetsPanel` 以浮层方式展示素材托盘，`AgentSidebar` 则承担后续对话迭代。这造成两个问题：一是生成意图被拆分到左侧和右侧两个区域，二是素材区域只是叠加在画布之上的卡片，无法稳定表达“素材管理侧栏”的角色。

本次变更需要将工作区收敛为真正的三栏结构，并引入左侧展开/收起状态。这会同时影响顶层布局、空态叙事、素材展示方式，以及右侧聊天文案，但仍应保持当前画布交互、文档结构和本地持久化兼容。

Likely modules involved:
- `apps/web/src/App.tsx`: 重新定义工作区骨架，从“浮层卡片 + 画布”调整为三栏布局容器。
- `apps/web/src/components/AssetsPanel.tsx` 或替代组件：将素材托盘升级为左侧可折叠素材管理栏。
- `apps/web/src/components/PromptPanel.tsx`: 从布局中移除，并清理其被替代后的职责。
- `apps/web/src/components/CanvasHero.tsx`: 重写空态引导，使其强调“右侧对话生成、左侧承接素材”。
- `apps/web/src/features/chat/components/AgentSidebar.tsx`: 调整文案，使其覆盖首版生成与后续迭代，同时保持纯对话形式。
- `apps/web/src/hooks/useCanvasGenerationController.ts`: 继续提供生成与上传能力，但不再要求独立的左侧 prompt UI 消费这些状态。
- `apps/web/src/index.css`: 定义左栏、中央工作区、右栏以及左栏展开/收起状态的布局和过渡。
- `apps/web/tests/e2e/canvas.spec.ts` 与相关单元测试：覆盖新布局、空态和素材承接行为。

## Goals / Non-Goals

**Goals:**
- 将顶层工作区调整为“左侧素材管理 + 中间画布工作区 + 右侧纯对话”的三栏布局。
- 移除 `PromptPanel`，不再保留左侧首版生成入口。
- 将左侧素材区升级为可展开/收起的正式侧边栏，而不是浮层卡片。
- 保持右侧 `AgentSidebar` 为纯对话输入，不新增结构化快捷生成区。
- 让空态文案清楚表达新的三栏协作模型：右侧表达需求，左侧承接素材，中间完成编辑。
- 保持当前 `CanvasProject`、本地存储格式、undo/redo 与画布交互逻辑兼容。

**Non-Goals:**
- 不新增素材删除、重命名、拖拽排序、搜索、筛选或收藏功能。
- 不新增右侧结构化 prompt 面板、媒体类型 toggle 或首版生成快捷表单。
- 不修改聊天协议、Agent tool effects 语义或素材持久化 schema。
- 不借此次变更重构 canvas engine、selection 行为或 ruler/snap 逻辑。

## Decisions

### 1. 使用真正的三栏布局容器，而不是继续在整页画布上叠加左侧浮层

`App.tsx` 应将工作区组织为 `header + body`，其中 `body` 由左侧素材栏、中间画布工作区、右侧对话栏组成。`CanvasStage` 不再视为整页底板，而是中间工作区内部的一层。

Why:
- 这能把“素材管理侧栏”从视觉装饰升级为稳定的信息架构角色。
- 中央工作区可以继续承载 `CanvasHero`、`SelectionToolbar`、`ToolDock` 和 `FloatingFooter` 等浮动层，而不会与左侧栏语义混杂。
- 比继续用绝对定位卡片更容易处理左栏展开/收起后的宽度变化。

Alternative considered:
- 保留现有整页画布结构，只删除 `PromptPanel` 并把 `AssetsPanel` 放大成左侧浮层。
Rejected because 这会让左侧栏在语义上仍是“漂浮面板”，无法真正形成稳定的三栏工作流。

### 2. 左侧素材栏使用“展开面板 + 收起 rail”的双态模型，而不是完全隐藏

左侧素材管理需要支持展开和收起。展开态展示标题、导入动作、素材列表与空态说明；收起态保留窄 rail 作为可发现的重新展开入口，而不是变成 0 宽度完全消失。

Why:
- 画布宽度是稀缺资源，收起左栏可以为编辑腾出更多空间。
- 保留 rail 能维持“这里有素材栏”的可发现性，避免用户忘记左栏存在。
- 这与右侧聊天栏已有的展开/收起行为形成对称的工作区状态系统。

Alternative considered:
- 收起后将左栏完全隐藏。
Rejected because 这会降低可发现性，并让重新展开的交互成本过高。

### 3. 素材栏第一版仍然是“轻量管理”，不扩张到完整资产管理系统

左侧栏应展示素材列表、基础来源/类型信息和插入动作，但不在本次引入删除、重命名、搜索或多层筛选。

Why:
- 当前目标是收敛布局和工作流，而不是扩张素材功能边界。
- 现有 `AssetRecord` 与 `insertAsset()` 路径已经足够支撑“查看素材并插入画布”的核心行为。
- 保持能力轻量有助于复用现有 store 和数据结构，避免把 change 扩张成资产系统重写。

Alternative considered:
- 直接把左栏做成完整素材管理器，包含筛选、删除和多视图切换。
Rejected because 这会显著扩大范围，并引入新的状态与交互复杂度。

### 4. 生成入口统一收敛到右侧纯对话，`useCanvasGenerationController` 继续作为底层能力提供者

本次不再为 `prompt`、`generationMediaType` 和“生成首版画面”保留独立面板。生成能力仍由现有 hook 提供，但触发入口应通过右侧聊天和 agent effects 驱动，而不是独立的左侧 UI。

Why:
- 这样可以消除“左侧首版生成”和“右侧后续迭代”两个重复意图入口。
- 现有聊天系统已经有足够的意图输入、上下文和效果应用链路，可以承担统一入口角色。
- 保留现有 generation hook 作为能力层，有助于避免一次性重写生成和上传逻辑。

Alternative considered:
- 将 `PromptPanel` 的生成控件整体搬到右侧聊天栏上方。
Rejected because 这会在“纯对话”方向上回退成半结构化入口，与本次决策冲突。

### 5. 空态文案需要从“左侧启动流程”改写为“三栏协作关系”

`CanvasHero`、左侧素材空态以及右侧聊天 placeholder 都需要重新表达首屏引导：用户应从右侧表达需求，生成结果进入左侧，再插入中间画布继续编辑。

Why:
- 删除 `PromptPanel` 后，旧空态会误导用户仍然去左侧寻找生成入口。
- 三个区域需要分工明确，但不能同时都过度强调，避免空态噪音。
- 中央 hero 适合作为主引导，左侧和右侧文案则承担辅助说明。

Alternative considered:
- 只删除 `PromptPanel`，保留原有空态文案不变。
Rejected because 这会让首页叙事与真实交互路径产生明显冲突。

## Risks / Trade-offs

- [左侧和右侧同时展开会压缩中间画布] → 将左栏宽度控制在紧凑范围，并提供展开/收起切换以释放画布空间。
- [删除显式首版生成面板可能降低首次可理解性] → 通过 `CanvasHero`、素材空态和右侧输入 placeholder 联合强调“从右侧开始”。
- [将素材托盘升级为正式侧栏后，现有组件命名和职责可能变得混乱] → 在实现时同步梳理 `AssetsPanel`、`PromptPanel` 和 `CanvasHero` 的归属与命名。
- [右侧纯对话在没有结构化控件时，对用户表达图片/视频意图的要求更高] → 通过文案示例和聊天空态增强可发现性，而不新增结构化表单。
- [布局重排可能影响现有 E2E 对定位与可见性的断言] → 更新测试为语义化断言，避免依赖旧的浮层位置。

## Migration Plan

- 在不修改 `CanvasProject` 和本地持久化格式的前提下，引入新的三栏工作区布局容器。
- 用可折叠左侧素材栏替代 `PromptPanel` 和旧 `AssetsPanel` 的组合。
- 更新 `CanvasHero`、聊天 placeholder 和素材空态文案，使它们与新三栏模型一致。
- 验证右侧对话仍可驱动生成结果，且生成/上传后的素材会正确显示在左侧栏并可插入画布。
- 如果需要回滚，可以恢复旧的 `PromptPanel + AssetsPanel` 组合布局；不涉及数据迁移或持久化回滚。

## Open Questions

- 左侧素材栏在首次进入且素材为空时是否默认展开，还是需要基于 viewport 或用户偏好决定默认状态？
- 收起态 rail 应保留文字标签还是仅保留图标，以平衡可发现性和紧凑性？
- 左侧素材列表第一版更适合列表卡片式还是双列缩略图库式展示？
