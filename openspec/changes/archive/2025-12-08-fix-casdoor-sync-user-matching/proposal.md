# Change: 修复 Casdoor 同步用户 CAS 登录时的重复创建问题

## Why

当前启用了 Zera → Casdoor 的用户同步功能后，存在以下问题：

1. **external_id 不匹配导致用户重复创建**
   - 本地用户同步到 Casdoor 时，`external_id` 被设置为 Casdoor 返回的 `User.Id`（Casdoor 分配的 UUID，如 `a1b2c3d4-...`）
   - 用户通过 CAS 登录时，`casUser.ExternalID` 来自 CAS XML 响应的 `attrs.ID` 或用户名（如 `zera`）
   - 两者不匹配，导致匹配逻辑失败
   - 系统错误地创建了带 `cas_tmp_` 前缀的新用户（如 `cas_tmp_zera_tmp_zera`）

2. **用户名匹配时 external_id 对比逻辑有缺陷**
   - 代码检查 `existingUser.ExternalID == casUser.ExternalID`
   - 但两个 ID 来源不同，格式不同，永远不会相等

日志示例：
```
msg="new CAS user created" username=cas_tmp_zera_tmp_zera
```

## What Changes

- **MODIFIED** CAS 登录用户匹配逻辑，增加基于用户名的本地用户查找
- **MODIFIED** 用户名冲突处理，当本地用户同步到 Casdoor 后通过 CAS 登录时：
  - 优先通过用户名匹配本地用户
  - 验证用户确实存在于 Casdoor 中
  - 将本地用户升级为 CAS 用户，更新 `auth_provider` 和 `external_id`
- **ADDED** 更详细的日志记录，便于调试用户匹配流程

## Impact

- Affected specs: 修改 `add-bidirectional-casdoor-sync` 中的 user-sync 规范
- Affected code:
  - `backend/internal/service/cas_auth.go` - `CreateOrUpdateUser` 方法
- 无 **BREAKING** 变更，仅修复已有功能的缺陷
