## 1. 数据模型与截帧工具

- [x] 1.1 扩展 `AssetRecord` 与 canvas-engine runtime asset 类型，增加可选 `frameSrc` 字段并保持旧项目兼容。
- [x] 1.2 新增前端视频截帧工具，支持加载视频、seek 到非零时间点、绘制到离屏 canvas 并输出 JPEG data URL。
- [x] 1.3 为截帧失败、跨域失败或超时设计非阻塞调用路径，确保失败只记录调试信息，不影响素材插入。

## 2. 视频素材创建与插入

- [x] 2.1 在生成视频结果和 agent 插入视频效果创建素材后触发异步截帧，并在成功后更新对应 asset。
- [x] 2.2 调整视频/图片节点默认插入尺寸，按素材比例等比缩放到最大边界，避免视频预览变形。
- [x] 2.3 让素材栏视频卡片优先使用截帧静态图作为预览，真实视频仅作为可用兜底。

## 3. 画板渲染

- [x] 3.1 更新 `videoNodeAdapter`，当视频 asset 有 `frameSrc` 且图片已加载时绘制截帧底图。
- [x] 3.2 保留现有视频 fallback、播放图标和 hover/selection overlay，确保无截帧或截帧加载失败时仍可识别视频节点。

## 4. 验证

- [x] 4.1 补充或更新 unit tests，覆盖视频 asset 的 `frameSrc` 兼容性、等比插入尺寸和 video adapter 截帧绘制路径。
- [x] 4.2 更新 E2E 种子项目，验证带 `frameSrc` 的视频节点仍保持 hover/selection chrome 行为。
- [x] 4.3 运行 `pnpm test`，并按需要运行相关 Playwright 测试。
