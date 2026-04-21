## Why

当前画布项目和右侧会话列表只保存在浏览器 `localStorage` 中。刷新可以恢复，但更换浏览器、清理本地数据或需要后端托管项目时，当前画布、资产记录、生成任务和项目内会话都会缺少可靠的服务端持久化来源。

本变更引入 Supabase 作为项目级后端持久化层，让会话列表继续作为当前画布项目的一部分保存，同时保留本地缓存作为加载失败或保存失败时的兜底。

## What Changes

- 在 `agent-api` 后端新增项目持久化能力，通过 Supabase Postgres 保存完整 `CanvasProject` JSON 快照。
- 新增项目读取和保存接口，前端通过 `web -> agent-api -> Supabase` 路径加载与保存项目，避免前端直接持有 Supabase service role key。
- 前端启动时解析或创建项目 ID，优先从后端加载项目，失败时回退现有 `localStorage` 项目缓存。
- 前端项目变更后继续采用延迟保存策略，同时写入后端和本地缓存，确保聊天会话列表、`activeSessionId`、`conversationId`、`previousResponseId` 随项目快照保存。
- Supabase `projects` 表预留 `owner_id` 字段，但本次不引入完整登录、用户隔离或跨用户权限 UI。
- 保持现有 `CanvasProject` v2 文档结构兼容，不拆分 `chat_sessions`、`chat_messages`、`assets` 或 `jobs` 表。
- 明确第一版并发策略为 last-write-wins，不支持多人实时协作或冲突合并。

## Capabilities

### New Capabilities
- `project-backend-persistence`: 定义画布项目通过 agent-api 与 Supabase 后端保存、加载和本地缓存兜底的行为。

### Modified Capabilities
- `ai-design-canvas`: 项目恢复要求从仅本地恢复扩展为优先后端恢复，并保持会话列表仍属于当前画布项目。

## Impact

- 影响 `apps/agent-api`：
  - 新增 Supabase 环境变量读取和配置校验：`SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY`。
  - 新增项目持久化 service/controller/route，处理 `GET /projects/:projectId` 与 `PUT /projects/:projectId`。
  - 新增后端单元测试覆盖项目读取、保存、缺失配置和错误响应。
- 影响 `apps/web`：
  - 调整项目加载流程，从同步 `loadProject()` 扩展为可异步后端加载并回退本地缓存。
  - 调整项目保存流程，使现有 deferred save 同步写入本地缓存并尝试后端保存。
  - 引入项目 ID 的本地生成和缓存，替代固定 `local-project` 作为后端项目标识。
- 影响 `packages/shared`：
  - 可能新增项目读取/保存 API 类型，复用现有 `CanvasProject` 结构或增加共享项目 payload 类型。
- 影响配置与部署：
  - `.env.example` 需要补充 Supabase 配置项。
  - 需要提供 Supabase `projects` 表 schema 或迁移 SQL。
- 非目标：
  - 不实现 Supabase Auth 登录流程。
  - 不提供全局会话中心。
  - 不迁移生成资产到 Supabase Storage。
  - 不实现多人协作、CRDT 或冲突合并。
