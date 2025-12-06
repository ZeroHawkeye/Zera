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
- **Casdoor 身份认证**: 端口 8000，开源 IAM/SSO 平台
- **RustFS 对象存储**: S3 兼容协议，API 端口 9000，控制台端口 9001
- **SigNoz 可观测性平台** (可选): 日志、追踪、指标收集

### Casdoor 身份认证服务
Casdoor 是一个开源的 UI-first 身份认证和访问管理 (IAM) / 单点登录 (SSO) 平台。

- **官方文档**: https://casdoor.org/zh/docs/basic/try-with-docker
- **控制台地址**: http://localhost:8000/
- **默认账户**: `built-in/admin`
- **默认密码**: `123`

#### 环境变量
| 变量 | 默认值 | 说明 |
|------|--------|------|
| `CASDOOR_PORT` | 8000 | Casdoor 服务端口 |
| `CASDOOR_RUNMODE` | dev | 运行模式 (dev/prod) |
| `CASDOOR_ORIGIN` | http://localhost:8000 | Casdoor 访问地址 (用于 OAuth 回调) |

#### 配置文件
- **配置目录**: `Docker/casdoor/conf/`
- **主配置文件**: `Docker/casdoor/conf/app.conf`

#### 支持的功能
- OAuth 2.0, OIDC, SAML, CAS, LDAP 等多种协议
- 多租户、组织管理
- 多因素认证 (MFA)
- 社交登录集成 (GitHub, Google, 微信等)
- WebAuthn 支持
- 用户管理和权限控制

#### 生产环境注意事项
1. 修改默认管理员密码
2. 设置 `CASDOOR_RUNMODE=prod`
3. 配置正确的 `CASDOOR_ORIGIN` 地址
4. 考虑启用 HTTPS

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
| SigNoz UI + API | 18080 (可配置) | Web 界面和查询 API |
| OTLP gRPC | 4317 | OpenTelemetry gRPC 接收器 |
| OTLP HTTP | 4318 | OpenTelemetry HTTP 接收器 |
| ClickHouse Native | 9100 | 数据库原生协议 (映射，避免与 RustFS 冲突) |
| ClickHouse HTTP | 8123 | 数据库 HTTP 接口 |

#### 用户凭证
- **用户名**: `166997982@qq.com`
- **密码**: `012359Clown@`

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
- `SIGNOZ_UI_PORT`: SigNoz UI 端口 (默认: `18080`)

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
│                     signoz (18080)                           │
│              Query Service + Frontend + Alertmanager          │
└──────────────────────────────────────────────────────────────┘
```

#### 应用集成
后端服务可通过 OpenTelemetry SDK 发送数据到 SigNoz：
- **gRPC 端点**: `localhost:4317`
- **HTTP 端点**: `localhost:4318`
- **SigNoz UI**: `http://localhost:18080` (可通过 `SIGNOZ_UI_PORT` 环境变量修改)

示例环境变量配置：
```bash
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317
OTEL_SERVICE_NAME=zera-backend
```

#### 内网/离线部署 (Air-gapped Deployment)
SigNoz 默认会加载一些外部资源，内网部署需要以下准备工作：

**1. 预下载 Docker 镜像**
```bash
# 在有网络的机器上拉取镜像
docker pull signoz/signoz:v0.104.0
docker pull signoz/signoz-otel-collector:v0.129.12
docker pull signoz/signoz-schema-migrator:v0.129.12
docker pull signoz/zookeeper:3.7.1
docker pull clickhouse/clickhouse-server:25.5.6

# 导出镜像
docker save signoz/signoz:v0.104.0 -o signoz.tar
# ... 其他镜像同理

# 在内网机器上导入
docker load -i signoz.tar
```

**2. 预下载 histogramQuantile 二进制文件**
```bash
# 下载地址 (根据架构选择):
# AMD64: https://github.com/SigNoz/signoz/releases/download/histogram-quantile%2Fv0.0.1/histogram-quantile_linux_amd64.tar.gz
# ARM64: https://github.com/SigNoz/signoz/releases/download/histogram-quantile%2Fv0.0.1/histogram-quantile_linux_arm64.tar.gz

# 解压并放置到指定目录
tar -xvzf histogram-quantile_linux_amd64.tar.gz
mv histogram-quantile Docker/signoz/deploy/common/clickhouse/user_scripts/histogramQuantile
chmod +x Docker/signoz/deploy/common/clickhouse/user_scripts/histogramQuantile
```

**3. 环境变量配置 (已在 docker-compose.yml 中配置)**
```yaml
environment:
  # 禁用遥测数据上报
  - TELEMETRY_ENABLED=false
  # 禁用 Monaco Editor CDN (使用内置资源)
  - NEXT_PUBLIC_MONACO_CDN=
  # 禁用用户引导和客服等外部服务
  - NEXT_PUBLIC_APPCUES_ACCOUNT_ID=
  - NEXT_PUBLIC_PYLON_APP_ID=
```

**4. 已知限制**
- 日志详情页面的 "body" 展示区域可能显示 "Loading..."，这是 Monaco Editor 的 CDN 加载问题
- 实际日志数据完整，可在 Attributes 面板查看所有字段
- JSON 视图可能为空，这不影响日志功能

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