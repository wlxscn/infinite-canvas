## Overview

本变更在前端为视频素材生成 `frameSrc` 截帧图，并把它作为视频节点的静态预览底图。真实视频仍由现有 DOM overlay 负责播放，canvas engine 只负责在 overlay 未 ready、加载失败或渲染 fallback 时绘制截帧。

```
video asset created
  │
  ├─ insert asset/node immediately
  │
  └─ async capture frame
       │
       ├─ success: update asset.frameSrc
       └─ failure: keep existing fallback

canvas render
  │
  ├─ frameSrc image ready -> draw frame
  └─ otherwise -> draw existing video placeholder
```

## Data Model

`AssetRecord` 增加可选字段：

- `frameSrc?: string | null`

该字段保存前端截帧结果，通常为 `data:image/jpeg;base64,...`。字段可选以保持旧项目兼容；持久化层不需要迁移，现有 JSON 项目读写会自然保留字段。

仍保留现有 `posterSrc` 字段以兼容已有生成结果，但本变更的画板底图优先使用 `frameSrc`，不依赖 `posterSrc`。

## Frame Capture

新增前端工具函数从视频 URL 截取一帧：

- 创建离屏 `video` 元素。
- 对非 data/blob URL 设置 `crossOrigin = 'anonymous'`，让支持 CORS 的远程视频可被 canvas 读取。
- 等待 `loadedmetadata`。
- seek 到 `min(max(duration * 0.1, 0.1), duration)`，避免首帧黑屏。
- 在离屏 canvas 上按视频原始尺寸绘制当前帧。
- 输出 JPEG data URL。

异常策略：

- 加载、seek、canvas taint、`toDataURL` 或超时失败时 reject。
- 调用方吞掉失败并保留视频素材，不阻塞用户工作流。

## Rendering

`packages/canvas-engine/src/adapters/video.ts` 从 runtime asset 读取 `frameSrc`：

- `frameSrc` 存在且图片加载完成时，按视频节点 bounds 绘制截帧。
- `frameSrc` 不存在或加载失败时，继续绘制当前深色 fallback。
- 视频图标、边框和轻量标签仍保留，避免静态帧被误认为普通图片。

DOM overlay 继续负责真实视频播放状态。overlay 的 loading/error 状态可显示在截帧之上，但不再需要用纯深色底图表达内容。

## Aspect Ratio

视频节点插入时应按素材宽高等比缩放到最大约束范围，而不是分别限制宽高。这样 16:9 视频不会被变成 3:2，也减少截帧和真实视频之间的视觉偏差。

## Testing

- 单元测试覆盖截帧失败不会破坏资产形状的兼容性，以及 video adapter 可以使用 `frameSrc`。
- E2E 种子项目覆盖已有 `frameSrc` 的视频节点会渲染 overlay 并保持 hover/selection chrome。
- 若浏览器环境中可靠模拟真实截帧成本过高，截帧工具的端到端行为以 mock 成功/失败路径验证。

## Non-Goals

- 不实现完整视频播放控制条或时间轴编辑。
- 不把 canvas engine 改造成直接播放视频帧的渲染器。
- 不新增后端 poster 生成或媒体转码能力。
