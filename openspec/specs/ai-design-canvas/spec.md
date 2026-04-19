## Purpose

Define the baseline product requirements for the AI design canvas, including canvas content, editing behaviors, asset management, generation lifecycle visibility, and project recovery/export flows.
## Requirements
### Requirement: Canvas supports design-oriented nodes
The system SHALL support a board model that can represent image nodes and text nodes in addition to existing simple geometric content so users can compose design assets on the infinite canvas.

#### Scenario: Insert an uploaded image onto the board
- **WHEN** a user uploads an image asset and chooses to place it on the canvas
- **THEN** the system creates an image node on the board with position and size metadata

#### Scenario: Create a text node on the board
- **WHEN** a user invokes text creation and enters content
- **THEN** the system creates a text node that remains editable after placement

### Requirement: Canvas nodes remain directly editable
The system SHALL allow users to select supported canvas nodes and perform basic editing operations needed for layout composition, and SHALL keep those interactions responsive while preserving one committed undoable mutation per completed edit gesture.

#### Scenario: Move a placed image
- **WHEN** a user selects an image node and drags it
- **THEN** the system updates the node position on the board

#### Scenario: Resize a placed node
- **WHEN** a user selects a supported node and performs a resize action
- **THEN** the system updates the node bounds while preserving a valid render state

#### Scenario: Reorder stacked objects
- **WHEN** a user changes the layer order of overlapping nodes
- **THEN** the system renders the nodes in the updated visual order

#### Scenario: Drag interaction commits as one undoable change
- **WHEN** a user completes a drag or resize gesture that changes a node
- **THEN** the system records the completed gesture as a single undoable mutation rather than one history entry per intermediate movement frame

### Requirement: Assets persist independently from board placement
The system SHALL track uploaded and generated images as reusable assets separate from their placement on the board.

#### Scenario: Generated asset appears in asset storage
- **WHEN** an image generation job completes successfully
- **THEN** the resulting image is recorded as an asset that can be inserted into the board

#### Scenario: Asset remains available after refresh
- **WHEN** a user refreshes the application after uploading or generating an image
- **THEN** the asset remains available to reinsert or continue editing from local persistence

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

### Requirement: Sidebar chat uses a real agent service
The system SHALL connect the existing design chat sidebar to the agent service instead of generating assistant replies entirely in local mock frontend logic.

#### Scenario: Submit a sidebar message to the agent service
- **WHEN** a user sends a chat message from the sidebar
- **THEN** the frontend sends that message and current canvas context to the agent service and renders the returned assistant response in the conversation thread

#### Scenario: Continue chat after refresh with persisted service metadata
- **WHEN** a user refreshes the application during an active design conversation
- **THEN** the frontend restores locally persisted chat history and any stored conversation metadata needed to continue the same service-backed thread

### Requirement: Sidebar applies structured agent effects without replacing local board ownership
The system SHALL interpret structured agent effect payloads from the service and apply them through the existing frontend board state and interaction model.

#### Scenario: Agent effect inserts canvas text
- **WHEN** the agent service returns a text-insertion effect
- **THEN** the frontend applies that effect through the existing board state workflow so the new text node participates in local undo/redo and persistence behavior

#### Scenario: Agent effect starts a follow-up design action
- **WHEN** the agent service returns a style-variation or generation-follow-up effect
- **THEN** the frontend triggers the corresponding local canvas workflow without breaking the visible chat context

### Requirement: Editor provides a persistent right-side agent chat sidebar
The system SHALL provide a persistent chat-oriented sidebar on the right side of the canvas editor so users can continue design work through conversation while keeping the board visible.

#### Scenario: Open the editor with agent sidebar enabled
- **WHEN** a user opens the infinite canvas editor
- **THEN** the interface shows a right-side assistant panel that remains available alongside the canvas

#### Scenario: Keep canvas usable while sidebar is visible
- **WHEN** the sidebar is present
- **THEN** the canvas and existing editing controls remain usable without leaving the current board

