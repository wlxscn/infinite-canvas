## Context

当前生成媒体链路有两条入口：

```text
/generate-image 或 /generate-video
  -> image/video controller
  -> createMiniMaxService()
  -> 返回供应商 URL
  -> web 创建 AssetRecord.src

/chat
  -> tool runner
  -> createMiniMaxService()
  -> insert-image / insert-video effect
  -> web 创建 AssetRecord.src
```

两条入口最终都会把 MiniMax 返回的 `imageUrl` 或 `videoUrl` 交给前端。前端不会下载媒体内容，只把 URL 保存进资产记录、项目快照和后续画布渲染路径。正在进行的 Supabase 项目持久化变更会保存完整 `CanvasProject` JSONB，但它只负责项目元数据和文档快照，不负责媒体二进制内容。

因此 Cloudflare 转存应落在 agent-api 生成结果返回之前，而不是前端资产创建之后。这样前端仍然只处理稳定 URL，且项目快照不会被供应商临时链接污染。

## Goals / Non-Goals

**Goals:**

- 在 agent-api 内为生成图片和生成视频建立统一的 Cloudflare R2 归档路径。
- 保证 `/generate-image`、`/generate-video` 和 chat tool effect 返回给前端的媒体 URL 都是应用托管 URL。
- 保持现有前端 `AssetRecord`、生成 job、agent effect 和项目快照结构兼容。
- 在 Cloudflare 未配置或上传失败时返回明确的可恢复错误，避免把供应商临时 URL 当作成功资产持久化。
- 为图片、视频设置正确 content type、对象 key 和可诊断元数据。
- 支持浏览器直接读取生成媒体，并为视频截帧所需的 CORS 配置留出明确要求。

**Non-Goals:**

- 不实现 Cloudflare Images、Cloudflare Stream、转码、缩略图服务或媒体管理后台。
- 不实现前端直传 Cloudflare、用户上传图片转存、历史资产迁移或清理任务。
- 不拆分 `CanvasProject.assets` 到数据库实体表，也不改变 `CanvasProject.version`。
- 不引入用户级访问控制、私有签名下载 URL、配额计费或多租户隔离策略；对象 key 可预留 project/provider 信息，但第一版以生成结果可稳定恢复为主。

## Decisions

### 1. 使用 Cloudflare R2 作为第一版生成媒体存储

选择 R2 而不是 Cloudflare Images 或 Stream，是因为当前产品只需要把生成图片和 MP4 视频作为可复用画布资产保存并渲染。R2 的 S3-compatible API 可以用同一套上传逻辑覆盖图片和视频，并保持前端继续通过普通 URL 加载资源。

备选方案：

- Cloudflare Images：适合图片变体和优化，但无法统一覆盖视频，会导致图片和视频两套归档模型。
- Cloudflare Stream：适合视频转码和播放控制，但当前画布已有 `<video>` overlay，第一版不需要引入流媒体播放体系。
- Supabase Storage：和项目持久化更近，但用户目标是 Cloudflare，且 R2 更适合独立承载生成媒体对象。

### 2. 在 MiniMax 生成后、controller/tool effect 返回前同步转存

数据流：

```text
MiniMax result URL
  │
  ▼
agent-api fetch media bytes
  │
  ▼
R2 put object
  │
  ▼
Cloudflare public URL
  │
  ├─ /generate-image response
  ├─ /generate-video response
  └─ /chat insert-image / insert-video effect
```

同步转存让前端只看到最终 URL，避免异步替换资产 URL、二次保存项目、或者在 job success 后再回滚。生成响应会变慢，但媒体生成本身已经是长耗时操作，额外下载/上传成本比模型等待时间更容易接受。

备选方案是先返回供应商 URL，再后台转存并更新资产。这会要求前端支持资产 URL 替换、失败状态回写、项目重新保存，以及 chat message 中 effect URL 的一致性处理，范围明显扩大。

### 3. 新增独立 media storage service

在 `apps/agent-api/src/services` 增加 Cloudflare/R2 媒体存储服务，职责包括：

