# Zera - 一个类型安全的Admin快速开发脚手架

## 必要的依赖

### 工具链

1. [buf](https://buf.build) - Protocol Buffers 工具链
2. [taskfile](https://taskfile.dev) - 任务运行器
3. [mprocs](https://github.com/pvolok/mprocs) - 多进程管理器
4. [bun](https://bun.sh) - JavaScript 运行时和包管理器

### Protobuf 代码生成插件

以下插件需要全局安装，用于 `buf generate` 生成后端代码：

5. [protoc-gen-go](https://pkg.go.dev/google.golang.org/protobuf/cmd/protoc-gen-go) - 生成 Go Protobuf 代码
   ```bash
   go install google.golang.org/protobuf/cmd/protoc-gen-go@latest
   ```
6. [protoc-gen-connect-go](https://pkg.go.dev/connectrpc.com/connect/cmd/protoc-gen-connect-go) - 生成 Connect-Go 代码
   ```bash
   go install connectrpc.com/connect/cmd/protoc-gen-connect-go@latest
   ```
7. [protoc-gen-connect-openapi](https://github.com/sudorandom/protoc-gen-connect-openapi) - 从 Proto 生成 OpenAPI 规范
   ```bash
   go install github.com/sudorandom/protoc-gen-connect-openapi@latest
   ```

> **注意**: 前端 TypeScript 代码生成使用 buf 远程插件，无需本地安装。
> **注意**: [ent](https://entgo.io) ORM 通过 `go generate` 自动下载，无需预先安装。

## 快速开始

```bash
# 启动完整开发环境（推荐）
task dev
```

## Task 命令说明

### 开发模式

| 命令 | 说明 |
|------|------|
| `task dev` | 启动完整开发环境，自动生成 proto 代码并启动前后端服务 (mprocs TUI) |
| `task dev:frontend` | 仅启动前端开发服务 |
| `task dev:backend` | 仅启动后端服务 |

### Proto 工作流

| 命令 | 说明 |
|------|------|
| `task proto` | 完整 proto 工作流：lint → format → generate → check |
| `task proto:lint` | 检查 proto 文件规范 |
| `task proto:format` | 格式化 proto 文件 |
| `task proto:breaking` | 检查 proto 破坏性变更（对比 main 分支） |

### 代码生成

| 命令 | 说明 |
|------|------|
| `task proto:gen` | 生成所有 proto 代码（前后端并行） |
| `task proto:gen:backend` | 仅生成后端 Go 代码 |
| `task proto:gen:frontend` | 仅生成前端 TypeScript 代码 |

### 代码检查

| 命令 | 说明 |
|------|------|
| `task proto:check` | 检查生成代码的正确性（前后端并行） |
| `task proto:check:backend` | 检查后端 Go 代码编译 |
| `task proto:check:frontend` | 检查前端 TypeScript 类型 |

### Watch 模式

| 命令 | 说明 |
|------|------|
| `task proto:watch` | 监听 proto 变化，自动生成并检查 |
| `task proto:watch:fast` | 监听 proto 变化，仅生成不检查（更快） |

## 项目结构

```
├── proto/          # Proto 定义文件
├── backend/        # Go 后端服务
│   └── gen/        # 生成的 Go 代码
├── frontend/       # React 前端应用
│   └── src/gen/    # 生成的 TypeScript 代码
└── Taskfile.yml    # 任务配置
```