### Requirement: Sidebar chat supports explicit session-based conversations
The system SHALL support multiple sidebar chat sessions within the same canvas project and SHALL allow the project to have no active session by default.

#### Scenario: Sidebar shows empty-state when no session exists
- **WHEN** a project has no chat sessions
- **THEN** the sidebar shows an empty-state UI instead of rendering a conversation thread

#### Scenario: User creates a new session
- **WHEN** a user creates a new chat session from the sidebar
- **THEN** the system creates a new active session with an empty message list

#### Scenario: User switches between sessions
- **WHEN** a user selects a different chat session in the sidebar
- **THEN** the sidebar renders the selected session's messages and uses that session's conversation identifiers for subsequent agent-service requests

### Requirement: Session switching does not branch the shared board state
The system SHALL treat chat sessions as conversation contexts around one shared canvas, not as separate board snapshots.

#### Scenario: Switching sessions preserves board content
- **WHEN** a user switches from one chat session to another
- **THEN** the current board, assets, jobs, and viewport remain unchanged

### Requirement: Legacy single-thread chat is not auto-migrated into a visible default session
The system SHALL not create a visible default session from legacy single-thread chat data when multi-session chat is enabled.

#### Scenario: Load a legacy project with old chat fields
- **WHEN** a previously saved project contains only the legacy single-thread chat shape
- **THEN** the project remains readable, but the sidebar does not surface that legacy thread as an auto-created session

### Requirement: Assistant replies can include suggested next actions
The system SHALL allow assistant responses to present relevant follow-up actions that help users continue editing or generation workflows.

#### Scenario: Show actionable suggestions after an assistant response
- **WHEN** the assistant returns a response about a design task
- **THEN** the interface presents one or more suggestion chips or buttons for likely next steps

#### Scenario: Trigger a suggested action
- **WHEN** a user chooses a suggested follow-up action from the assistant panel
- **THEN** the system initiates the corresponding editor or generation flow without breaking the conversation context

### Requirement: Editor chrome is canvas-first and visually lightweight
The system SHALL present the AI design canvas with a visually lightweight interface where the board remains the dominant surface and primary controls are expressed as compact floating chrome rather than heavy fixed panels.

#### Scenario: Open the editor
- **WHEN** a user loads the canvas editor
- **THEN** the interface presents a largely unobstructed board with compact floating controls for navigation and primary actions

#### Scenario: Access prompt and asset actions without full sidebars
- **WHEN** a user wants to generate content or insert existing assets
- **THEN** the system exposes those actions through compact floating surfaces that do not visually dominate the canvas

### Requirement: Object editing controls appear contextually near the selection
The system SHALL surface common object editing controls near the currently selected node so users can inspect and adjust the selection without relying solely on a distant full-height inspector.

#### Scenario: Select an object on the canvas
- **WHEN** a user selects a supported node
- **THEN** the interface shows a contextual floating toolbar near that selection with relevant controls or object metadata

#### Scenario: Edit dimensions from contextual controls
- **WHEN** a user adjusts object sizing or ordering from the contextual selection chrome
- **THEN** the system applies those changes while preserving the current editing behavior

### Requirement: Canvas objects expose consistent hover and selection feedback
The system SHALL provide a consistent visual feedback hierarchy for hover and selection across supported canvas object types so users can predict what will be selected before committing an action.

#### Scenario: Hover preview on a selectable object
- **WHEN** a user moves the pointer over a selectable canvas object while not actively dragging, resizing, or editing another object
- **THEN** the system shows a lightweight hover preview for the top-most hit object without entering full editing mode

#### Scenario: Hover leaves empty space
- **WHEN** a user moves the pointer away from selectable objects onto empty canvas space
- **THEN** the system clears the hover preview and returns to the resting visual state

### Requirement: Selection and editing feedback use distinct visual layers
The system SHALL distinguish between selected objects and actively editable objects so users can understand whether an object is merely selected or currently exposing editable controls.