- 读取 Cloudflare R2 配置。
- 根据媒体类型、provider、request/task/file id 和时间生成对象 key。
- 从供应商 URL 下载媒体内容，限制可接受 content type 和响应大小。
- 上传对象到 R2，并设置 `Content-Type`、`Cache-Control` 和调试元数据。
- 返回浏览器可访问的 public URL。

`createMiniMaxService()` 可以继续只负责 MiniMax 协议细节，也可以在返回前调用归档 helper；更清晰的边界是让 controller 和 tool runner 调用一个生成后归档包装函数，避免 provider service 直接依赖 Cloudflare。实现时可提取：

```text
generateImageWithStorage(prompt)
generateVideoWithStorage(prompt)
```

或者把归档注入到 tool runner/controller 中。关键约束是两条生成入口必须复用同一套归档逻辑，不能只修 direct endpoint 而漏掉 chat tool effect。

### 4. 使用 public/custom-domain URL 作为前端持久 URL

第一版建议返回稳定 public URL，例如：

```text
https://<media-domain>/generated/images/<yyyy>/<mm>/<id>.jpg
https://<media-domain>/generated/videos/<yyyy>/<mm>/<id>.mp4
```

这样 `AssetRecord.src` 可以长期保存在项目 JSON 中，不会因为签名 URL 过期而导致项目恢复后资源失效。R2 bucket 或前置域名需要配置公开读取与合适 CORS。

备选方案是返回 signed GET URL。它更私密，但 URL 会过期，不适合直接写入当前项目快照；除非同时引入资产 token、刷新接口和前端运行时换签机制，这超出本变更范围。

### 5. Cloudflare 配置缺失时生成应失败而不是降级保存供应商 URL

如果生成结果已经拿到但 Cloudflare 未配置或上传失败，后端应返回 502/503 风格的可恢复错误，前端保持当前 pending job -> failed job 行为。不能把 MiniMax URL 作为 fallback 成功返回，因为这会重新引入本变更要移除的临时依赖，并使项目中混入不可控 URL。

本地开发可以通过环境变量明确启用/禁用该能力。若需要无 Cloudflare 的本地生成调试，可后续增加显式开发开关，但默认生产语义应是“生成成功必须完成归档”。

### 6. 前端模型保持兼容，但视频截帧需要 CORS 配套

前端仍使用：

- `AssetRecord.src`
- `posterSrc`
- `frameSrc`
- `GenerationJob.assetId`
- `insert-image` / `insert-video` effect

不需要改变 `CanvasProject.version`。旧项目中的供应商 URL 仍按旧数据读取，不做迁移。

视频截帧路径 `captureVideoFrame` 需要 Cloudflare 响应允许匿名跨域读取，且前端应对非 data/blob 视频设置合适的 `crossOrigin`。否则视频能播放但 canvas 截帧可能失败。这个行为属于本变更的兼容修复范围，因为转存后资源域名会从供应商变为应用媒体域名。

## Risks / Trade-offs

- [生成响应更慢] → 同步转存会增加一次下载和一次上传；通过复用流式下载/上传、合理超时和日志定位成本，第一版接受这部分延迟以换取资产稳定性。
- [大视频占用内存] → 避免把视频完整读入内存后再上传；优先使用 Web Streams/Node streams 或 Blob/ArrayBuffer 的大小限制，至少在第一版设置最大字节数并对超限失败。
- [Cloudflare 配置错误导致生成不可用] → 环境校验和错误码要明确；测试覆盖未配置和上传失败路径。
- [公开 URL 暴露生成内容] → 第一版以可恢复和可渲染为优先；如果后续需要私有资产，应另立变更设计签名读 URL 与刷新机制。
- [CORS 配置不完整导致视频截帧失败] → R2/custom domain 必须允许 web origin 读取图片/视频；前端截帧失败仍应非阻塞并保留 fallback。
- [历史项目仍可能包含供应商 URL] → 不做自动迁移；新生成资产开始使用 Cloudflare URL，历史资产保持 best-effort 读取。
