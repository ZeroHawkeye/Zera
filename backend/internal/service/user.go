package service

import (
	"context"
	"errors"
	"strconv"
	"time"

	"zera/ent"
	"zera/ent/role"
	"zera/ent/user"
	"zera/gen/base"
	"zera/internal/casdoor"
	"zera/internal/logger"
)

var (
	// ErrUserExists 用户已存在
	ErrUserExists = errors.New("user already exists")
)

// 批量操作错误码
const (
	ErrCodeNotFound      = "NOT_FOUND"
	ErrCodeInvalidID     = "INVALID_ID"
	ErrCodeDeleteFailed  = "DELETE_FAILED"
	ErrCodeUpdateFailed  = "UPDATE_FAILED"
	ErrCodeInvalidStatus = "INVALID_STATUS"
)

// BatchOperationResult 批量操作单个结果
type BatchOperationResult struct {
	ID           string
	Success      bool
	ErrorCode    string
	ErrorMessage string
}

// UserService 用户管理服务
type UserService struct {
	client        *ent.Client
	casdoorClient *casdoor.Client
}

// NewUserService 创建用户管理服务
func NewUserService(client *ent.Client) *UserService {
	return &UserService{
		client:        client,
		casdoorClient: casdoor.NewClient(),
	}
}

// NewUserServiceWithCasdoor 创建带有 Casdoor 客户端的用户管理服务
func NewUserServiceWithCasdoor(client *ent.Client, casdoorClient *casdoor.Client) *UserService {
	return &UserService{
		client:        client,
		casdoorClient: casdoorClient,
	}
}

// InitCasdoorClient 初始化 Casdoor 客户端 (应在配置更新后调用)
func (s *UserService) InitCasdoorClient(ctx context.Context) error {
	logger.Debug("InitCasdoorClient called")

	casAuthService := NewCASAuthService(s.client, nil)
	config, err := casAuthService.GetCASConfig(ctx)
	if err != nil {
		logger.Warn("failed to get CAS config for casdoor sync", "error", err)
		return nil
	}

	logger.Debug("CAS config loaded for casdoor client",
		"syncToCasdoor", config.SyncToCasdoor,
		"hasServerURL", config.ServerURL != "",
		"hasClientID", config.ClientID != "",
		"hasClientSecret", config.ClientSecret != "",
		"organization", config.Organization,
		"application", config.Application,
	)

	casdoorConfig := &casdoor.Config{
		ServerURL:    config.ServerURL,
		ClientID:     config.ClientID,
		ClientSecret: config.ClientSecret,
		JwtPublicKey: config.JwtPublicKey,
		Organization: config.Organization,
		Application:  config.Application,
		SyncEnabled:  config.SyncToCasdoor,
	}

	if err := s.casdoorClient.Init(casdoorConfig); err != nil {
		logger.Error("failed to initialize casdoor client", "error", err)
		return err
	}

	logger.Info("casdoor client initialization completed",
		"syncEnabled", s.casdoorClient.IsSyncEnabled(),
		"isInitialized", s.casdoorClient.IsInitialized(),
	)

	return nil
}

// shouldSyncToCasdoor 检查是否应该同步到 Casdoor
func (s *UserService) shouldSyncToCasdoor(ctx context.Context, u *ent.User) bool {
	// 仅同步本地用户 (auth_provider = local)
	if u.AuthProvider != user.AuthProviderLocal {
		logger.Debug("skipping casdoor sync: user is not local",
			"userID", u.ID,
			"username", u.Username,
			"authProvider", u.AuthProvider,
		)
		return false
	}

	// 检查 Casdoor 客户端是否启用
	if s.casdoorClient == nil {
		logger.Debug("skipping casdoor sync: casdoor client is nil",
			"userID", u.ID,
			"username", u.Username,
		)
		return false
	}

	if !s.casdoorClient.IsSyncEnabled() {
		logger.Debug("skipping casdoor sync: sync is not enabled",
			"userID", u.ID,
			"username", u.Username,
			"isInitialized", s.casdoorClient.IsInitialized(),
		)
		return false
	}

	logger.Debug("casdoor sync check passed",
		"userID", u.ID,
		"username", u.Username,
	)
	return true
}