#### Scenario: Selected object enters contextual editing state
- **WHEN** a user selects a supported canvas object
- **THEN** the system shows a stable selected-state chrome and may surface contextual controls near that object

#### Scenario: Editable handles only appear in editing state
- **WHEN** an object is selected but not in a handle-editing interaction
- **THEN** the system does not escalate hover preview into full editable handle exposure unless the object type requires explicit edit handles for the current interaction

### Requirement: Connector editing feedback participates in the same interaction hierarchy
The system SHALL keep connector-specific anchor and handle affordances while aligning them with the shared hover, selected, and editing feedback model.

#### Scenario: Connector segment hover preview
- **WHEN** a user hovers a selectable connector segment in the select tool
- **THEN** the system shows connector hover feedback before selection using the same visual hierarchy as other objects

#### Scenario: Connector handles appear only during editable selection
- **WHEN** a user selects a connector and enters endpoint or waypoint editing
- **THEN** the system shows endpoint and bend-point handles as editing affordances without replacing the selected-state chrome

### Requirement: Canvas nodes support anchored connectors
The system SHALL allow supported canvas nodes to be connected through anchored connectors so users can express stable relationships between elements on the board.

#### Scenario: Create a connector between two supported nodes
- **WHEN** a user uses the connector tool and drags from a valid anchor on one supported node to a valid anchor on another supported node
- **THEN** the system creates a connector object that remains attached to both nodes through those anchors

#### Scenario: Connector creation requires valid anchors
- **WHEN** a user starts connector creation but releases on empty space or an unsupported target
- **THEN** the system does not create a connector and exits the connector preview state without modifying the board

### Requirement: Anchored connectors stay synchronized with node geometry
The system SHALL recompute anchored connector endpoints from the connected nodes so connectors remain visually attached when node geometry changes.

#### Scenario: Connected node moves
- **WHEN** a user drags a node that has one or more anchored connectors
- **THEN** the connector endpoints update to the node's current anchor positions without breaking the attachment relationship

#### Scenario: Connected node resizes
- **WHEN** a user resizes a node that has one or more anchored connectors
- **THEN** the connector endpoints update to the resized node's current anchor positions

### Requirement: Anchored connectors are directly editable
The system SHALL allow users to select a connector and reattach its endpoints through anchor-based editing.

#### Scenario: Reattach a connector endpoint
- **WHEN** a user selects a connector and drags one endpoint handle to a valid anchor on another supported node
- **THEN** the system updates that endpoint attachment to the new node and anchor

#### Scenario: Invalid endpoint reattachment reverts
- **WHEN** a user drags a selected connector endpoint but releases without hitting a valid anchor
- **THEN** the system keeps the original endpoint attachment unchanged

### Requirement: Anchored connectors support polyline paths
The system SHALL allow anchored connectors to be represented and edited as polyline paths with one or more intermediate bend points.

#### Scenario: Create a polyline connector
- **WHEN** a user creates a connector using the polyline path mode between two valid anchors
- **THEN** the system creates a connector whose rendered path includes intermediate bend points between the attached endpoints

#### Scenario: Edit polyline bend point
- **WHEN** a user selects a polyline connector and drags one of its bend point handles
- **THEN** the system updates that bend point and rerenders the connector path without breaking endpoint attachments

#### Scenario: Polyline connector survives reload
- **WHEN** a user saves or reloads a board containing polyline connectors
- **THEN** the system restores the connector path mode and bend points together with its endpoint attachments

### Requirement: Anchored connectors participate in persistence and history
The system SHALL persist anchored connectors in the local project document and include their mutations in undo/redo history.

#### Scenario: Connector survives reload
- **WHEN** a user creates one or more connectors and reloads the application
- **THEN** the system restores the connectors and their endpoint attachments from local persistence

#### Scenario: Undo connector creation
- **WHEN** a user creates a connector and then performs undo
- **THEN** the system removes the connector from the board and restores the previous board state

