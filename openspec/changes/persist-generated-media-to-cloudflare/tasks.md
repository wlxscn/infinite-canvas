## 1. Cloudflare 配置与依赖

- [x] 1.1 在 `apps/agent-api/package.json` 增加 R2/S3-compatible 上传所需依赖，并更新 workspace lockfile。
- [x] 1.2 扩展 `apps/agent-api/src/config/env.mjs`，读取 Cloudflare R2 account id、access key、secret key、bucket、public media base URL、可选 key prefix 和媒体大小限制。
- [x] 1.3 更新 `.env.example`，记录 Cloudflare 生成媒体转存所需变量和本地开发说明。
- [x] 1.4 为 Cloudflare 配置缺失或无效路径补充 agent-api 单元测试，确保错误可识别且不暴露密钥。

## 2. 后端媒体存储服务

- [x] 2.1 新增 `apps/agent-api/src/services/media-storage.service.mjs`，封装 R2 client 创建、对象 key 生成、content type 解析、上传和 public URL 拼接。
- [x] 2.2 实现从 provider URL 获取媒体内容的 helper，覆盖非 2xx、空响应、content type 不匹配、大小超限和超时。
- [x] 2.3 为图片和视频上传设置浏览器渲染所需 headers、缓存策略和调试 metadata。
- [x] 2.4 添加 media storage service 单元测试，覆盖图片上传、视频上传、key 唯一性、上传失败和下载失败。

## 3. 生成链路接入

- [x] 3.1 在 `/generate-image` controller 成功生成后调用媒体存储服务，并把响应 `imageUrl` 替换为 Cloudflare URL。
- [x] 3.2 在 `/generate-video` controller 成功生成并取回 provider download URL 后调用媒体存储服务，并把响应 `videoUrl` 替换为 Cloudflare URL。
- [x] 3.3 更新 `apps/agent-api/src/services/tool-runner.service.mjs`，确保 chat 的 `insert-image` 和 `insert-video` effects 复用同一套转存逻辑。
- [x] 3.4 确保 Cloudflare 转存失败时 direct generation endpoints 和 chat tool execution 都返回/映射为失败，不把 provider URL 作为成功资产返回。
- [x] 3.5 补充 controller 和 tool runner 测试，断言成功路径返回 Cloudflare media host，失败路径不包含 provider media URL。

## 4. 前端兼容与视频预览

- [x] 4.1 检查 shared API/effect 类型是否需要新增可选 metadata；若字段语义不变，则保持 `imageUrl` / `videoUrl` 合同兼容。
- [x] 4.2 更新前端生成相关测试 fixture，使新生成资产的 `src` 使用 Cloudflare media host。
- [x] 4.3 调整 `apps/web/src/utils/videoFrame.ts` 的远程视频截帧跨域加载行为，使 Cloudflare CORS 配置允许时能生成 `frameSrc`，同时保持失败非阻塞。
- [x] 4.4 补充或更新前端单元测试，覆盖 Cloudflare 视频 URL 截帧调用和截帧失败不影响 asset/job 状态。

## 5. 验证

- [x] 5.1 运行 `pnpm --filter @infinite-canvas/agent-api test`，验证后端媒体存储、controller 和 tool runner 行为。
- [x] 5.2 运行 `pnpm test`，验证前端和共享包单元测试。
- [x] 5.3 运行 `pnpm lint`，验证 workspace 静态检查。
- [x] 5.4 按需要运行 `pnpm test:e2e` 或相关 Playwright 用例，验证生成失败状态和视频预览不回归。