// syncUserToCasdoor 同步用户到 Casdoor
// 同步成功后会更新本地用户的 external_id，以便 CAS 登录时能正确关联用户
func (s *UserService) syncUserToCasdoor(ctx context.Context, u *ent.User, password string) {
	logger.Debug("syncUserToCasdoor called",
		"userID", u.ID,
		"username", u.Username,
	)

	if !s.shouldSyncToCasdoor(ctx, u) {
		return
	}

	casdoorUser := &casdoor.User{
		Username:    u.Username,
		Email:       u.Email,
		DisplayName: u.Nickname,
		Password:    password,
		Avatar:      u.Avatar,
	}

	logger.Debug("syncing user to casdoor",
		"username", u.Username,
		"email", u.Email,
		"hasPassword", password != "",
	)

	casdoorID, err := s.casdoorClient.AddUserAndGetID(ctx, casdoorUser)
	if err != nil {
		if errors.Is(err, casdoor.ErrUserAlreadyExists) {
			// 用户已存在于 Casdoor，尝试更新本地用户的 external_id
			if casdoorID != "" && (u.ExternalID == nil || *u.ExternalID == "") {
				logger.Info("user already exists in casdoor, updating local external_id",
					"userID", u.ID,
					"username", u.Username,
					"casdoorID", casdoorID,
				)
				s.updateUserExternalID(ctx, u.ID, casdoorID)
			} else {
				logger.Info("user already exists in casdoor, skipping sync",
					"userID", u.ID,
					"username", u.Username,
				)
			}
		} else {
			logger.Error("failed to sync user to casdoor",
				"userID", u.ID,
				"username", u.Username,
				"error", err,
			)
		}
		return
	}

	// 同步成功，更新本地用户的 external_id
	if casdoorID != "" {
		s.updateUserExternalID(ctx, u.ID, casdoorID)
		logger.Info("user synced to casdoor successfully",
			"userID", u.ID,
			"username", u.Username,
			"casdoorID", casdoorID,
		)
	} else {
		logger.Warn("user synced to casdoor but failed to get casdoor ID",
			"userID", u.ID,
			"username", u.Username,
		)
	}
}

// updateUserExternalID 更新用户的 external_id
func (s *UserService) updateUserExternalID(ctx context.Context, userID int, externalID string) {
	err := s.client.User.UpdateOneID(userID).
		SetExternalID(externalID).
		Exec(ctx)
	if err != nil {
		logger.Error("failed to update user external_id",
			"userID", userID,
			"externalID", externalID,
			"error", err,
		)
	} else {
		logger.Debug("user external_id updated",
			"userID", userID,
			"externalID", externalID,
		)
	}
}

// syncUserUpdateToCasdoor 同步用户更新到 Casdoor
func (s *UserService) syncUserUpdateToCasdoor(ctx context.Context, u *ent.User, password string) {
	if !s.shouldSyncToCasdoor(ctx, u) {
		return
	}

	casdoorUser := &casdoor.User{
		Username:    u.Username,
		Email:       u.Email,
		DisplayName: u.Nickname,
		Password:    password,
		Avatar:      u.Avatar,
	}

	if err := s.casdoorClient.UpdateUser(ctx, casdoorUser); err != nil {
		if errors.Is(err, casdoor.ErrUserNotFound) {
			// 用户在 Casdoor 中不存在，尝试创建
			logger.Info("user not found in casdoor, attempting to create",
				"userID", u.ID,
				"username", u.Username,
			)
			s.syncUserToCasdoor(ctx, u, password)
		} else {
			logger.Error("failed to sync user update to casdoor",
				"userID", u.ID,
				"username", u.Username,
				"error", err,
			)
		}
	}
}

// syncUserDeleteToCasdoor 同步用户删除到 Casdoor
func (s *UserService) syncUserDeleteToCasdoor(ctx context.Context, u *ent.User) {
	// 检查是否为本地用户
	if u.AuthProvider != user.AuthProviderLocal {
		return
	}

	// 检查 Casdoor 客户端是否启用
	if s.casdoorClient == nil || !s.casdoorClient.IsSyncEnabled() {
		return
	}

	if err := s.casdoorClient.DeleteUser(ctx, u.Username); err != nil {
		logger.Error("failed to sync user deletion to casdoor",
			"userID", u.ID,
			"username", u.Username,
			"error", err,
		)
	}
}