### Requirement: Connector relationships remain valid when nodes are removed
The system SHALL prevent dangling anchored connectors by removing connectors whose attached nodes are deleted.

#### Scenario: Delete a connected node
- **WHEN** a user deletes a node that is referenced by one or more connector endpoints
- **THEN** the system removes those connectors as part of the same mutation so no invalid attachment remains

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

### Requirement: 画布编辑器提供与视口同步的刻度尺
系统 SHALL 在画布工作区顶部和左侧提供始终可见的刻度尺，用于表达当前无限画布的空间坐标，并与当前 viewport 的平移和缩放保持同步。

#### Scenario: 打开画布时显示刻度尺
- **WHEN** 用户打开画布编辑器
- **THEN** 界面在画布顶部和左侧显示可见的刻度尺，而不要求用户先进入额外模式

#### Scenario: 平移视口时刻度尺连续更新
- **WHEN** 用户拖动画布进行平移
- **THEN** 刻度尺中的刻度位置与数字读数随 viewport 连续更新，并保持与当前 world 坐标对齐

#### Scenario: 缩放视口时刻度密度调整
- **WHEN** 用户通过滚轮或触控手势缩放画布
- **THEN** 刻度尺根据缩放级别调整主次刻度间距，使读数在常见缩放级别下仍保持可读

### Requirement: 刻度尺保持连续的 world 坐标语义
系统 SHALL 以现有 world 坐标系为刻度尺语义基础，并在原点移出当前视口后继续显示连续坐标，包括负坐标区域。

#### Scenario: 原点位于可视区域内
- **WHEN** viewport 覆盖 world 坐标原点附近区域
- **THEN** 刻度尺显示与原点一致的坐标读数，使用户能够识别 `0` 所在位置

#### Scenario: 原点移出可视区域
- **WHEN** 用户将画布平移到原点之外的区域
- **THEN** 刻度尺仍显示连续坐标读数，并在需要时显示负值，而不是重置为局部伪坐标

### Requirement: 刻度尺可投影当前选中对象的范围
系统 SHALL 在用户选中画布对象时，在顶部和左侧刻度尺上显示该对象覆盖的坐标范围，帮助用户理解对象在画布中的位置和跨度。

#### Scenario: 选中对象后显示横向范围
- **WHEN** 用户选中一个具有边界框的画布对象
- **THEN** 顶部刻度尺高亮该对象在 `x` 轴上覆盖的范围

#### Scenario: 选中对象后显示纵向范围
- **WHEN** 用户选中一个具有边界框的画布对象
- **THEN** 左侧刻度尺高亮该对象在 `y` 轴上覆盖的范围

#### Scenario: 取消选择时移除对象范围投影
- **WHEN** 用户取消当前对象选择
- **THEN** 刻度尺不再保留上一对象的范围高亮

### Requirement: 画布对象拖拽支持轻量对齐吸附
系统 SHALL 在用户拖拽画布对象时提供轻量吸附能力，使对象可以对齐到其他对象的边缘与中心线，并在命中时提供清晰的可视反馈。

#### Scenario: 拖拽对象接近另一对象边缘时发生吸附
- **WHEN** 用户拖拽对象，且该对象边缘进入另一对象对应边缘的吸附阈值范围
- **THEN** 系统将拖拽对象对齐到目标边缘，并显示对应的命中反馈

#### Scenario: 拖拽对象接近中心线时发生吸附
- **WHEN** 用户拖拽对象，且该对象中心进入另一对象中心线的吸附阈值范围
- **THEN** 系统将拖拽对象对齐到目标中心线，并显示对应的命中反馈

#### Scenario: 未命中吸附阈值时保持自由拖拽
- **WHEN** 用户拖拽对象，但不存在进入吸附阈值的有效对齐目标
- **THEN** 系统保持现有自由拖拽行为，不强制修正对象位置

### Requirement: Sidebar chat composer supports voice transcription as a draft input path
The system SHALL let users create chat input from a recorded voice clip inside the sidebar composer without automatically sending a message to the assistant.

