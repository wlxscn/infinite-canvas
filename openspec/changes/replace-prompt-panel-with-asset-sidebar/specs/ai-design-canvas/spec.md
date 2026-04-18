## ADDED Requirements

### Requirement: 画布工作区采用三栏布局承载素材、画布与对话
系统 SHALL 将首页工作区组织为左侧素材管理、中间画布工作区和右侧设计对话三栏，而不是依赖左侧 prompt 浮层和素材浮层叠加在整页画布之上。

#### Scenario: 打开工作区时显示三栏结构
- **WHEN** 用户进入画布编辑器
- **THEN** 界面显示左侧素材管理区域、中间画布工作区和右侧设计对话区域，并保持各自职责清晰

#### Scenario: 三栏纵向铺满工作区
- **WHEN** 用户进入画布编辑器并看到 header 下方的工作区
- **THEN** 左侧素材管理区域、中间画布工作区和右侧设计对话区域在纵向上铺满可用工作区高度，而不会在底部留下额外留白带

#### Scenario: 画布工作区承载原有浮动控制层
- **WHEN** 用户在中间画布区域进行选择、缩放或编辑
- **THEN** 画布相关浮动控件仍在中间工作区内显示，而不是回退为整页浮层布局

### Requirement: 左侧素材管理侧栏支持展开与收起
系统 SHALL 提供一个可展开和收起的左侧素材管理侧栏，用于展示上传素材和生成结果，并在收起时保留可发现的重新展开入口。

#### Scenario: 展开态显示素材管理内容
- **WHEN** 左侧素材栏处于展开状态
- **THEN** 用户可以看到素材标题、素材列表、导入动作以及与当前工作流相关的空态说明

#### Scenario: 收起态保留重新展开入口
- **WHEN** 用户收起左侧素材栏
- **THEN** 界面仍保留一个明确的 rail 或入口，使用户可以再次展开素材栏，而不是完全隐藏该区域

#### Scenario: 展开收起时画布宽度随布局调整
- **WHEN** 用户切换左侧素材栏的展开或收起状态
- **THEN** 中间画布工作区根据新的布局宽度自适应调整，而不要求更改文档内容或交互历史

### Requirement: 生成结果与上传素材统一在左侧素材栏承接
系统 SHALL 将上传素材和生成结果统一展示在左侧素材管理侧栏中，并允许用户从该侧栏将素材插入画布。

#### Scenario: 上传参考图后出现在左侧素材栏
- **WHEN** 用户导入参考图
- **THEN** 该素材出现在左侧素材管理侧栏中，并可被后续插入画布

#### Scenario: 对话生成结果后出现在左侧素材栏
- **WHEN** 用户通过右侧设计对话触发图片或视频生成并获得结果
- **THEN** 新素材出现在左侧素材管理侧栏中，而不是依赖独立的左侧 prompt 面板承接

#### Scenario: 从左侧素材栏插入素材
- **WHEN** 用户在左侧素材管理侧栏点击某个素材
- **THEN** 系统将该素材插入当前画布工作区，并保持现有插入与选中语义

## MODIFIED Requirements

### Requirement: Generation jobs expose user-visible lifecycle state
The system SHALL represent image generation as a tracked job with visible status transitions, while using the right-side design conversation as the primary user-facing generation entry and the left-side asset sidebar as the result landing zone.

#### Scenario: Pending generation is visible
- **WHEN** a user submits a generation request
- **THEN** the system creates a job record marked as pending and surfaces that status in the interface

#### Scenario: Failed generation remains inspectable
- **WHEN** a generation request fails
- **THEN** the system records the job as failed without corrupting existing board or asset state

#### Scenario: Generation no longer depends on a dedicated left-side prompt panel
- **WHEN** a user starts a first-pass generation from the workspace
- **THEN** the interaction is initiated through the right-side design conversation flow rather than a dedicated left-side prompt form
