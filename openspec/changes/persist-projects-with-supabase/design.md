## Context

当前前端通过 `apps/web/src/persistence/local.ts` 把完整 `CanvasProject` 保存到 `localStorage`。这个模型已经包含 `board`、`assets`、`jobs` 和 `chat.sessions[]`，其中会话列表是当前画布项目的一部分，而不是全局聊天历史。`apps/web/src/hooks/useCanvasWorkspaceController.ts` 通过 deferred saver 对每次 `state.project` 变化做延迟本地保存。

后端 `apps/agent-api` 当前是无状态 HTTP 服务，主要处理 `/chat`、`/transcribe`、`/generate-image`、`/generate-video`，没有数据库、项目读取接口或项目保存接口。前端发送 chat 请求时使用固定 `projectId: 'local-project'`，这个 ID 目前不是可恢复项目身份。

本变更在不重写画布状态模型的前提下，引入 Supabase Postgres 作为项目快照持久化层。第一版把完整 `CanvasProject` 作为 JSONB 存入 `projects.data`，让现有项目内会话列表自然随项目保存和恢复。

## Goals / Non-Goals

**Goals:**
- 通过 `web -> agent-api -> Supabase` 路径保存和加载当前画布项目。
- 保持 `CanvasProject` v2 文档结构不变，使会话列表继续属于当前项目。
- 用本地生成并缓存的 `projectId` 替代固定 `local-project`，作为后端项目记录 ID。
- 保留 `localStorage` 作为本地缓存和后端失败兜底。
- 使用简单的 last-write-wins 保存策略，避免把本次变更扩大为协作系统。
- 为未来 Supabase Auth 预留 `owner_id` 字段，但不要求本次接入登录。

**Non-Goals:**
- 不实现 Supabase Auth 登录、用户邀请、权限 UI 或项目分享。
- 不提供跨项目/账号级全局会话中心。
- 不拆分 `chat_sessions`、`chat_messages`、`assets`、`jobs` 等实体表。
- 不迁移图片或视频二进制内容到 Supabase Storage。
- 不引入实时协作、冲突合并、CRDT 或多人编辑协议。

## Decisions

### 1. 后端代理访问 Supabase，而不是前端直连写项目

数据流：

```text
apps/web
   ↓
apps/agent-api
   ↓
Supabase Postgres
```

后端读取 `SUPABASE_URL` 和 `SUPABASE_SERVICE_ROLE_KEY`，前端只调用 agent-api 的项目 API。这样 service role key 不会暴露到浏览器，也能把项目 schema 校验、错误映射和未来权限检查集中在后端。

备选方案是前端用 Supabase anon key 直连数据库。它能更快落地，但必须同时设计 RLS、登录态和客户端权限边界；这会把本次“项目持久化”扩大成认证和授权变更。

### 2. 第一版保存完整 `CanvasProject` JSONB 快照

Supabase 表使用最小 schema：

```sql
create table projects (
  id uuid primary key,
  owner_id uuid null,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

`data` 保存完整 `CanvasProject`，包括：

```text
CanvasProject
  ├─ board
  ├─ assets
  ├─ jobs
  └─ chat
      ├─ activeSessionId
      └─ sessions[]
```

这个选择复用当前 store 和 persistence 结构，避免在第一版引入项目组装层。后续如果聊天消息或资产变大，再把 `chat_sessions`、`chat_messages` 或 asset storage 拆出来。

### 3. agent-api 新增项目 API

建议接口：

```text
GET /projects/:projectId
PUT /projects/:projectId
```

`GET` 成功时返回项目 payload；项目不存在时返回 404，让前端使用本地缓存或创建空项目。`PUT` 使用 upsert 保存完整 `CanvasProject`，并更新 `updated_at`。

`projectId` 应使用 UUID。前端第一次启动时生成并缓存一个 UUID，之后所有项目读取、保存和 `/chat` 请求都使用这个 ID。短期仍是单项目体验；未来 URL 路由或项目列表可以复用这个 ID。

### 4. 前端加载从同步初始化变成异步水合

当前 `App` 使用：

```text
createInitialStore(loadProject())
```

后端持久化后，启动路径应变为：

```text
resolveProjectId()
  ↓
load local cached project immediately or create empty project
  ↓
GET /projects/:projectId
  ↓
if remote project exists: replace project without history
if remote fails: keep local cached project
```

这样画布可以快速启动，同时后端项目存在时会覆盖本地初始状态。远端加载替换项目不应进入 undo/redo history。

### 5. 保存继续沿用 deferred save，并增加远端写入

项目变化后：

```text
state.project changed
  ↓
deferred save
  ├─ save localStorage cache
  └─ PUT /projects/:projectId
```

本地保存仍是快速兜底，后端保存失败不应阻塞画布编辑。第一版可以静默记录错误；如果后续需要用户可见状态，可以再增加同步状态 UI。

聊天流完成后，`useChatSidebarController` 已经把 assistant message、suggestions、effects、`conversationId`、`previousResponseId` 写回 `project.chat.sessions[]`。因此只要项目保存覆盖这些变化，会话列表和服务端续聊元数据就会随项目持久化。

### 6. 兼容性和迁移策略

本次不改变 `CanvasProject.version`，现有 `localStorage` v2 项目仍可读取。首次启用后端时：

```text
remote missing + local exists
  ↓
use local project
  ↓
next deferred save upserts remote project
```

如果 Supabase 未配置，项目 API 应返回明确的服务不可用错误，前端继续使用本地缓存。这让本地开发和测试不被 Supabase 强依赖完全阻塞。

### 7. 测试策略

- `apps/agent-api` 单元测试：
  - Supabase project service upsert/get 行为。
  - `/projects/:projectId` 路由的成功、404、配置缺失、存储错误响应。
  - payload 校验，拒绝非 v2 `CanvasProject` 或缺少核心字段的保存请求。
- `apps/web` 单元测试：
  - project ID 生成和复用。
  - 后端加载成功时替换本地项目。
  - 后端加载失败时保留本地缓存。
  - deferred saver 同时触发本地保存和远端保存。
- E2E：
  - mock 项目 API，验证刷新后能从后端恢复画布和项目内会话列表。
  - mock 保存失败，验证本地编辑和本地恢复仍可用。

## Risks / Trade-offs

- [完整项目 JSONB 会随着资产和消息增长变重] → 第一版接受快照保存以控制复杂度；后续以 `assets`/`chat_messages` 拆表或 Supabase Storage 作为演进方向。
- [last-write-wins 可能覆盖另一个浏览器的更新] → 明确第一版不支持并发编辑；未来可增加 `updated_at`/版本号冲突检测。
- [后端加载远端项目可能覆盖较新的本地缓存] → 第一版以远端为主；实现时可比较本地保存时间和远端 `updated_at`，但不做复杂合并。
- [Supabase 配置缺失影响本地开发] → 后端返回可识别错误，前端保留 `localStorage` 路径。
- [service role key 权限过大] → 只在 agent-api 环境变量中使用，不暴露给浏览器；后续接入 Auth/RLS 时再收紧权限模型。
- [项目 API 与 chat API 分离导致保存时序问题] → chat 完成后先更新前端 project，再走统一项目保存路径；不让 `/chat` 直接写项目快照，避免双写来源。