// ListUsers 获取用户列表
func (s *UserService) ListUsers(ctx context.Context, req *base.ListUsersRequest) (*base.ListUsersResponse, error) {
	query := s.client.User.Query().WithRoles()

	// 搜索条件
	if req.Keyword != "" {
		query = query.Where(
			user.Or(
				user.UsernameContains(req.Keyword),
				user.EmailContains(req.Keyword),
				user.NicknameContains(req.Keyword),
			),
		)
	}

	// 状态筛选
	if req.Status != base.UserStatus_USER_STATUS_UNSPECIFIED {
		status := protoStatusToEnt(req.Status)
		if status != "" {
			query = query.Where(user.StatusEQ(status))
		}
	}

	// 角色筛选
	if req.Role != "" {
		query = query.Where(user.HasRolesWith(role.Code(req.Role)))
	}

	// 获取总数
	total, err := query.Clone().Count(ctx)
	if err != nil {
		return nil, err
	}

	// 排序
	if req.SortBy != "" {
		orderFunc := ent.Asc
		if req.Descending {
			orderFunc = ent.Desc
		}
		switch req.SortBy {
		case "username":
			query = query.Order(orderFunc(user.FieldUsername))
		case "email":
			query = query.Order(orderFunc(user.FieldEmail))
		case "created_at":
			query = query.Order(orderFunc(user.FieldCreatedAt))
		case "last_login_at":
			query = query.Order(orderFunc(user.FieldLastLoginAt))
		default:
			query = query.Order(ent.Desc(user.FieldCreatedAt))
		}
	} else {
		query = query.Order(ent.Desc(user.FieldCreatedAt))
	}

	// 分页
	page := int(req.Page)
	if page < 1 {
		page = 1
	}
	pageSize := int(req.PageSize)
	if pageSize < 1 {
		pageSize = 10
	}
	if pageSize > 100 {
		pageSize = 100
	}

	offset := (page - 1) * pageSize
	users, err := query.Offset(offset).Limit(pageSize).All(ctx)
	if err != nil {
		return nil, err
	}

	// 转换为响应
	userDetails := make([]*base.UserDetail, 0, len(users))
	for _, u := range users {
		userDetails = append(userDetails, s.toUserDetail(u))
	}

	return &base.ListUsersResponse{
		Users:    userDetails,
		Total:    int64(total),
		Page:     int32(page),
		PageSize: int32(pageSize),
	}, nil
}

// GetUser 获取用户详情
func (s *UserService) GetUser(ctx context.Context, id int) (*base.GetUserResponse, error) {
	u, err := s.client.User.Query().
		Where(user.ID(id)).
		WithRoles().
		Only(ctx)
	if err != nil {
		if ent.IsNotFound(err) {
			return nil, ErrUserNotFound
		}
		return nil, err
	}

	return &base.GetUserResponse{
		User: s.toUserDetail(u),
	}, nil
}

// CreateUser 创建用户
func (s *UserService) CreateUser(ctx context.Context, req *base.CreateUserRequest) (*base.CreateUserResponse, error) {
	// 验证密码策略
	settingService := NewSystemSettingService(s.client)
	policy, err := GetPasswordPolicy(ctx, settingService)
	if err != nil {
		return nil, err
	}
	if err := ValidatePassword(req.Password, policy); err != nil {
		return nil, err
	}

	// 检查用户名是否已存在
	exists, err := s.client.User.Query().Where(user.Username(req.Username)).Exist(ctx)
	if err != nil {
		return nil, err
	}
	if exists {
		return nil, ErrUserExists
	}

	// 检查邮箱是否已存在
	exists, err = s.client.User.Query().Where(user.Email(req.Email)).Exist(ctx)
	if err != nil {
		return nil, err
	}
	if exists {
		return nil, ErrUserExists
	}

	// 创建用户 (本地用户默认 auth_provider = local)
	create := s.client.User.Create().
		SetUsername(req.Username).
		SetEmail(req.Email).
		SetPasswordHash(hashPassword(req.Password)).
		SetNickname(req.Nickname).
		SetAvatar(req.Avatar).
		SetAuthProvider(user.AuthProviderLocal)

	// 设置状态
	if req.Status != base.UserStatus_USER_STATUS_UNSPECIFIED {
		status := protoStatusToEnt(req.Status)
		if status != "" {
			create = create.SetStatus(status)
		}
	}

	u, err := create.Save(ctx)
	if err != nil {
		return nil, err
	}

	// 分配角色
	if len(req.Roles) > 0 {
		roles, err := s.client.Role.Query().Where(role.CodeIn(req.Roles...)).All(ctx)
		if err != nil {
			return nil, err
		}
		if len(roles) > 0 {
			_, err = u.Update().AddRoles(roles...).Save(ctx)
			if err != nil {
				return nil, err
			}
		}
	}

	// 重新查询以获取关联数据
	u, err = s.client.User.Query().
		Where(user.ID(u.ID)).
		WithRoles().
		Only(ctx)
	if err != nil {
		return nil, err
	}

	// 同步用户到 Casdoor (异步，不影响本地操作)
	go s.syncUserToCasdoor(ctx, u, req.Password)

	return &base.CreateUserResponse{
		User: s.toUserDetail(u),
	}, nil
}

