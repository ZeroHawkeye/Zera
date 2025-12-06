<!--
================================================================================
SYNC IMPACT REPORT
================================================================================
Version change: N/A → 1.0.0 (Initial constitution)
Modified principles: N/A (Initial creation)
Added sections:
  - Core Principles (5 principles)
  - Technology Stack
  - Development Workflow
  - Governance
Removed sections: N/A
Templates status:
  - ✅ plan-template.md - Compatible (Constitution Check section exists)
  - ✅ spec-template.md - Compatible (Requirements align)
  - ✅ tasks-template.md - Compatible (Phase structure aligns)
Follow-up TODOs: None
================================================================================
-->

# Zera 项目宪章

## Core Principles

### I. Protocol-First Development (协议优先开发)

所有涉及 API 的功能开发 **必须** 从 Protocol Buffers 定义开始。

**强制规则**：
- 新功能开发流程：Proto 定义 → 代码生成 → 后端实现 → 前端对接
- Proto 文件变更必须通过 `task proto` 完整工作流（lint → format → generate → check）
- 破坏性变更必须通过 `task proto:breaking` 检查并记录迁移方案
- 前端 TypeScript 类型、后端 Go 结构体、数据库 Schema 必须与 Proto 定义保持对齐

**原因**：确保前后端类型契约一致，减少集成问题，实现 API 文档自动化。

### II. Type Safety (类型安全)

代码必须保持严格的类型安全，禁止类型逃逸。

**强制规则**：
- TypeScript 中 **禁止** 使用 `any` 类型
- TypeScript 中 **禁止** 使用 `as any` 或 `as unknown as T` 进行类型断言
- 所有函数参数和返回值必须有明确的类型定义
- Go 代码必须避免 `interface{}` 滥用，优先使用具体类型或泛型
- 使用 `@/*` 路径别名进行前端模块导入

**原因**：类型安全是 Zera 的核心价值主张，确保编译时错误捕获和更好的 IDE 支持。

### III. Schema Alignment (模式对齐)

Proto 定义、数据库 Schema、API 实现必须保持同步。

**强制规则**：
- 修改 Proto 文件时，必须同步更新：
  - `backend/ent/schema/` 中的 Ent Schema
  - `backend/internal/handler/` 中的 Handler 实现
  - `frontend/src/api/` 中的 API 客户端
- 新增 API 端点必须在 `backend/internal/permission/registry.go` 中注册权限
- 数据库迁移必须使用 Ent 的 Schema 迁移机制

**原因**：防止数据不一致和权限漏洞，确保系统各层保持同步。

### IV. Low Coupling & Extensibility (低耦合与可扩展性)

代码架构必须遵循低耦合、高内聚原则。

**强制规则**：
- 业务逻辑必须与框架代码分离
- 使用依赖注入而非硬编码依赖
- 未完成或简化实现的代码必须使用 `TODO` 标记
- 禁止在模块间创建循环依赖
- 新功能应优先扩展现有抽象，而非创建新的平行结构

**原因**：确保代码可维护性和未来功能扩展的便捷性。

### V. Modern UI/UX (现代化用户体验)

前端界面必须遵循现代 AI 产品设计规范。

**强制规则**：
- 使用 `antd` + `tailwindcss` 组件库组合
- 支持亮色/暗色双主题模式（主题色为蓝色）
- 实现毛玻璃效果（Glassmorphism）、柔和光晕、平滑过渡动画
- 所有 UI 组件必须适配移动端响应式布局
- 使用 TanStack Router 进行路由管理
- 交互反馈：流式输出动画、骨架屏加载、微交互

**原因**：提供一致且现代的用户体验，符合当前 AI 产品的设计趋势。

## Technology Stack (技术栈约束)

### 后端
| 组件 | 技术选型 | 说明 |
|------|----------|------|
| 语言 | Go 1.21+ | 主要后端语言 |
| RPC 框架 | Connect-Go | gRPC 兼容的 HTTP API |
| ORM | Ent | 类型安全的 Go ORM |
| 数据库 | PostgreSQL | 主数据存储 |
| 对象存储 | RustFS (S3 兼容) | 文件存储服务 |
| 可观测性 | SigNoz + OpenTelemetry | 日志、追踪、指标 |

### 前端
| 组件 | 技术选型 | 说明 |
|------|----------|------|
| 框架 | React 18+ | UI 框架 |
| 语言 | TypeScript (strict) | 严格类型检查 |
| 构建工具 | Vite + bun | 快速构建和包管理 |
| UI 库 | Antd + TailwindCSS | 组件库和工具类 CSS |
| 路由 | TanStack Router | 类型安全路由 |
| API 客户端 | Connect-Web (生成) | 由 Proto 自动生成 |

### 工具链
| 工具 | 用途 |
|------|------|
| buf | Protocol Buffers 工具链 |
| Taskfile | 任务运行器 |
| mprocs | 多进程开发环境管理 |
| Docker Compose | 基础设施服务编排 |

## Development Workflow (开发流程)

### 新功能开发流程

```
1. [Proto] 定义 API 接口
   └── proto/*.proto
   
2. [Generate] 生成代码
   └── task proto
   
3. [Backend] 实现后端逻辑
   ├── backend/ent/schema/ (数据模型)
   ├── backend/internal/handler/ (API 处理器)
   └── backend/internal/permission/ (权限注册)
   
4. [Frontend] 实现前端功能
   ├── frontend/src/api/ (API 调用)
   ├── frontend/src/pages/ (页面组件)
   └── frontend/src/components/ (可复用组件)
   
5. [Test] 验证功能
   └── 使用 task dev 启动开发环境测试
```

### 代码质量检查点

在提交代码前，必须确保：

- [ ] Proto 文件通过 lint 和 format 检查
- [ ] 后端 Go 代码编译无错误 (`task proto:check:backend`)
- [ ] 前端 TypeScript 类型检查通过 (`task proto:check:frontend`)
- [ ] 新 API 已在 permission/registry.go 注册
- [ ] UI 组件在移动端和桌面端均可正常显示

## Governance (治理规则)

### 宪章优先级

本宪章的规则优先于其他开发文档。当存在冲突时，以宪章为准。

### 修订流程

1. 提出修订需求并说明原因
2. 更新宪章内容
3. 更新版本号（遵循语义化版本）：
   - **MAJOR**: 删除或重新定义核心原则
   - **MINOR**: 新增原则或实质性扩展
   - **PATCH**: 澄清、措辞修正、非语义性改进
4. 同步更新受影响的模板文件

### 合规检查

- 所有 PR 必须验证是否符合宪章原则
- 复杂性增加必须有充分理由
- 运行时开发指南参见 `AGENTS.md`

**Version**: 1.0.0 | **Ratified**: 2025-12-06 | **Last Amended**: 2025-12-06
