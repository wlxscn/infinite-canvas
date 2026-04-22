## ADDED Requirements

### Requirement: Connector 支持曲线路径模式
系统 SHALL 允许 connector 以曲线路径模式创建和渲染，使连线可表示为平滑曲线而不是仅限于直线或折线。

#### Scenario: 创建曲线 connector
- **WHEN** 用户在 connector 工具下选择曲线路径模式，并从一个有效锚点拖拽到另一个有效锚点
- **THEN** 系统创建一个保持两端 attachment 的曲线 connector

#### Scenario: 曲线 connector 渲染为平滑路径
- **WHEN** 画布中存在曲线路径模式的 connector
- **THEN** 系统以平滑曲线而不是直线段或折线段渲染该 connector

### Requirement: 曲线 connector 支持编辑与重挂接
系统 SHALL 允许用户在保留曲线路径语义的前提下编辑曲线形状，并继续支持 endpoint 重挂接。

#### Scenario: 编辑曲线控制点
- **WHEN** 用户选中曲线 connector 并进入 editing 状态后拖拽其控制点
- **THEN** 系统更新曲线形状并立即重绘该 connector

#### Scenario: 曲线 connector 终点重挂接
- **WHEN** 用户拖拽曲线 connector 的某个 endpoint 到另一个有效锚点
- **THEN** 系统更新该 endpoint 的 attachment，并保持 connector 仍以曲线路径模式存在

### Requirement: 曲线 connector 参与持久化与历史
系统 SHALL 持久化曲线 connector 的路径模式和形状参数，并让其编辑操作参与现有 undo redo 与项目恢复流程。

#### Scenario: 曲线 connector 刷新后恢复
- **WHEN** 用户保存或刷新包含曲线 connector 的项目
- **THEN** 系统恢复该 connector 的曲线路径模式、attachment 和形状参数

#### Scenario: 曲线编辑作为一次历史变更提交
- **WHEN** 用户完成一次曲线控制点拖拽或 endpoint 重挂接手势
- **THEN** 系统将该完整手势记录为一条可撤销变更，而不是为中间每一帧单独记录历史