// UpdateUser 更新用户
func (s *UserService) UpdateUser(ctx context.Context, id int, req *base.UpdateUserRequest) (*base.UpdateUserResponse, error) {
	u, err := s.client.User.Query().Where(user.ID(id)).Only(ctx)
	if err != nil {
		if ent.IsNotFound(err) {
			return nil, ErrUserNotFound
		}
		return nil, err
	}

	update := u.Update()

	if req.Nickname != nil {
		update = update.SetNickname(*req.Nickname)
	}
	if req.Email != nil {
		// 检查邮箱是否被其他用户使用
		exists, err := s.client.User.Query().
			Where(user.Email(*req.Email), user.IDNEQ(id)).
			Exist(ctx)
		if err != nil {
			return nil, err
		}
		if exists {
			return nil, ErrUserExists
		}
		update = update.SetEmail(*req.Email)
	}
	if req.Avatar != nil {
		update = update.SetAvatar(*req.Avatar)
	}
	if req.Status != nil {
		status := protoStatusToEnt(*req.Status)
		if status != "" {
			update = update.SetStatus(status)
		}
	}

	_, err = update.Save(ctx)
	if err != nil {
		return nil, err
	}

	// 更新角色
	if len(req.Roles) > 0 {
		// 清除现有角色
		_, err = u.Update().ClearRoles().Save(ctx)
		if err != nil {
			return nil, err
		}
		// 添加新角色
		roles, err := s.client.Role.Query().Where(role.CodeIn(req.Roles...)).All(ctx)
		if err != nil {
			return nil, err
		}
		if len(roles) > 0 {
			_, err = u.Update().AddRoles(roles...).Save(ctx)
			if err != nil {
				return nil, err
			}
		}
	}

	// 重新查询以获取更新后的数据
	u, err = s.client.User.Query().
		Where(user.ID(id)).
		WithRoles().
		Only(ctx)
	if err != nil {
		return nil, err
	}

	// 同步用户更新到 Casdoor (异步，不影响本地操作)
	go s.syncUserUpdateToCasdoor(ctx, u, "")

	return &base.UpdateUserResponse{
		User: s.toUserDetail(u),
	}, nil
}

// DeleteUser 删除用户
func (s *UserService) DeleteUser(ctx context.Context, id int) error {
	// 先查询用户信息 (用于同步删除到 Casdoor)
	u, err := s.client.User.Query().Where(user.ID(id)).Only(ctx)
	if err != nil {
		if ent.IsNotFound(err) {
			return ErrUserNotFound
		}
		return err
	}

	// 删除用户
	err = s.client.User.DeleteOneID(id).Exec(ctx)
	if err != nil {
		if ent.IsNotFound(err) {
			return ErrUserNotFound
		}
		return err
	}

	// 同步用户删除到 Casdoor (异步，不影响本地操作)
	go s.syncUserDeleteToCasdoor(ctx, u)

	return nil
}

// ResetPassword 重置用户密码
func (s *UserService) ResetPassword(ctx context.Context, id int, newPassword string) error {
	// 验证密码策略
	settingService := NewSystemSettingService(s.client)
	policy, err := GetPasswordPolicy(ctx, settingService)
	if err != nil {
		return err
	}
	if err := ValidatePassword(newPassword, policy); err != nil {
		return err
	}

	// 先查询用户信息 (用于同步密码到 Casdoor)
	u, err := s.client.User.Query().Where(user.ID(id)).Only(ctx)
	if err != nil {
		if ent.IsNotFound(err) {
			return ErrUserNotFound
		}
		return err
	}

	err = s.client.User.UpdateOneID(id).
		SetPasswordHash(hashPassword(newPassword)).
		SetLoginAttempts(0).
		ClearLockedUntil().
		Exec(ctx)
	if err != nil {
		if ent.IsNotFound(err) {
			return ErrUserNotFound
		}
		return err
	}

	// 同步密码到 Casdoor (异步，不影响本地操作)
	go s.syncPasswordToCasdoor(ctx, u, newPassword)

	return nil
}

