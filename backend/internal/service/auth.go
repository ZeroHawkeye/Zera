package service

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"strconv"
	"time"

	"zera/ent"
	"zera/ent/user"
	"zera/gen/base"
	"zera/internal/auth"
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
)

// AuthService 认证服务
type AuthService struct {
	client     *ent.Client
	jwtManager *auth.JWTManager
}

// NewAuthService 创建认证服务
func NewAuthService(client *ent.Client, jwtManager *auth.JWTManager) *AuthService {
	return &AuthService{
		client:     client,
		jwtManager: jwtManager,
	}
}

// Login 用户登录
func (s *AuthService) Login(ctx context.Context, username, password string) (*base.LoginResponse, error) {
	// 查询用户
	u, err := s.client.User.Query().
		Where(user.Username(username)).
		WithRoles().
		Only(ctx)
	if err != nil {
		if ent.IsNotFound(err) {
			return nil, ErrInvalidCredentials
		}
		return nil, err
	}

	// 验证密码
	if !s.verifyPassword(password, u.PasswordHash) {
		return nil, ErrInvalidCredentials
	}

	// 检查用户状态
	if u.Status != user.StatusActive {
		return nil, ErrUserInactive
	}

	// 更新最后登录时间
	_, err = u.Update().
		SetLastLoginAt(time.Now()).
		Save(ctx)
	if err != nil {
		return nil, err
	}

	// 生成令牌
	accessToken, err := s.jwtManager.GenerateAccessToken(u.ID, u.Username)
	if err != nil {
		return nil, err
	}

	refreshToken, err := s.jwtManager.GenerateRefreshToken(u.ID, u.Username)
	if err != nil {
		return nil, err
	}

	// 构建用户信息
	userInfo := s.buildUserInfo(u)

	return &base.LoginResponse{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		ExpiresIn:    s.jwtManager.GetAccessTokenExpire(),
		User:         userInfo,
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

	// 查询用户确保用户仍然有效
	u, err := s.client.User.Query().
		Where(user.ID(claims.UserID)).
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

	// 生成新的令牌
	newAccessToken, err := s.jwtManager.GenerateAccessToken(u.ID, u.Username)
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
		WithRoles().
		Only(ctx)
	if err != nil {
		if ent.IsNotFound(err) {
			return nil, ErrUserNotFound
		}
		return nil, err
	}

	return s.buildUserInfo(u), nil
}

// buildUserInfo 构建用户信息
func (s *AuthService) buildUserInfo(u *ent.User) *base.UserInfo {
	roles := make([]string, 0, len(u.Edges.Roles))
	for _, r := range u.Edges.Roles {
		roles = append(roles, r.Code)
	}

	return &base.UserInfo{
		Id:       intToString(u.ID),
		Username: u.Username,
		Nickname: u.Nickname,
		Avatar:   u.Avatar,
		Email:    u.Email,
		Roles:    roles,
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
