## 1. 核心修复

- [x] 1.1 修改 `backend/internal/service/cas_auth.go` 中的 `CreateOrUpdateUser` 方法：
  - 当找到本地用户（`auth_provider=local`）且用户名匹配时
  - 调用 Casdoor API 验证该用户是否存在于 Casdoor
  - 如果存在，将本地用户升级为 CAS 用户
- [x] 1.2 在 `CASAuthService` 中注入 Casdoor 客户端依赖
- [x] 1.3 添加 `verifyCasdoorUser` 辅助方法，调用 Casdoor SDK 检查用户存在性

## 2. 日志增强

- [x] 2.1 在 `CreateOrUpdateUser` 方法入口添加日志，记录 `casUser.ExternalID` 和 `casUser.Username`
- [x] 2.2 在用户名匹配分支添加日志，记录本地用户的 `external_id` 和匹配决策
- [x] 2.3 在用户升级时添加日志，记录从 local 到 cas 的转换

## 3. 测试验证

- [ ] 3.1 验证场景：本地创建用户 → 同步到 Casdoor → 通过 CAS 登录
  - 期望结果：不创建新用户，使用现有用户登录
- [ ] 3.2 验证场景：本地创建用户（未同步）→ 通过 CAS 登录
  - 期望结果：创建新 CAS 用户（带前缀）
- [ ] 3.3 验证场景：纯 CAS 用户登录（未同步）
  - 期望结果：正常创建/更新 CAS 用户
