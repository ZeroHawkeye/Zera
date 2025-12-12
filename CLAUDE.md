# CLAUDE.md

本文件为 Claude Code (claude.ai/code) 在该代码仓库中工作时提供指导。

## 项目概述

Zera 是一个类型安全的后台管理开发脚手架,采用 monorepo 架构。它使用 Protocol Buffers 在 Go 后端和 React 前端之间建立类型安全的 API 契约,并通过 Connect-RPC 进行通信。

## 开发命令

### 初始化设置
```bash
task dev  # 通过 mprocs 启动完整的开发环境(前端 + 后端)
```

### Proto 工作流
```bash
task proto                    # 完整工作流: lint → format → generate → check
task proto:gen               # 生成所有 proto 代码(前端 + 后端并行)
task proto:gen:backend       # 仅生成后端 Go 代码
task proto:gen:frontend      # 仅生成前端 TypeScript 代码
task proto:watch             # 监听 proto 文件变化并自动生成(带验证)
task proto:watch:fast        # 监听 proto 文件变化并自动生成(更快,无检查)
```

### 独立服务
```bash
task dev:frontend    # 仅启动前端开发服务器(Vite)
task dev:backend     # 仅启动后端服务器(Go)
```

### 构建
```bash
task build           # 完整生产构建: frontend → embed → backend
task build:frontend  # 仅构建前端
task build:backend   # 构建嵌入前端的后端
```

### 数据库
```bash
cd backend && go generate ./ent  # 从 schema 文件生成 Ent ORM 代码
```

## 架构

### 后端 (Go)

**技术栈:**
- 框架: Gin (HTTP 服务器)
- RPC: Connect-Go (基于 HTTP 的 Protocol Buffers)
- ORM: Ent (Facebook 的实体框架)
- 数据库: PostgreSQL
- 认证: JWT + 可选的 CAS/SSO 集成
- 监控: OpenTelemetry (traces, metrics, logs),支持 SigNoz
- 验证: buf protovalidate

**核心目录:**
- `backend/cmd/server/` - 服务器入口点
- `backend/cmd/zera/` - 开发用 CLI 工具
- `backend/ent/schema/` - Ent 实体模型(User, Role, Permission, AuditLog, SystemSetting)
- `backend/internal/handler/` - Connect-RPC 处理器(API 端点)
- `backend/internal/service/` - 业务逻辑层
- `backend/internal/middleware/` - Connect 拦截器(认证、日志、审计、维护模式)
- `backend/internal/permission/` - 基于注册表的 API 权限系统
- `backend/gen/` - 从 proto 文件生成的代码

