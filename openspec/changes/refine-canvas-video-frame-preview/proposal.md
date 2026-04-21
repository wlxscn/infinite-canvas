## Why

当前画板视频元素在真实 `<video>` 尚未加载或不可播放时，只显示通用深色 `Video preview` 底图，无法反映视频内容本身。用户希望不依赖后端 poster，而是在前端直接从视频截取一帧作为画板视频元素的预览底图，使视频素材在画布和素材栏中更容易识别。

## What Changes

- 为视频素材增加前端截帧预览能力：视频素材创建后异步读取视频帧并生成可持久化的帧图。
- 画布视频节点在真实视频 overlay 未 ready 或不可用时，优先显示截帧底图。
- 截帧失败不阻塞视频插入、生成结果落库或画布编辑；系统继续显示现有 fallback。
- 视频节点插入时保持原始视频宽高比例，避免预览画面被非预期拉伸或裁切。
- 不引入后端 poster 依赖，也不要求生成服务返回额外静态图。

## Capabilities

### New Capabilities

- 无

### Modified Capabilities

- `ai-design-canvas`: 视频素材应能基于客户端截帧显示内容相关的画板预览，并在截帧失败时保持可用 fallback。

## Impact

- 影响前端画板视频展示链路：`apps/web/src/canvas/VideoOverlayLayer.tsx`、视频资产创建与插入流程、素材栏预览。
- 影响共享画布渲染引擎的视频 adapter 与 runtime asset 类型，使 canvas fallback 可以绘制截帧图片。
- 影响持久化项目 JSON 形状：视频资产可新增可选的截帧图片字段；旧项目仍可读取。
- 不改变后端生成接口合同，不新增运行时依赖，不改变 undo/redo 的文档 mutation 语义。
