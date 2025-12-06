# 开发规则

## 基础规则
- 安装任何依赖使用命令行工具在所需的目录下安装
- 对于所有没有实现或者简单实现的代码都要使用`TODO`进行标记
- 对于所有目录结构与代码实现必须需要满足:`低耦合`,`可扩展`的需求
- 缺少任何依赖询问后进行安装即可,不要简单开发
- 任何对接api与前端的开发需要确定数据库表结构与proto文件结构进行对齐
- 任何新增的API需要和backend\internal\permission对齐,避免权限不统一的情况

## 基础设施服务

### Docker 服务 (`Docker/docker-compose.yml`)
- **PostgreSQL 数据库**: 端口 5432，用户/密码/数据库名通过环境变量配置
- **RustFS 对象存储**: S3 兼容协议，API 端口 9000，控制台端口 9001
- **SigNoz 可观测性平台** (可选): 日志、追踪、指标收集

### RustFS 对象存储
- **控制台地址**: http://localhost:9001/
- **API 端点**: http://localhost:9000
- **默认凭证**: access_key=`zera`, secret_key=`zera`
- **协议**: S3 兼容，使用 AWS S3 SDK 连接

#### 后端存储模块
- **配置文件**: `backend/config.toml` 的 `[storage]` 节
- **存储客户端**: `backend/internal/storage/storage.go`
- **配置结构**: `backend/internal/config/config.go` 的 `StorageConfig`
- **环境变量**: `STORAGE_ENABLED`, `STORAGE_ENDPOINT`, `STORAGE_ACCESS_KEY`, `STORAGE_SECRET_KEY`, `STORAGE_BUCKET`, `STORAGE_REGION`

#### 前端存储模块
- **配置文件**: `frontend/src/config/storage.ts`
- **存储客户端**: `frontend/src/api/storage.ts`
- **使用方式**: `import { storage } from '@/api/storage'`
- **环境变量**: `VITE_STORAGE_ENDPOINT`, `VITE_STORAGE_ACCESS_KEY`, `VITE_STORAGE_SECRET_KEY`, `VITE_STORAGE_BUCKET`, `VITE_STORAGE_REGION`

### SigNoz 可观测性平台 (可选)
SigNoz 是一个开源的 APM 和可观测性平台，提供日志、追踪和指标的统一视图。

#### 启用方式
```bash
# 启动所有服务（包含 SigNoz）
docker compose --profile observability up -d

# 仅启动基础服务（不含 SigNoz）
docker compose up -d

# 停止 SigNoz 相关服务
docker compose --profile observability down
```

#### 服务端口
| 服务 | 端口 | 说明 |
|------|------|------|
| SigNoz UI + API | 8080 | Web 界面和查询 API |
| OTLP gRPC | 4317 | OpenTelemetry gRPC 接收器 |
| OTLP HTTP | 4318 | OpenTelemetry HTTP 接收器 |
| ClickHouse Native | 9100 | 数据库原生协议 (映射，避免与 RustFS 冲突) |
| ClickHouse HTTP | 8123 | 数据库 HTTP 接口 |

#### 镜像版本 (更新于 2025-12-06)
| 镜像 | 版本 | 说明 |
|------|------|------|
| signoz/signoz | v0.104.0 | 统一服务 (query + frontend + alertmanager) |
| signoz/signoz-otel-collector | v0.129.12 | OpenTelemetry 收集器 |
| signoz/signoz-schema-migrator | v0.129.12 | 数据库 Schema 迁移工具 |
| signoz/zookeeper | 3.7.1 | ClickHouse 分布式协调 |
| clickhouse/clickhouse-server | 25.5.6 | 时序数据库 |

#### 环境变量
- `SIGNOZ_VERSION`: SigNoz 主服务版本 (默认: `v0.104.0`)
- `SIGNOZ_OTELCOL_VERSION`: OTEL Collector 版本 (默认: `v0.129.12`)

#### 服务架构
```
┌──────────────────────────────────────────────────────────────┐
│                       用户应用                                │
│              (发送 OTLP 数据到 4317/4318)                     │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│              signoz-otel-collector (4317/4318)               │
│                   OpenTelemetry Collector                     │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│                 signoz-clickhouse (9100/8123)                │
│                      ClickHouse 存储                          │
│                    (依赖 signoz-zookeeper)                    │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│                      signoz (8080)                           │
│              Query Service + Frontend + Alertmanager          │
└──────────────────────────────────────────────────────────────┘
```

#### 应用集成
后端服务可通过 OpenTelemetry SDK 发送数据到 SigNoz：
- **gRPC 端点**: `localhost:4317`
- **HTTP 端点**: `localhost:4318`
- **SigNoz UI**: `http://localhost:8080`

示例环境变量配置：
```bash
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317
OTEL_SERVICE_NAME=zera-backend
```

## 前端开发规则
- 使用`bun add|remove <package>`进行依赖的添加与管理
- 禁止运行`bun run dev`
- 使用`tanstack router`代码路由进行路由管理
- 使用`@/*`进行文件引入
- 严禁使用`any`类型,和使用`as`断言进行错误忽略的行为
- 任何UI需要适配移动端
- 前端api对接与proto文件结构和后端数据库属于对应关系,修改一项就需要修改其他项

## 前端设计规范
- 组件库使用 `antd` + `tailwindcss`
- 设计风格: 现代 AI 产品风格
  - 主题: 支持亮色/暗色双模式，主题色为蓝色
  - 效果: 毛玻璃效果（Glassmorphism）、柔和光晕、平滑过渡动画
  - 布局: 简约大气，充足留白，信息层级清晰
  - 交互: 流式输出动画、骨架屏加载、微交互反馈
  - 卡片: 圆角卡片、轻微阴影、悬停状态反馈