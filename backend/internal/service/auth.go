package service

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"strconv"
	"time"

	"zera/ent"
	"zera/ent/role"
	"zera/ent/user"
	"zera/gen/base"
	"zera/internal/auth"
	"zera/internal/permission"
)

var (
	// ErrInvalidCredentials 无效的凭证
	ErrInvalidCredentials = errors.New("invalid username or password")
	// ErrUserNotFound 用户不存在
	ErrUserNotFound = errors.New("user not found")
	// ErrUserInactive 用户已禁用
	ErrUserInactive = errors.New("user is inactive or banned")
	// ErrInvalidToken 无效的令牌
	ErrInvalidToken = errors.New("invalid token")
	// ErrAccountLocked 账号已锁定
	ErrAccountLocked = errors.New("account is locked")
)

// AuthService 认证服务
type AuthService struct {
	client            *ent.Client
	jwtManager        *auth.JWTManager
	permissionChecker *permission.Checker
}

// NewAuthService 创建认证服务
func NewAuthService(client *ent.Client, jwtManager *auth.JWTManager) *AuthService {
	return &AuthService{
		client:            client,
		jwtManager:        jwtManager,
		permissionChecker: permission.NewChecker(client),
	}
}

// Login 用户登录
func (s *AuthService) Login(ctx context.Context, username, password string) (*base.LoginResponse, error) {
	// 获取安全设置
	settingService := NewSystemSettingService(s.client)
	securitySettings, err := s.getSecuritySettings(ctx, settingService)
	if err != nil {
		return nil, err
	}

	// 查询用户
	u, err := s.client.User.Query().
		Where(user.Username(username)).
		WithRoles(func(q *ent.RoleQuery) {
			q.WithPermissions()
		}).
		Only(ctx)
	if err != nil {
		if ent.IsNotFound(err) {
			return nil, ErrInvalidCredentials
		}
		return nil, err
	}

	// 检查账号是否被锁定
	if u.LockedUntil != nil && u.LockedUntil.After(time.Now()) {
		remainingMinutes := int(time.Until(*u.LockedUntil).Minutes()) + 1
		return nil, errors.New("账号已锁定，请在 " + strconv.Itoa(remainingMinutes) + " 分钟后重试")
	}

	// 如果锁定时间已过，重置登录尝试次数
	if u.LockedUntil != nil && u.LockedUntil.Before(time.Now()) {
		_, err = u.Update().
			SetLoginAttempts(0).
			ClearLockedUntil().
			Save(ctx)
		if err != nil {
			return nil, err
		}
		u.LoginAttempts = 0
		u.LockedUntil = nil
	}

	// 验证密码
	if !s.verifyPassword(password, u.PasswordHash) {
		// 增加登录失败次数
		newAttempts := u.LoginAttempts + 1
		update := u.Update().SetLoginAttempts(newAttempts)

		// 检查是否需要锁定账号
		if newAttempts >= securitySettings.maxLoginAttempts {
			lockUntil := time.Now().Add(time.Duration(securitySettings.lockoutDuration) * time.Minute)
			update = update.SetLockedUntil(lockUntil)
			_, err = update.Save(ctx)
			if err != nil {
				return nil, err
			}
			return nil, errors.New("登录失败次数过多，账号已被锁定 " + strconv.Itoa(securitySettings.lockoutDuration) + " 分钟")
		}

		_, err = update.Save(ctx)
		if err != nil {
			return nil, err
		}
		remainingAttempts := securitySettings.maxLoginAttempts - newAttempts
		if remainingAttempts > 0 {
			return nil, errors.New("用户名或密码错误，还剩 " + strconv.Itoa(remainingAttempts) + " 次尝试机会")
		}
		return nil, ErrInvalidCredentials
	}

	// 检查用户状态
	if u.Status != user.StatusActive {
		return nil, ErrUserInactive
	}

	// 登录成功，重置登录尝试次数并更新最后登录时间
	_, err = u.Update().
		SetLoginAttempts(0).
		ClearLockedUntil().
		SetLastLoginAt(time.Now()).
		Save(ctx)
	if err != nil {
		return nil, err
	}

	// 获取用户角色和权限
	roles, permissions := s.extractRolesAndPermissions(u)

	// 生成令牌（使用系统设置的会话超时时间）
	accessToken, err := s.jwtManager.GenerateAccessTokenWithExpire(u.ID, u.Username, roles, permissions, securitySettings.sessionTimeout)
	if err != nil {
		return nil, err
	}

	refreshToken, err := s.jwtManager.GenerateRefreshToken(u.ID, u.Username)
	if err != nil {
		return nil, err
	}

	// 构建用户信息
	userInfo := s.buildUserInfo(u, permissions)

	return &base.LoginResponse{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		ExpiresIn:    int64(securitySettings.sessionTimeout * 60), // 转换为秒
		User:         userInfo,
	}, nil
}

