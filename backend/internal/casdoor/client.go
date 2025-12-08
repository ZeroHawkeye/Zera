// Package casdoor 提供 Casdoor SDK 客户端封装
// 用于将 Zera 用户同步到 Casdoor
package casdoor

import (
	"context"
	"errors"
	"fmt"
	"sync"

	"zera/internal/logger"

	"github.com/casdoor/casdoor-go-sdk/casdoorsdk"
)

// 同步相关错误
var (
	ErrClientNotInitialized = errors.New("casdoor client is not initialized")
	ErrSyncDisabled         = errors.New("sync to casdoor is disabled")
	ErrUserNotFound         = errors.New("user not found in casdoor")
	ErrUserAlreadyExists    = errors.New("user already exists in casdoor")
)

// Config Casdoor SDK 配置
type Config struct {
	ServerURL    string // Casdoor 服务器地址
	ClientID     string // 应用 Client ID
	ClientSecret string // 应用 Client Secret
	JwtPublicKey string // JWT 公钥证书
	Organization string // 组织名
	Application  string // 应用名
	SyncEnabled  bool   // 是否启用同步
}

// User Zera 用户信息 (用于同步)
type User struct {
	Username    string // 用户名
	Email       string // 邮箱
	DisplayName string // 显示名称
	Password    string // 明文密码 (仅创建/更新时使用)
	Avatar      string // 头像 URL
	Phone       string // 手机号
}

// Client Casdoor SDK 客户端封装
type Client struct {
	mu          sync.RWMutex
	config      *Config
	initialized bool
	client      *casdoorsdk.Client
}

// NewClient 创建 Casdoor 客户端
func NewClient() *Client {
	return &Client{}
}

// Init 使用配置初始化 SDK
// 如果配置无效或同步未启用，将返回 nil 但客户端不可用
func (c *Client) Init(config *Config) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	c.config = config
	c.initialized = false
	c.client = nil

	if config == nil {
		logger.Warn("casdoor config is nil, client not initialized")
		return nil
	}

	if !config.SyncEnabled {
		logger.Info("casdoor sync is disabled")
		return nil
	}

	// 验证必要配置
	if config.ServerURL == "" || config.ClientID == "" || config.ClientSecret == "" || config.Organization == "" {
		logger.Warn("casdoor config is incomplete, client not initialized",
			"hasServerURL", config.ServerURL != "",
			"hasClientID", config.ClientID != "",
			"hasClientSecret", config.ClientSecret != "",
			"hasOrganization", config.Organization != "",
		)
		return nil
	}

	// 初始化 Casdoor SDK 客户端
	client := casdoorsdk.NewClient(
		config.ServerURL,
		config.ClientID,
		config.ClientSecret,
		config.JwtPublicKey,
		config.Organization,
		config.Application,
	)

	c.client = client
	c.initialized = true

	logger.Info("casdoor client initialized successfully",
		"serverURL", config.ServerURL,
		"organization", config.Organization,
		"application", config.Application,
	)

	return nil
}

// IsInitialized 检查客户端是否已初始化
func (c *Client) IsInitialized() bool {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.initialized
}

// IsSyncEnabled 检查同步是否启用
func (c *Client) IsSyncEnabled() bool {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.config != nil && c.config.SyncEnabled && c.initialized
}

// GetUser 检查用户是否存在于 Casdoor
func (c *Client) GetUser(ctx context.Context, username string) (*casdoorsdk.User, error) {
	c.mu.RLock()
	defer c.mu.RUnlock()

	if !c.initialized {
		return nil, ErrClientNotInitialized
	}

	user, err := c.client.GetUser(username)
	if err != nil {
		return nil, fmt.Errorf("failed to get user from casdoor: %w", err)
	}

	if user == nil {
		return nil, ErrUserNotFound
	}

	return user, nil
}

// AddUser 添加用户到 Casdoor
func (c *Client) AddUser(ctx context.Context, user *User) error {
	_, err := c.AddUserAndGetID(ctx, user)
	return err
}

// AddUserAndGetID 添加用户到 Casdoor 并返回用户 ID
// 返回的 ID 可用于关联本地用户与 Casdoor 用户
func (c *Client) AddUserAndGetID(ctx context.Context, user *User) (string, error) {
	c.mu.RLock()
	defer c.mu.RUnlock()

	if !c.initialized {
		return "", ErrClientNotInitialized
	}

	if c.config == nil || !c.config.SyncEnabled {
		return "", ErrSyncDisabled
	}

	logger.Debug("attempting to add user to casdoor",
		"username", user.Username,
		"organization", c.config.Organization,
		"serverURL", c.config.ServerURL,
	)

	// 检查用户是否已存在
	existingUser, err := c.client.GetUser(user.Username)
	if err == nil && existingUser != nil && existingUser.Name != "" {
		logger.Warn("user already exists in casdoor, returning existing user ID",
			"username", user.Username,
			"existingID", existingUser.Id,
		)
		// 用户已存在，返回现有用户的 ID
		return existingUser.Id, ErrUserAlreadyExists
	}

	// 构建 Casdoor 用户对象
	casdoorUser := c.mapToCasdoorUser(user)

	logger.Debug("casdoor user object created",
		"owner", casdoorUser.Owner,
		"name", casdoorUser.Name,
		"email", casdoorUser.Email,
		"displayName", casdoorUser.DisplayName,
	)

	// 调用 SDK 添加用户
	success, err := c.client.AddUser(casdoorUser)
	if err != nil {
		logger.Error("casdoor AddUser API call failed",
			"error", err,
			"success", success,
		)
		return "", fmt.Errorf("failed to add user to casdoor: %w", err)
	}

	// 添加成功后，获取用户信息以获得 Casdoor 分配的 ID
	createdUser, err := c.client.GetUser(user.Username)
	if err != nil {
		logger.Warn("failed to get created user from casdoor, sync may be incomplete",
			"username", user.Username,
			"error", err,
		)
		// 用户已创建但无法获取 ID，返回空 ID
		return "", nil
	}

	logger.Info("user added to casdoor successfully",
		"username", user.Username,
		"casdoorID", createdUser.Id,
		"success", success,
	)

	return createdUser.Id, nil
}

