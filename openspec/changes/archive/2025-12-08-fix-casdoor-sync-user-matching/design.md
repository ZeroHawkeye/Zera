## Context

Zera 实现了双向用户同步功能（`add-bidirectional-casdoor-sync`），允许本地创建的用户同步到 Casdoor。然而在实际使用中，同步后的用户通过 CAS 登录时会被错误地识别为新用户，导致创建重复账户。

### 问题根因分析

1. **external_id 来源不一致**：
   - 同步到 Casdoor 时：`external_id = Casdoor.User.Id`（UUID 格式，如 `a1b2c3d4-e5f6-...`）
   - CAS 登录回调时：`casUser.ExternalID = CAS_Response.attributes.id`（通常是用户名，如 `zera`）

2. **用户匹配逻辑缺陷**：
   ```go
   // 当前逻辑：通过 external_id + auth_provider=cas 查找
   u, err := s.client.User.Query().
       Where(
           user.AuthProviderEQ(user.AuthProviderCas),
           user.ExternalIDEQ(casUser.ExternalID),  // 使用 CAS 响应的 ID
       ).Only(ctx)
   
   // 找不到后，通过用户名查找
   existingUser, err := s.client.User.Query().
       Where(user.Username(username)).Only(ctx)
   
   // 检查 external_id 是否匹配
   if existingUser.ExternalID != nil && *existingUser.ExternalID == casUser.ExternalID {
       // 这里永远不会为 true，因为：
       // existingUser.ExternalID = Casdoor UUID
       // casUser.ExternalID = 用户名
   }
   ```

### 相关利益方
- 系统管理员：期望本地创建的用户能无缝通过 CAS 登录
- 终端用户：期望使用统一账户，而非产生重复账户

## Goals / Non-Goals

### Goals
- 修复同步用户 CAS 登录时的匹配逻辑，避免创建重复账户
- 保持与现有 CAS 登录流程的兼容性
- 保持与现有同步功能的兼容性

### Non-Goals
- 不修改 Casdoor SDK 的行为
- 不修改 CAS 协议响应格式
- 不引入新的用户标识字段

## Decisions

### 1. 用户匹配策略

**决定**: 当用户名冲突且为本地用户时，通过 Casdoor API 验证用户存在性，而非依赖 external_id 匹配

**理由**:
- Casdoor 是真实来源（Source of Truth）
- 用户名在 Casdoor 和 Zera 中都是唯一的
- 避免依赖不一致的 external_id

**实现逻辑**:
```
WHEN CAS 登录返回用户名
  IF 存在本地用户 (auth_provider=local) 且用户名匹配
    AND Casdoor 同步已启用
    AND 用户存在于 Casdoor 中（API 验证）
  THEN 将本地用户升级为 CAS 用户
    - 更新 auth_provider = cas
    - 更新 external_id = casUser.ExternalID（来自 CAS 响应）
```

### 2. 保留原有 external_id 匹配逻辑

**决定**: 在用户名匹配前，保留现有的 external_id 匹配逻辑作为第一优先级

**理由**:
- 兼容已存在的 CAS 用户（auth_provider=cas）
- 不影响纯 CAS 创建的用户流程

### 3. 日志增强

**决定**: 在关键匹配点添加详细日志

**理由**:
- 便于生产环境调试
- 帮助理解匹配流程

## Risks / Trade-offs

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| Casdoor API 调用失败 | 无法验证用户存在，回退到创建新用户 | 记录警告日志，保持降级行为 |
| 用户名在 Casdoor 中不唯一 | 理论上 Casdoor 用户名唯一，不应发生 | 使用 Casdoor 返回的用户 ID 作为辅助验证 |

## Migration Plan

1. **Phase 1**: 更新 `CreateOrUpdateUser` 方法中的用户匹配逻辑
2. **Phase 2**: 添加详细日志记录
3. **Phase 3**: 在开发环境验证同步→CAS登录流程

**回滚策略**: 无状态更改，回滚代码即可

## Open Questions

1. 是否需要提供手动修复工具来处理已创建的重复用户？（当前决定：否，由管理员手动处理）
