## 1. 依赖与配置扩展

- [x] 1.1 添加 `github.com/casdoor/casdoor-go-sdk` 依赖到 `backend/go.mod`
- [x] 1.2 扩展 `proto/base/cas_auth.proto` 中的 `CASConfig` 消息，添加：
  - `client_id` - Casdoor 应用 Client ID
  - `client_secret` - Casdoor 应用 Client Secret
  - `jwt_public_key` - Casdoor 应用证书公钥
  - `sync_to_casdoor` - 是否启用同步到 Casdoor
- [x] 1.3 运行 `buf generate` 重新生成 protobuf 代码
- [x] 1.4 更新 `backend/internal/service/cas_auth.go` 中的 `CASConfig` 结构体

## 2. Casdoor SDK 客户端封装

- [x] 2.1 创建 `backend/internal/casdoor/client.go`，封装 Casdoor SDK 客户端初始化
- [x] 2.2 实现 `CasdoorClient` 结构体，包含：
  - `Init()` - 使用配置初始化 SDK
  - `AddUser()` - 添加用户到 Casdoor
  - `UpdateUser()` - 更新 Casdoor 用户
  - `DeleteUser()` - 删除 Casdoor 用户
  - `GetUser()` - 检查用户是否存在
- [x] 2.3 实现 Zera User 到 Casdoor User 的数据映射转换

## 3. 用户服务同步集成

- [x] 3.1 在 `UserService` 中注入 `CasdoorClient` 依赖
- [x] 3.2 修改 `CreateUser()` 方法，创建成功后同步到 Casdoor
- [x] 3.3 修改 `UpdateUser()` 方法，更新成功后同步到 Casdoor
- [x] 3.4 修改 `DeleteUser()` 方法，删除成功后同步到 Casdoor
- [x] 3.5 添加同步状态检查：仅 `auth_provider=local` 的用户执行同步
- [x] 3.6 添加同步开关检查：读取 CASConfig.sync_to_casdoor 配置

## 4. 密码同步处理

- [x] 4.1 创建用户时将明文密码传递给 Casdoor SDK
- [x] 4.2 重置密码时同步新密码到 Casdoor
- [x] 4.3 更新用户时如果提供新密码则同步

## 5. 错误处理与日志

- [x] 5.1 同步失败时记录错误日志（包含用户 ID、操作类型、错误信息）
- [x] 5.2 同步失败不影响本地操作结果
- [ ] 5.3 在 API 响应中添加可选的同步状态字段

## 6. 前端 CAS 设置更新

- [x] 6.1 更新 `frontend/src/pages/admin/settings/CASSettings.tsx`，添加新字段：
  - Client ID 输入框
  - Client Secret 输入框（密码类型）
  - JWT 公钥多行文本输入
  - 同步开关
- [x] 6.2 更新表单验证逻辑
- [ ] 6.3 添加同步测试按钮（可选）

## 7. 测试与验证

- [ ] 7.1 编写 Casdoor 客户端单元测试（mock SDK）
- [ ] 7.2 在开发环境测试完整创建→同步流程
- [ ] 7.3 测试 Casdoor 不可用时的降级行为
- [ ] 7.4 测试用户名冲突场景