#### Scenario: User records a voice prompt from the chat composer
- **WHEN** the user taps the recording control beside the send button and grants microphone access
- **THEN** the system starts recording audio from the sidebar composer and shows that recording is in progress

#### Scenario: Transcript is editable before send
- **WHEN** the user stops recording and the backend transcription request succeeds
- **THEN** the system inserts the transcript into the existing chat input and leaves it editable until the user explicitly sends the message

#### Scenario: Transcription failure does not create chat history
- **WHEN** a transcription request fails because of upload validation, provider failure, or microphone issues
- **THEN** the system surfaces a recoverable error in the composer and does not append a new user message or assistant response to the active chat session

### Requirement: Agent API supports audio transcription for chat input
The system SHALL expose a backend endpoint that accepts recorded audio and returns transcribed text for the sidebar chat workflow.

#### Scenario: Valid audio upload returns transcript text
- **WHEN** the client submits a supported audio recording to the transcription endpoint
- **THEN** the system returns a successful response containing the transcribed text and no assistant chat side effects

#### Scenario: Unsupported upload is rejected
- **WHEN** the client submits an empty payload, an unsupported media type, or an invalid multipart request
- **THEN** the system rejects the request with a non-success response that explains the validation failure

### Requirement: Canvas node behavior uses a shared engine contract
The system SHALL route supported canvas node behavior through a shared render-engine contract so rendering, bounds calculation, and hit testing stay consistent across node types.

#### Scenario: Existing supported node types render through the shared contract
- **WHEN** the application renders a board containing freehand, rectangular, text, image, or video nodes
- **THEN** the system resolves each supported node type through the shared engine contract instead of requiring separate hard-coded dispatch paths for render, bounds, and hit testing

#### Scenario: A supported node type exposes its behavior in one place
- **WHEN** a developer implements or updates behavior for a supported canvas node type
- **THEN** the node's rendering, bounds, and hit-testing behavior are defined through the same engine adapter or registry entry

### Requirement: Runtime rendering state remains separate from persisted project data
The system SHALL keep render-time caches and resource helpers out of the persisted canvas project schema so existing projects remain compatible with local persistence and history behavior.

#### Scenario: Runtime caches are recreated after loading a saved project
- **WHEN** the application restores a previously saved project from local persistence
- **THEN** the system recreates any render-time caches or resource lookup structures from the saved document data without requiring new persisted fields

#### Scenario: Undo and redo operate on document data rather than runtime cache state
- **WHEN** a user performs undo or redo after editing supported nodes
- **THEN** the system restores the document state without serializing or replaying transient render-engine cache data

### Requirement: Canvas viewport interactions remain responsive during active manipulation
The system SHALL keep pan, pinch, and wheel-zoom interactions visually responsive by avoiding unnecessary non-canvas work on each input frame and by applying viewport updates on a paint-aligned schedule.

#### Scenario: Panning does not require app-wide committed state on every pointer frame
- **WHEN** a user pans the canvas continuously
- **THEN** the system updates the visible viewport responsively without requiring a committed whole-project store update for each raw pointer event

#### Scenario: Zooming remains paint-aligned
- **WHEN** a user performs continuous wheel zoom or pinch zoom
- **THEN** the system applies viewport changes on a paint-aligned schedule that preserves direct manipulation feel

### Requirement: Automatic persistence does not block active canvas manipulation
The system SHALL preserve local-first project saving without synchronously serializing and writing the entire project on every active drag, resize, pan, or zoom frame.

#### Scenario: Dragging defers automatic save work
- **WHEN** a user continuously drags or resizes a node
- **THEN** automatic persistence does not synchronously write the full project on each intermediate movement frame

#### Scenario: Committed edits still become recoverable
- **WHEN** a user finishes an interaction that changes the board
- **THEN** the system persists the committed project state soon after completion so the latest board remains recoverable after refresh