// securitySettingsData 安全设置数据
type securitySettingsData struct {
	maxLoginAttempts int
	lockoutDuration  int
	sessionTimeout   int
}

// getSecuritySettings 获取安全设置
func (s *AuthService) getSecuritySettings(ctx context.Context, settingService *SystemSettingService) (*securitySettingsData, error) {
	resp, err := settingService.GetAllSettings(ctx)
	if err != nil {
		// 如果获取失败，使用默认值
		return &securitySettingsData{
			maxLoginAttempts: 5,
			lockoutDuration:  30,
			sessionTimeout:   60,
		}, nil
	}

	settings := &securitySettingsData{
		maxLoginAttempts: 5,
		lockoutDuration:  30,
		sessionTimeout:   60,
	}

	if resp.Settings != nil && resp.Settings.Security != nil {
		if resp.Settings.Security.MaxLoginAttempts > 0 {
			settings.maxLoginAttempts = int(resp.Settings.Security.MaxLoginAttempts)
		}
		if resp.Settings.Security.LockoutDuration > 0 {
			settings.lockoutDuration = int(resp.Settings.Security.LockoutDuration)
		}
		if resp.Settings.Security.SessionTimeout > 0 {
			settings.sessionTimeout = int(resp.Settings.Security.SessionTimeout)
		}
	}

	return settings, nil
}

// Register 用户注册
func (s *AuthService) Register(ctx context.Context, req *base.RegisterRequest) (*base.RegisterResponse, error) {
	settingService := NewSystemSettingService(s.client)

	// 检查是否开启注册
	registrationEnabled, err := settingService.IsRegistrationEnabled(ctx)
	if err != nil {
		return nil, err
	}
	if !registrationEnabled {
		return nil, ErrRegistrationDisabled
	}

	// 检查密码是否一致
	if req.Password != req.ConfirmPassword {
		return nil, errors.New("两次输入的密码不一致")
	}

	// 验证密码策略
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
		return nil, errors.New("用户名已被使用")
	}

	// 检查邮箱是否已存在
	exists, err = s.client.User.Query().Where(user.Email(req.Email)).Exist(ctx)
	if err != nil {
		return nil, err
	}
	if exists {
		return nil, errors.New("邮箱已被使用")
	}

	// 设置昵称，默认使用用户名
	nickname := req.Nickname
	if nickname == "" {
		nickname = req.Username
	}

	// 获取默认注册角色
	defaultRoleCode, err := settingService.GetDefaultRegisterRole(ctx)
	if err != nil {
		defaultRoleCode = "user" // 默认使用 user 角色
	}

	// 查询默认角色
	defaultRole, err := s.client.Role.Query().
		Where(role.Code(defaultRoleCode)).
		Only(ctx)
	if err != nil {
		// 如果找不到配置的角色，尝试使用 user 角色
		if ent.IsNotFound(err) && defaultRoleCode != "user" {
			defaultRole, err = s.client.Role.Query().
				Where(role.Code("user")).
				Only(ctx)
		}
		if err != nil {
			// 如果仍然找不到，忽略角色分配
			defaultRole = nil
		}
	}

	// 创建用户
	userCreate := s.client.User.Create().
		SetUsername(req.Username).
		SetEmail(req.Email).
		SetPasswordHash(hashPassword(req.Password)).
		SetNickname(nickname).
		SetStatus(user.StatusActive)

	// 分配默认角色
	if defaultRole != nil {
		userCreate = userCreate.AddRoles(defaultRole)
	}

	u, err := userCreate.Save(ctx)
	if err != nil {
		return nil, err
	}

	// 构建用户信息
	roles := []string{}
	if defaultRole != nil {
		roles = append(roles, defaultRole.Code)
	}

	userInfo := &base.UserInfo{
		Id:       strconv.Itoa(u.ID),
		Username: u.Username,
		Nickname: u.Nickname,
		Email:    u.Email,
		Roles:    roles,
	}

	return &base.RegisterResponse{
		Success: true,
		User:    userInfo,
		Message: "注册成功",
	}, nil
}

