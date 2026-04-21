## 1. 后端 Supabase 项目持久化

- [x] 1.1 在 `apps/agent-api/package.json` 增加 Supabase 客户端依赖，并更新 workspace lockfile。
- [x] 1.2 在 `apps/agent-api/src/config/env.mjs` 读取 `SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY`，并让缺失配置能被项目持久化 service 转换为可恢复错误。
- [x] 1.3 新增 Supabase `projects` 表 schema 或迁移 SQL 文档，包含 `id`、`owner_id`、`data`、`created_at`、`updated_at` 字段。
- [x] 1.4 新增 `apps/agent-api/src/services/project-persistence.service.mjs`，实现按 projectId 读取项目、upsert 完整 `CanvasProject` JSONB 快照、映射 not-found 和存储错误。
- [x] 1.5 新增 `apps/agent-api/src/controllers/project.controller.mjs` 和 `apps/agent-api/src/routes/project.mjs`，提供 `GET /projects/:projectId` 与 `PUT /projects/:projectId`。
- [x] 1.6 更新 `apps/agent-api/src/app.mjs` 的 CORS method/header 和路由分发，接入项目读取/保存接口且不影响现有 `/chat`、`/transcribe`、生成路由。

## 2. 共享 API 与前端项目客户端

- [x] 2.1 在 `packages/shared/src/api.ts` 增加项目读取/保存请求与响应类型，复用 `CanvasProject` 形状或定义最小 project payload 合同。
- [x] 2.2 在 `apps/web/src/persistence/` 下新增或扩展项目 ID helper，第一次启动生成 UUID 并缓存，后续复用同一个 projectId。
- [x] 2.3 新增 `apps/web/src/persistence/remote.ts` 或等价模块，封装 `GET /projects/:projectId`、`PUT /projects/:projectId`、404、后端不可用和保存失败处理。
- [x] 2.4 调整 chat 请求构造路径，使用稳定 projectId 替代固定 `local-project`。

## 3. 前端加载与保存流程

- [x] 3.1 调整 `apps/web/src/App.tsx` 初始化流程，先用本地 `loadProject()` 快速创建 store，再异步尝试从后端加载项目并通过 `replaceProjectNoHistory` 水合。
- [x] 3.2 调整 `apps/web/src/hooks/useCanvasWorkspaceController.ts` 与 `apps/web/src/persistence/local.ts` 的 deferred save 组合，让项目变化同时更新本地缓存并尝试远端保存。
- [x] 3.3 确保远端加载成功不会写入 undo/redo history，也不会清空当前 selection、tool 或运行时 UI 状态之外的持久项目状态。
- [x] 3.4 确保远端保存失败时不阻塞画布编辑、不丢失本地缓存，并保留可调试日志或错误状态入口。
- [x] 3.5 保持 `project.chat.sessions[]`、`activeSessionId`、`conversationId`、`previousResponseId` 仍作为 `CanvasProject.chat` 的一部分保存和恢复。

## 4. 测试覆盖

- [x] 4.1 新增 `apps/agent-api/src/services/project-persistence.service.test.mjs`，覆盖读取、保存、not-found、配置缺失和 Supabase 错误映射。
- [x] 4.2 新增 `apps/agent-api/src/controllers/project.controller.test.mjs`，覆盖项目 GET/PUT HTTP 行为、payload 校验和错误响应。
- [x] 4.3 更新或新增 `apps/web/tests/unit/persistence.test.ts`，覆盖 projectId 生成/复用、本地兜底和远端保存失败时仍写入本地缓存。
- [x] 4.4 新增前端加载流程单元测试，验证后端项目成功返回时会水合 store，后端失败时保留本地项目。
- [x] 4.5 更新 `apps/web/tests/unit/use-agent-chat.test.tsx` 或相关 controller 测试，确认 chat 请求使用稳定 projectId。
- [x] 4.6 更新 `apps/web/tests/e2e/canvas.spec.ts`，通过 mock 项目 API 验证刷新后从后端恢复画布内容和项目内会话列表。

## 5. 配置、文档与验证

- [x] 5.1 更新 `.env.example`，补充 `SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY` 以及本地无 Supabase 时的降级说明。
- [x] 5.2 更新相关开发文档，说明 Supabase `projects` 表创建方式、后端代理访问路径和本地缓存兜底策略。
- [x] 5.3 运行 `pnpm --filter @infinite-canvas/agent-api test` 验证后端单元测试。
- [x] 5.4 运行 `pnpm test` 验证前端和共享包单元测试。
- [x] 5.5 运行 `pnpm lint` 和 `pnpm build` 验证 workspace 检查。
- [ ] 5.6 在 Supabase 配置存在和缺失两种模式下手动验证：创建会话、发送消息、刷新页面、恢复会话列表和画布项目。