**服务器架构:**
1. 从 `config.toml` 或环境变量加载配置(环境变量优先)
2. 服务器初始化链路 [server.go](backend/internal/server/server.go#L38):
   - 全局日志设置(slog)
   - OpenTelemetry 提供者(可选,由配置控制)
   - 数据库连接和自动迁移
   - 系统角色初始化
   - 从注册表同步权限到数据库
   - 创建管理员用户
   - 存储和本地文件存储设置
3. 中间件/拦截器链(顺序很重要):
   - OpenTelemetry 追踪(如果启用)
   - Trace ID 生成(向后兼容)
   - 日志拦截器
   - 权限拦截器(结合认证 + 权限检查)
   - 维护模式拦截器
   - 审计日志拦截器

**权限系统:**
- 集中式注册表位于 [permission/registry.go](backend/internal/permission/registry.go)
- 每个 API 过程映射到一个权限代码(如 `user:read`)
- 启动时自动将权限同步到数据库
- 公共 API 标记为 `IsPublic: true`(无需认证)
- 仅需认证的 API 设置 `RequireAuth: true` 但无特定权限代码

**数据库 Schema 生成:**
- Ent schemas 定义在 `backend/ent/schema/*.go`
- 在 backend 目录运行 `go generate ./ent` 重新生成
- 开发模式下启动时自动执行迁移

### 前端 (React + TypeScript)

**技术栈:**
- 构建工具: Vite (使用 Rolldown 提升性能)
- 框架: React 19 + React Compiler (babel-plugin-react-compiler)
- 路由: TanStack Router (代码式路由,非文件式)
- 状态: Zustand + TanStack Query
- UI: Ant Design 6.0 + Tailwind CSS 4
- RPC 客户端: @connectrpc/connect-web
- 表单: Ant Design Form

**核心目录:**
- `frontend/src/pages/` - 按路由结构组织的页面组件
- `frontend/src/layouts/` - 布局组件(AdminLayout, AuthLayout, BlankLayout)
- `frontend/src/router/` - 路由定义和守卫
- `frontend/src/components/` - 可复用组件
- `frontend/src/gen/` - 从 proto 文件生成的 TypeScript 代码
- `frontend/src/theme/` - 主题配置

**路由架构:**
- 使用 TanStack Router 的代码式路由(见 [routes.tsx](frontend/src/router/routes.tsx))
- 路由守卫: `authGuard`(需要认证), `guestGuard`(已认证则重定向)
- 使用 `.lazy()` 模式的懒加载路由组件
- 主要路由:
  - `/` - 首页
  - `/login` - 登录页(仅访客)
  - `/admin/*` - 管理区域(需要认证)
  - `/cas/callback` - CAS SSO 回调

**路径别名:**
- `@/` 映射到 `frontend/src/`(在 vite.config.ts 中配置)

### Proto 工作流

**Proto 文件位置:** `proto/base/*.proto`

**代码生成:**
1. 后端: 使用本地 `protoc-gen-go`、`protoc-gen-connect-go` 和 `protoc-gen-connect-openapi` 插件
2. 前端: 使用 Buf 远程插件生成 TypeScript
3. 配置:
   - `proto/buf.yaml` - Proto 检查和破坏性变更检测
   - `backend/buf.gen.yaml` - 后端 Go 代码生成配置
   - `frontend/buf.gen.yaml` - 前端 TypeScript 代码生成配置

**生成的代码:**
- 后端: `backend/gen/` (Go 包)
- 前端: `frontend/src/gen/` (TypeScript 模块)
- OpenAPI: `backend/gen/**/*.openapi.yaml` (用于生成文档)

**重要:** 修改 proto 文件后始终运行 `task proto` 以确保一致性。

## 配置

### 后端配置
- 配置文件: `backend/config.toml`
- 环境变量会覆盖配置文件
- 主要配置段:
  - `[server]` - HTTP 服务器设置(host, port)
  - `[database]` - PostgreSQL 连接
  - `[jwt]` - JWT 令牌设置
  - `[storage]` - S3 兼容的对象存储(可选)
  - `[static]` - 本地文件上传(如 logo 等)
  - `[log]` - 结构化日志(slog)配置
  - `[telemetry]` - OpenTelemetry 设置(默认禁用)

### 前端配置
- Vite 配置: `frontend/vite.config.ts`
- 无环境特定配置;后端 URL 是动态的

## 重要模式

### 添加新的 API 端点

1. 在 `proto/base/*.proto` 中定义 proto 消息和服务
2. 运行 `task proto:gen` 生成代码
3. 在 `backend/internal/handler/` 中创建处理器
4. 在 `backend/internal/permission/registry.go` 中注册权限
5. 在 `backend/internal/server/server.go` 中注册路由
6. 使用生成的 Connect 客户端创建前端 API 调用

### 添加新实体

1. 在 `backend/ent/schema/` 中定义 Ent schema
2. 运行 `cd backend && go generate ./ent`
3. 创建相应的 proto 消息
4. 遵循"添加新的 API 端点"工作流

### 中间件/拦截器顺序

拦截器的顺序在 [server.go](backend/internal/server/server.go#L223) 中至关重要:
1. 追踪(创建追踪上下文)
2. 日志(记录请求/响应)
3. 权限(认证 + 权限检查)
4. 维护模式(维护期间阻止请求)
5. 审计日志(记录操作)

### 主题系统

- 主题定义在 `frontend/src/theme/themes.ts`
- 通过 ThemeToggle 组件动态切换主题
- 存储在 localStorage 和系统设置中

## 必需的全局工具

开发前需全局安装:
1. [buf](https://buf.build) - Proto 工具链
2. [taskfile](https://taskfile.dev) - 任务运行器
3. [mprocs](https://github.com/pvolok/mprocs) - 多进程管理器
4. [bun](https://bun.sh) - JavaScript 运行时/包管理器
5. Go 1.24+ - 后端运行时
6. PostgreSQL - 数据库

后端 proto 插件(通过 `go install` 安装):
- `protoc-gen-go`
- `protoc-gen-connect-go`
- `protoc-gen-connect-openapi`

## 静态资源嵌入

生产构建将前端嵌入到后端二进制文件中:
- 前端构建到 `frontend/dist/`
- 构建过程复制到 `backend/internal/static/dist/`
- `backend/internal/static/embed.go` 中的 Go embed 指令将其打包到二进制文件
- SPA 路由由 `backend/internal/static/spa.go` 处理

## 开发注意事项

- 前端使用 Rolldown (Vite 分支)以加快构建速度
- React Compiler 已启用以自动优化
- OpenTelemetry 是可选的,可在配置中启用以获得可观测性
- 通过 Casdoor 支持 CAS/SSO 集成
- 权限系统基于注册表并由数据库支持
- 审计日志异步运行以避免阻塞请求