// UpdateUser 更新 Casdoor 用户
func (c *Client) UpdateUser(ctx context.Context, user *User) error {
	c.mu.RLock()
	defer c.mu.RUnlock()

	if !c.initialized {
		return ErrClientNotInitialized
	}

	if c.config == nil || !c.config.SyncEnabled {
		return ErrSyncDisabled
	}

	// 获取现有用户
	existingUser, err := c.client.GetUser(user.Username)
	if err != nil {
		return fmt.Errorf("failed to get existing user from casdoor: %w", err)
	}

	if existingUser == nil || existingUser.Name == "" {
		logger.Warn("user not found in casdoor, cannot update",
			"username", user.Username,
		)
		return ErrUserNotFound
	}

	// 更新用户字段
	if user.Email != "" {
		existingUser.Email = user.Email
	}
	if user.DisplayName != "" {
		existingUser.DisplayName = user.DisplayName
	}
	if user.Avatar != "" {
		existingUser.Avatar = user.Avatar
	}
	if user.Phone != "" {
		existingUser.Phone = user.Phone
	}
	if user.Password != "" {
		existingUser.Password = user.Password
	}

	// 调用 SDK 更新用户
	_, err = c.client.UpdateUser(existingUser)
	if err != nil {
		return fmt.Errorf("failed to update user in casdoor: %w", err)
	}

	logger.Info("user updated in casdoor successfully",
		"username", user.Username,
	)

	return nil
}

// DeleteUser 删除 Casdoor 用户
func (c *Client) DeleteUser(ctx context.Context, username string) error {
	c.mu.RLock()
	defer c.mu.RUnlock()

	if !c.initialized {
		return ErrClientNotInitialized
	}

	if c.config == nil || !c.config.SyncEnabled {
		return ErrSyncDisabled
	}

	// 获取现有用户
	existingUser, err := c.client.GetUser(username)
	if err != nil {
		logger.Warn("failed to get user from casdoor for deletion, user may not exist",
			"username", username,
			"error", err,
		)
		return nil // 用户不存在不算错误
	}

	if existingUser == nil || existingUser.Name == "" {
		logger.Info("user not found in casdoor, nothing to delete",
			"username", username,
		)
		return nil
	}

	// 调用 SDK 删除用户
	_, err = c.client.DeleteUser(existingUser)
	if err != nil {
		return fmt.Errorf("failed to delete user from casdoor: %w", err)
	}

	logger.Info("user deleted from casdoor successfully",
		"username", username,
	)

	return nil
}

// UpdatePassword 更新 Casdoor 用户密码
func (c *Client) UpdatePassword(ctx context.Context, username, newPassword string) error {
	c.mu.RLock()
	defer c.mu.RUnlock()

	if !c.initialized {
		return ErrClientNotInitialized
	}

	if c.config == nil || !c.config.SyncEnabled {
		return ErrSyncDisabled
	}

	// 获取现有用户
	existingUser, err := c.client.GetUser(username)
	if err != nil {
		return fmt.Errorf("failed to get user from casdoor: %w", err)
	}

	if existingUser == nil || existingUser.Name == "" {
		logger.Warn("user not found in casdoor, cannot update password",
			"username", username,
		)
		return ErrUserNotFound
	}

	// 更新密码
	existingUser.Password = newPassword

	// 调用 SDK 更新用户
	_, err = c.client.UpdateUser(existingUser)
	if err != nil {
		return fmt.Errorf("failed to update user password in casdoor: %w", err)
	}

	logger.Info("user password updated in casdoor successfully",
		"username", username,
	)

	return nil
}

// mapToCasdoorUser 将 Zera User 映射为 Casdoor User
func (c *Client) mapToCasdoorUser(user *User) *casdoorsdk.User {
	return &casdoorsdk.User{
		Owner:       c.config.Organization,
		Name:        user.Username,
		DisplayName: user.DisplayName,
		Email:       user.Email,
		Password:    user.Password,
		Avatar:      user.Avatar,
		Phone:       user.Phone,
		Type:        "normal-user",
	}
}
