## Why

当前 agent-api 从 MiniMax 生成图片和视频后，会把供应商返回的远程 URL 原样返回给前端，前端再把这些 URL 固化到 `AssetRecord.src` 并随项目快照持久化。这样生成资产的可恢复性依赖第三方下载链接的有效期、CORS 行为和访问策略，不适合作为长期画布资产来源。

本变更把生成媒体的持久化边界前移到 agent-api：在生成成功后先把图片/视频字节转存到 Cloudflare，再把 Cloudflare 托管 URL 返回给前端，确保项目保存的是应用可控的稳定媒体地址。

## What Changes

- 新增后端生成媒体归档能力：agent-api 在图片或视频生成成功后下载供应商媒体内容，并上传到 Cloudflare R2。
- `/generate-image`、`/generate-video` 和 agent chat tool effect 返回的 `imageUrl` / `videoUrl` 应指向 Cloudflare 托管地址，而不是 MiniMax 原始地址。
- 增加 Cloudflare R2 相关环境变量和配置校验，使本地开发可以明确知道媒体归档是否启用。
- 为图片和视频分别保存合理的对象 key、content type 和基础元数据，便于后续排查、缓存和资产治理。
- 当 Cloudflare 转存失败时，生成流程应以可恢复错误结束，不应把供应商临时 URL 当作成功生成资产持久化。
- 前端继续使用现有 `AssetRecord.src`、生成 job 和 agent effect 模型；本变更不引入前端直传 Cloudflare，也不改变画布文档版本。

## Capabilities

### New Capabilities

- `generated-media-cloudflare-storage`: 定义 agent-api 对生成图片和视频的 Cloudflare 转存、返回 URL、失败处理和配置要求。

### Modified Capabilities

- `ai-design-canvas`: 生成资产成功进入画布资产库时，应保存应用托管的稳定媒体 URL，而不是供应商临时 URL。
- `agent-chat-service`: agent 服务执行图片/视频生成工具时，应返回已转存到 Cloudflare 的媒体 effect。

## Impact

- 影响 `apps/agent-api` 的 MiniMax 生成链路、生成 controller、tool runner 和环境配置。
- 需要新增 Cloudflare R2/S3-compatible 上传依赖或轻量上传封装。
- 影响共享 API/effect 合同的语义：字段名仍可保持 `imageUrl` / `videoUrl`，但值的来源变为 Cloudflare 托管 URL。
- 影响前端视频截帧可靠性：Cloudflare 托管资源需要配置可被浏览器匿名读取的 CORS 头，否则 `captureVideoFrame` 仍可能无法稳定输出 `frameSrc`。
- 影响测试：需要覆盖生成成功后转存、转存失败、未配置 Cloudflare、本地 fallback 不污染已完成资产等路径。
- 不改变 project JSONB 快照结构，不拆分资产表，不实现用户级媒体权限、配额、清理任务、Cloudflare Stream 转码或完整媒体管理后台。
