## MODIFIED Requirements

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

#### Scenario: 视频素材生成客户端截帧
- **WHEN** 系统创建一个视频素材，且浏览器能够从该视频 URL 读取帧
- **THEN** 系统异步截取视频帧并把该帧作为视频素材的预览图保存

#### Scenario: 视频截帧失败不阻塞素材使用
- **WHEN** 系统无法从视频 URL 截帧，例如视频跨域不允许 canvas 读取或加载失败
- **THEN** 视频素材仍然出现在左侧素材管理侧栏中，并仍可被插入画布

### Requirement: Canvas node behavior uses a shared engine contract
The system SHALL route supported canvas node behavior through a shared render-engine contract so rendering, bounds calculation, and hit testing stay consistent across node types.

#### Scenario: Existing supported node types render through the shared contract
- **WHEN** the application renders a board containing freehand, rectangular, text, image, or video nodes
- **THEN** the system resolves each supported node type through the shared engine contract instead of requiring separate hard-coded dispatch paths for render, bounds, and hit testing

#### Scenario: A supported node type exposes its behavior in one place
- **WHEN** a developer implements or updates behavior for a supported canvas node type
- **THEN** the node's rendering, bounds, and hit-testing behavior are defined through the same engine adapter or registry entry

#### Scenario: 视频节点优先显示客户端截帧底图
- **WHEN** 画布渲染一个引用视频素材的视频节点，且该视频素材已有客户端截帧预览图
- **THEN** 共享渲染引擎的视频 adapter 使用该截帧图作为视频节点的静态底图

#### Scenario: 视频节点没有截帧时保留 fallback
- **WHEN** 画布渲染一个没有可用截帧预览图的视频节点
- **THEN** 系统继续显示现有视频 fallback，而不是阻塞画布渲染或隐藏该节点

### Requirement: Project state is recoverable and exportable
The system SHALL preserve the local-first editing loop by restoring project state after refresh and supporting export of current work, while keeping persistence compatible with existing saved projects.

#### Scenario: Restore project after reload
- **WHEN** a user reloads the application after editing a board with assets and text
- **THEN** the system restores the board content, assets, and relevant job history from local persistence

#### Scenario: Export current result
- **WHEN** a user requests export
- **THEN** the system provides an export of the current board result or project data without requiring external services

#### Scenario: Existing saved projects remain readable after optimization changes
- **WHEN** a user opens a project saved before the interaction performance optimization
- **THEN** the system loads the project without requiring a document migration or losing persisted board state

#### Scenario: 旧项目不需要视频截帧字段
- **WHEN** 用户打开一个没有视频截帧字段的旧项目
- **THEN** 系统仍可读取项目，并对视频节点使用现有 fallback 展示