// Logout 用户登出
func (s *AuthService) Logout(ctx context.Context, accessToken string) (bool, error) {
	// 验证令牌
	_, err := s.jwtManager.ValidateAccessToken(accessToken)
	if err != nil {
		return false, ErrInvalidToken
	}

	// TODO: 可以将令牌加入黑名单（需要 Redis 支持）
	// 目前简单返回成功
	return true, nil
}

// RefreshToken 刷新令牌
func (s *AuthService) RefreshToken(ctx context.Context, refreshToken string) (*base.RefreshTokenResponse, error) {
	// 验证刷新令牌
	claims, err := s.jwtManager.ValidateRefreshToken(refreshToken)
	if err != nil {
		return nil, ErrInvalidToken
	}

	// 查询用户确保用户仍然有效，并获取最新的角色和权限
	u, err := s.client.User.Query().
		Where(user.ID(claims.UserID)).
		WithRoles(func(q *ent.RoleQuery) {
			q.WithPermissions()
		}).
		Only(ctx)
	if err != nil {
		if ent.IsNotFound(err) {
			return nil, ErrUserNotFound
		}
		return nil, err
	}

	// 检查用户状态
	if u.Status != user.StatusActive {
		return nil, ErrUserInactive
	}

	// 获取用户角色和权限
	roles, permissions := s.extractRolesAndPermissions(u)

	// 生成新的令牌
	newAccessToken, err := s.jwtManager.GenerateAccessToken(u.ID, u.Username, roles, permissions)
	if err != nil {
		return nil, err
	}

	newRefreshToken, err := s.jwtManager.GenerateRefreshToken(u.ID, u.Username)
	if err != nil {
		return nil, err
	}

	return &base.RefreshTokenResponse{
		AccessToken:  newAccessToken,
		RefreshToken: newRefreshToken,
		ExpiresIn:    s.jwtManager.GetAccessTokenExpire(),
	}, nil
}

// GetCurrentUser 获取当前用户信息
func (s *AuthService) GetCurrentUser(ctx context.Context, userID int) (*base.UserInfo, error) {
	u, err := s.client.User.Query().
		Where(user.ID(userID)).
		WithRoles(func(q *ent.RoleQuery) {
			q.WithPermissions()
		}).
		Only(ctx)
	if err != nil {
		if ent.IsNotFound(err) {
			return nil, ErrUserNotFound
		}
		return nil, err
	}

	_, permissions := s.extractRolesAndPermissions(u)
	return s.buildUserInfo(u, permissions), nil
}

// extractRolesAndPermissions 从用户实体中提取角色和权限
func (s *AuthService) extractRolesAndPermissions(u *ent.User) ([]string, []string) {
	roles := make([]string, 0, len(u.Edges.Roles))
	permissionSet := make(map[string]bool)
	isAdmin := false

	for _, r := range u.Edges.Roles {
		roles = append(roles, r.Code)
		// 检查是否为管理员角色
		if r.Code == "admin" || r.Code == "super_admin" {
			isAdmin = true
		}
		// 收集该角色的所有权限
		for _, p := range r.Edges.Permissions {
			permissionSet[p.Code] = true
		}
	}

	// 管理员拥有所有权限
	if isAdmin {
		return roles, []string{"*"}
	}

	// 转换为切片
	permissions := make([]string, 0, len(permissionSet))
	for code := range permissionSet {
		permissions = append(permissions, code)
	}

	return roles, permissions
}

// buildUserInfo 构建用户信息
func (s *AuthService) buildUserInfo(u *ent.User, permissions []string) *base.UserInfo {
	roles := make([]string, 0, len(u.Edges.Roles))
	for _, r := range u.Edges.Roles {
		roles = append(roles, r.Code)
	}

	return &base.UserInfo{
		Id:          intToString(u.ID),
		Username:    u.Username,
		Nickname:    u.Nickname,
		Avatar:      u.Avatar,
		Email:       u.Email,
		Roles:       roles,
		Permissions: permissions,
	}
}

// verifyPassword 验证密码
func (s *AuthService) verifyPassword(password, hash string) bool {
	return hashPassword(password) == hash
}

// hashPassword 密码哈希
func hashPassword(password string) string {
	h := sha256.Sum256([]byte(password))
	return hex.EncodeToString(h[:])
}

// intToString 整数转字符串
func intToString(i int) string {
	return strconv.Itoa(i)
}