// syncPasswordToCasdoor 同步密码到 Casdoor
func (s *UserService) syncPasswordToCasdoor(ctx context.Context, u *ent.User, newPassword string) {
	// 检查是否为本地用户
	if u.AuthProvider != user.AuthProviderLocal {
		return
	}

	// 检查 Casdoor 客户端是否启用
	if s.casdoorClient == nil || !s.casdoorClient.IsSyncEnabled() {
		return
	}

	if err := s.casdoorClient.UpdatePassword(ctx, u.Username, newPassword); err != nil {
		if errors.Is(err, casdoor.ErrUserNotFound) {
			logger.Info("user not found in casdoor, password sync skipped",
				"userID", u.ID,
				"username", u.Username,
			)
		} else {
			logger.Error("failed to sync password to casdoor",
				"userID", u.ID,
				"username", u.Username,
				"error", err,
			)
		}
	}
}

// BatchDeleteUsers 批量删除用户
// 优化: 使用批量查询获取用户信息，支持 Casdoor 同步，返回详细错误信息
func (s *UserService) BatchDeleteUsers(ctx context.Context, ids []int) ([]BatchOperationResult, int, int) {
	results := make([]BatchOperationResult, 0, len(ids))
	var successCount, failedCount int

	if len(ids) == 0 {
		return results, 0, 0
	}

	// 批量查询所有用户信息（用于 Casdoor 同步）
	users, err := s.client.User.Query().
		Where(user.IDIn(ids...)).
		All(ctx)
	if err != nil {
		// 查询失败，所有 ID 都标记为失败
		for _, id := range ids {
			results = append(results, BatchOperationResult{
				ID:           strconv.Itoa(id),
				Success:      false,
				ErrorCode:    ErrCodeDeleteFailed,
				ErrorMessage: "查询用户信息失败",
			})
			failedCount++
		}
		return results, successCount, failedCount
	}

	// 建立 ID -> User 映射
	userMap := make(map[int]*ent.User, len(users))
	for _, u := range users {
		userMap[u.ID] = u
	}

	// 收集存在的用户 ID 用于批量删除
	existingIDs := make([]int, 0, len(users))
	for _, u := range users {
		existingIDs = append(existingIDs, u.ID)
	}

	// 批量删除存在的用户
	var deletedIDs map[int]bool
	if len(existingIDs) > 0 {
		_, err = s.client.User.Delete().
			Where(user.IDIn(existingIDs...)).
			Exec(ctx)
		if err != nil {
			// 批量删除失败，标记所有存在的用户为失败
			deletedIDs = make(map[int]bool)
		} else {
			// 批量删除成功
			deletedIDs = make(map[int]bool, len(existingIDs))
			for _, id := range existingIDs {
				deletedIDs[id] = true
			}
		}
	} else {
		deletedIDs = make(map[int]bool)
	}

	// 处理每个请求的 ID，生成详细结果
	for _, id := range ids {
		idStr := strconv.Itoa(id)
		u, exists := userMap[id]

		if !exists {
			// 用户不存在
			results = append(results, BatchOperationResult{
				ID:           idStr,
				Success:      false,
				ErrorCode:    ErrCodeNotFound,
				ErrorMessage: "用户不存在",
			})
			failedCount++
			continue
		}

		if deletedIDs[id] {
			// 删除成功
			results = append(results, BatchOperationResult{
				ID:      idStr,
				Success: true,
			})
			successCount++

			// 异步同步删除到 Casdoor（使用独立 context 避免请求取消后同步失败）
			go s.syncUserDeleteToCasdoor(context.Background(), u)
		} else {
			// 删除失败
			results = append(results, BatchOperationResult{
				ID:           idStr,
				Success:      false,
				ErrorCode:    ErrCodeDeleteFailed,
				ErrorMessage: "删除用户失败",
			})
			failedCount++
		}
	}

	return results, successCount, failedCount
}

