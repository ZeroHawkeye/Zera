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
)

var (
	// ErrUserExists 用户已存在
	ErrUserExists = errors.New("user already exists")
)

// UserService 用户管理服务
type UserService struct {
	client *ent.Client
}

// NewUserService 创建用户管理服务
func NewUserService(client *ent.Client) *UserService {
	return &UserService{
		client: client,
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

	// 创建用户
	create := s.client.User.Create().
		SetUsername(req.Username).
		SetEmail(req.Email).
		SetPasswordHash(hashPassword(req.Password)).
		SetNickname(req.Nickname).
		SetAvatar(req.Avatar)

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

	return &base.UpdateUserResponse{
		User: s.toUserDetail(u),
	}, nil
}

// DeleteUser 删除用户
func (s *UserService) DeleteUser(ctx context.Context, id int) error {
	err := s.client.User.DeleteOneID(id).Exec(ctx)
	if err != nil {
		if ent.IsNotFound(err) {
			return ErrUserNotFound
		}
		return err
	}
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
	return nil
}

// BatchDeleteUsers 批量删除用户
func (s *UserService) BatchDeleteUsers(ctx context.Context, ids []int) (int, []string) {
	var deletedCount int
	var failedIds []string

	for _, id := range ids {
		err := s.client.User.DeleteOneID(id).Exec(ctx)
		if err != nil {
			failedIds = append(failedIds, strconv.Itoa(id))
		} else {
			deletedCount++
		}
	}

	return deletedCount, failedIds
}

// BatchUpdateStatus 批量更新用户状态
func (s *UserService) BatchUpdateStatus(ctx context.Context, ids []int, status base.UserStatus) (int, []string) {
	var updatedCount int
	var failedIds []string

	entStatus := protoStatusToEnt(status)
	if entStatus == "" {
		return 0, nil
	}

	for _, id := range ids {
		err := s.client.User.UpdateOneID(id).SetStatus(entStatus).Exec(ctx)
		if err != nil {
			failedIds = append(failedIds, strconv.Itoa(id))
		} else {
			updatedCount++
		}
	}

	return updatedCount, failedIds
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
