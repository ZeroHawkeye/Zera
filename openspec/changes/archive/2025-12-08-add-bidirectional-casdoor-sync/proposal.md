# Change: 添加 Zera 到 Casdoor 的双向用户同步

## Why

当前系统仅支持单向同步：从 Casdoor 登录时自动同步用户到 Zera。Zera 后台管理员在本地创建、更新或删除用户时，这些变更不会同步到 Casdoor。这导致：
1. 用户数据不一致 - Zera 本地用户无法使用 CAS 统一登录
2. 管理割裂 - 需要在两个系统分别管理用户
3. 权限混乱 - 本地创建的用户无法享受 Casdoor 的 SSO 能力

## What Changes

- 集成 Casdoor Go SDK (`github.com/casdoor/casdoor-go-sdk`) 到后端
- 扩展 CAS 配置增加 SDK 所需的凭证字段（Client ID、Client Secret、JWT 公钥）
- **ADDED** 用户创建时同步到 Casdoor 的功能（可配置开关）
- **ADDED** 用户更新时同步到 Casdoor 的功能
- **ADDED** 用户删除时同步到 Casdoor 的功能
- **ADDED** 同步状态管理和失败重试机制
- 更新前端 CAS 设置页面以支持新配置项

## Impact

- Affected specs: `user-sync` (新增)
- Affected code:
  - `backend/internal/casdoor/` - 新增 Casdoor SDK 客户端封装
  - `backend/internal/service/user.go` - 添加同步逻辑
  - `backend/internal/service/cas_auth.go` - 扩展配置管理
  - `proto/base/cas_auth.proto` - 扩展配置消息
  - `frontend/src/pages/admin/settings/CASSettings.tsx` - 新增配置表单字段
  - `backend/go.mod` - 添加 casdoor-go-sdk 依赖