// BatchUpdateStatus 批量更新用户状态
// 优化: 使用批量更新，返回详细错误信息
func (s *UserService) BatchUpdateStatus(ctx context.Context, ids []int, status base.UserStatus) ([]BatchOperationResult, int, int) {
	results := make([]BatchOperationResult, 0, len(ids))
	var successCount, failedCount int

	if len(ids) == 0 {
		return results, 0, 0
	}

	entStatus := protoStatusToEnt(status)
	if entStatus == "" {
		// 无效状态，所有 ID 都标记为失败
		for _, id := range ids {
			results = append(results, BatchOperationResult{
				ID:           strconv.Itoa(id),
				Success:      false,
				ErrorCode:    ErrCodeInvalidStatus,
				ErrorMessage: "无效的用户状态",
			})
			failedCount++
		}
		return results, successCount, failedCount
	}

	// 批量查询存在的用户
	existingUsers, err := s.client.User.Query().
		Where(user.IDIn(ids...)).
		Select(user.FieldID).
		All(ctx)
	if err != nil {
		// 查询失败，所有 ID 都标记为失败
		for _, id := range ids {
			results = append(results, BatchOperationResult{
				ID:           strconv.Itoa(id),
				Success:      false,
				ErrorCode:    ErrCodeUpdateFailed,
				ErrorMessage: "查询用户信息失败",
			})
			failedCount++
		}
		return results, successCount, failedCount
	}

	// 建立存在的用户 ID 集合
	existingIDSet := make(map[int]bool, len(existingUsers))
	existingIDs := make([]int, 0, len(existingUsers))
	for _, u := range existingUsers {
		existingIDSet[u.ID] = true
		existingIDs = append(existingIDs, u.ID)
	}

	// 批量更新存在的用户状态
	var updatedIDs map[int]bool
	if len(existingIDs) > 0 {
		_, err = s.client.User.Update().
			Where(user.IDIn(existingIDs...)).
			SetStatus(entStatus).
			Save(ctx)
		if err != nil {
			// 批量更新失败
			updatedIDs = make(map[int]bool)
		} else {
			// 批量更新成功
			updatedIDs = existingIDSet
		}
	} else {
		updatedIDs = make(map[int]bool)
	}

	// 处理每个请求的 ID，生成详细结果
	for _, id := range ids {
		idStr := strconv.Itoa(id)

		if !existingIDSet[id] {
			// 用户不存在
			results = append(results, BatchOperationResult{
				ID:           idStr,
				Success:      false,
				ErrorCode:    ErrCodeNotFound,
				ErrorMessage: "用户不存在",
			})
			failedCount++
			continue
		}

		if updatedIDs[id] {
			// 更新成功
			results = append(results, BatchOperationResult{
				ID:      idStr,
				Success: true,
			})
			successCount++
		} else {
			// 更新失败
			results = append(results, BatchOperationResult{
				ID:           idStr,
				Success:      false,
				ErrorCode:    ErrCodeUpdateFailed,
				ErrorMessage: "更新用户状态失败",
			})
			failedCount++
		}
	}

	return results, successCount, failedCount
}

// toUserDetail 将 ent.User 转换为 base.UserDetail
func (s *UserService) toUserDetail(u *ent.User) *base.UserDetail {
	roles := make([]string, 0, len(u.Edges.Roles))
	for _, r := range u.Edges.Roles {
		roles = append(roles, r.Code)
	}

	detail := &base.UserDetail{
		Id:        strconv.Itoa(u.ID),
		Username:  u.Username,
		Nickname:  u.Nickname,
		Avatar:    u.Avatar,
		Email:     u.Email,
		Status:    entStatusToProto(u.Status),
		Roles:     roles,
		CreatedAt: u.CreatedAt.Format(time.RFC3339),
		UpdatedAt: u.UpdatedAt.Format(time.RFC3339),
	}

	if u.LastLoginAt != nil {
		detail.LastLoginAt = u.LastLoginAt.Format(time.RFC3339)
	}

	return detail
}

// protoStatusToEnt 将 proto 状态转换为 ent 状态
func protoStatusToEnt(status base.UserStatus) user.Status {
	switch status {
	case base.UserStatus_USER_STATUS_ACTIVE:
		return user.StatusActive
	case base.UserStatus_USER_STATUS_INACTIVE:
		return user.StatusInactive
	case base.UserStatus_USER_STATUS_BANNED:
		return user.StatusBanned
	default:
		return ""
	}
}

// entStatusToProto 将 ent 状态转换为 proto 状态
func entStatusToProto(status user.Status) base.UserStatus {
	switch status {
	case user.StatusActive:
		return base.UserStatus_USER_STATUS_ACTIVE
	case user.StatusInactive:
		return base.UserStatus_USER_STATUS_INACTIVE
	case user.StatusBanned:
		return base.UserStatus_USER_STATUS_BANNED
	default:
		return base.UserStatus_USER_STATUS_UNSPECIFIED
	}
}
