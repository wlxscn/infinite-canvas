## Why

当前画布引擎的几何模型几乎完全建立在轴对齐矩形之上：节点只保存 `x/y/w/h`，命中、选中框、锚点、组内偏移和 connector 几何都默认未旋转。这让用户无法完成基础的版式旋转，也让 group 与 connector 在更复杂排布下缺少必要的编辑能力。

现在推进旋转能力的价值在于补齐画布编辑的核心缺口，但范围必须保持克制：第一版只把渲染、命中、旋转交互和 connector 同步推进到可用状态，不把整套画布一次性重写成完整的通用 2D 变换系统。

## What Changes

- 为支持旋转的画布元素补充旋转语义，并在文档模型、渲染、命中测试和选择反馈中统一生效。
- 在选择 chrome 中提供悬浮式 rotate handle，使用户可以直接对选中元素执行旋转手势。
- 让 group 支持整体旋转，并保证其子节点世界坐标解析、connector 派生几何和拆组后的视觉结果保持一致。
- 调整 connector 几何解析，使附着在节点或 group 子节点上的 connector 会随节点旋转后的锚点位置自动重算。
- 明确第一版继续允许 marquee selection、snap、ruler 等派生反馈使用旋转后 AABB，而不是引入完整 OBB 命中和精确吸附。
- 扩展本地持久化与 undo/redo，使旋转角度、旋转手势提交边界和兼容读取语义清晰可验证。
- 明确第一版非目标：
  - 不引入完整矩阵编辑系统或通用 transform inspector
  - 不支持 freehand 旋转
  - 不要求 marquee / snap / ruler 升级为基于 OBB 的精确几何
  - 不在本次变更中扩展到新的 layout / frame / clip 语义

## Capabilities

### New Capabilities
<!-- None -->

### Modified Capabilities
- `ai-design-canvas`: 画布节点编辑、group 几何、connector 派生锚点、持久化与选择反馈将扩展为支持旋转语义

## Impact

- 主要影响 `packages/canvas-engine` 的 `model.ts`、`geometry.ts`、`hierarchy.ts`、`anchors.ts`、`scene.ts`、`controller.ts` 与各类 node adapter；这些模块当前都默认节点为轴对齐几何。
- 主要影响 `apps/web/src/canvas/CanvasStage.tsx`、工作区选择控制器与选择工具栏；用户将看到新的 rotate handle 和旋转后的选择反馈。
- 会影响本地项目 schema 与持久化读取逻辑；需要让旧项目在缺少旋转字段时继续可读。
- 会影响 undo/redo 语义；旋转手势需要继续保持“一次完整交互一条历史记录”。
- 会影响 group 与 connector 相关测试；需要补充单位测试和 E2E 来覆盖旋转、拆组和附着线同步。
