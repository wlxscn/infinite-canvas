## ADDED Requirements

### Requirement: 画布对象暴露显式旋转控制
系统 SHALL 为支持旋转的画布对象提供显式旋转交互，使用户可以在不切换独立工具的情况下通过选择后的 rotate handle 调整对象角度。

#### Scenario: 选中节点后显示 rotate handle
- **WHEN** 用户在画布上选中一个支持旋转的单个节点或单个 group
- **THEN** 系统显示与该对象选择 chrome 对齐的悬浮 rotate handle

#### Scenario: 拖拽 rotate handle 旋转对象
- **WHEN** 用户拖拽已选对象的 rotate handle 完成一次旋转手势
- **THEN** 系统更新该对象的旋转角度并立即以新的视觉方向渲染该对象

### Requirement: 旋转结果参与持久化与历史记录
系统 SHALL 持久化支持旋转对象的角度信息，并将一次完整旋转手势作为单条可撤销历史记录处理。

#### Scenario: 旋转后刷新仍恢复角度
- **WHEN** 用户旋转一个支持旋转的对象并刷新应用
- **THEN** 系统从本地持久化中恢复该对象的旋转角度与对应渲染结果

#### Scenario: 撤销恢复旋转前状态
- **WHEN** 用户完成一次旋转手势后执行 undo
- **THEN** 系统将该对象恢复到本次旋转手势开始前的角度与几何状态

### Requirement: group 整体旋转保持子节点视觉关系
系统 SHALL 允许 group 作为整体编辑单元被旋转，并在组内子节点、connector 与拆组结果之间保持一致的视觉几何关系。

#### Scenario: 旋转 group 后子节点随之更新
- **WHEN** 用户旋转一个包含多个子节点的 group
- **THEN** 系统以该 group 的旋转结果重新解析其子节点的世界几何，并保持子节点相对布局不变

#### Scenario: 旋转后的 group 拆组保持视觉位置
- **WHEN** 用户对已经旋转过的 group 执行拆组
- **THEN** 系统恢复出的子节点在世界空间中的位置与朝向应与拆组前视觉结果一致

## MODIFIED Requirements

### Requirement: Canvas nodes remain directly editable
The system SHALL allow users to select supported canvas nodes and perform basic editing operations needed for layout composition, including rotation for supported object types, and SHALL keep those interactions responsive while preserving one committed undoable mutation per completed edit gesture.

#### Scenario: Move a placed image
- **WHEN** a user selects an image node and drags it
- **THEN** the system updates the node position on the board

#### Scenario: Resize a placed node
- **WHEN** a user selects a supported node and performs a resize action
- **THEN** the system updates the node bounds while preserving a valid render state

#### Scenario: Rotate a supported object
- **WHEN** a user selects a supported node or group and completes a rotate-handle gesture
- **THEN** the system updates that object's rotation while preserving a valid render state

#### Scenario: Reorder stacked objects
- **WHEN** a user changes the layer order of overlapping nodes
- **THEN** the system renders the nodes in the updated visual order

#### Scenario: Drag interaction commits as one undoable change
- **WHEN** a user completes a drag, resize, or rotate gesture that changes a node
- **THEN** the system records the completed gesture as a single undoable mutation rather than one history entry per intermediate movement frame

### Requirement: Anchored connectors stay synchronized with node geometry
The system SHALL recompute anchored connector endpoints from the connected nodes so connectors remain visually attached when node geometry changes, including movement, resize, and rotation of supported nodes or groups.

#### Scenario: Connected node moves
- **WHEN** a user drags a node that has one or more anchored connectors
- **THEN** the connector endpoints update to the node's current anchor positions without breaking the attachment relationship

#### Scenario: Connected node resizes
- **WHEN** a user resizes a node that has one or more anchored connectors
- **THEN** the connector endpoints update to the resized node's current anchor positions

#### Scenario: Connected node rotates
- **WHEN** a user rotates a supported node or rotates a group containing a connector-attached child node
- **THEN** the connector endpoints update to the rotated node's current anchor positions without breaking the attachment relationship
