package database

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"

	"zera/ent"
	"zera/ent/migrate"
	"zera/ent/role"
	"zera/ent/user"
	"zera/internal/config"
	"zera/internal/logger"

	_ "github.com/lib/pq"
)

// 系统内置角色代码
const (
	RoleCodeAdmin = "admin"
	RoleCodeUser  = "user"
)

// Database 数据库连接管理
type Database struct {
	Client *ent.Client
	config *config.Config
}

// New 创建数据库连接
func New(cfg *config.Config) (*Database, error) {
	client, err := ent.Open("postgres", cfg.Database.DSN())
	if err != nil {
		return nil, fmt.Errorf("failed opening connection to postgres: %w", err)
	}

	db := &Database{
		Client: client,
		config: cfg,
	}

	return db, nil
}

// AutoMigrate 开发环境自动迁移
// 仅在 dev_mode = true 时执行
func (d *Database) AutoMigrate(ctx context.Context) error {
	if !d.config.App.DevMode {
		logger.InfoContext(ctx, "skipping auto migration (dev_mode is disabled)")
		return nil
	}

	logger.InfoContext(ctx, "running auto migration in development mode")

	// 使用 ent 的自动迁移功能
	// WithDropIndex 和 WithDropColumn 允许在开发环境中删除索引和列
	if err := d.Client.Schema.Create(
		ctx,
		migrate.WithDropIndex(true),
		migrate.WithDropColumn(true),
	); err != nil {
		return fmt.Errorf("failed creating schema resources: %w", err)
	}

	logger.InfoContext(ctx, "auto migration completed successfully")
	return nil
}

// InitSystemRoles 初始化系统内置角色
func (d *Database) InitSystemRoles(ctx context.Context) error {
	logger.InfoContext(ctx, "initializing system roles")

	// 定义系统内置角色
	systemRoles := []struct {
		Code        string
		Name        string
		Description string
		SortOrder   int
	}{
		{RoleCodeAdmin, "管理员", "系统管理员，拥有所有权限", 1},
		{RoleCodeUser, "普通用户", "普通注册用户", 100},
	}

	for _, r := range systemRoles {
		exists, err := d.Client.Role.Query().
			Where(role.Code(r.Code)).
			Exist(ctx)
		if err != nil {
			return fmt.Errorf("failed to check role %s: %w", r.Code, err)
		}

		if exists {
			continue
		}

		_, err = d.Client.Role.Create().
			SetCode(r.Code).
			SetName(r.Name).
			SetDescription(r.Description).
			SetIsSystem(true).
			SetSortOrder(r.SortOrder).
			Save(ctx)
		if err != nil {
			return fmt.Errorf("failed to create role %s: %w", r.Code, err)
		}
		logger.InfoContext(ctx, "created system role", "code", r.Code)
	}

	logger.InfoContext(ctx, "system roles initialized")
	return nil
}

// InitAdminUser 初始化管理员用户
// 如果管理员用户不存在则创建并分配管理员角色
func (d *Database) InitAdminUser(ctx context.Context) error {
	adminCfg := d.config.Admin

	// 获取管理员角色
	adminRole, err := d.Client.Role.Query().
		Where(role.Code(RoleCodeAdmin)).
		Only(ctx)
	if err != nil {
		return fmt.Errorf("failed to get admin role: %w", err)
	}

	// 检查是否已存在拥有管理员角色的用户
	exists, err := d.Client.User.Query().
		Where(user.HasRolesWith(role.Code(RoleCodeAdmin))).
		Exist(ctx)
	if err != nil {
		return fmt.Errorf("failed to check admin user: %w", err)
	}

	if exists {
		logger.InfoContext(ctx, "admin user already exists, skipping initialization")
		return nil
	}

	// 检查用户名是否已被占用
	existingUser, err := d.Client.User.Query().
		Where(user.Username(adminCfg.Username)).
		Only(ctx)
	if err != nil && !ent.IsNotFound(err) {
		return fmt.Errorf("failed to check username: %w", err)
	}

	// 如果用户已存在，只需分配角色
	if existingUser != nil {
		logger.InfoContext(ctx, "user exists, adding admin role", "username", adminCfg.Username)
		_, err = existingUser.Update().
			AddRoles(adminRole).
			Save(ctx)
		if err != nil {
			return fmt.Errorf("failed to add admin role to user: %w", err)
		}
		return nil
	}

	// 创建管理员用户
	logger.InfoContext(ctx, "creating admin user", "username", adminCfg.Username)

	_, err = d.Client.User.Create().
		SetUsername(adminCfg.Username).
		SetEmail(adminCfg.Email).
		SetPasswordHash(hashPassword(adminCfg.Password)).
		SetNickname("Administrator").
		SetStatus(user.StatusActive).
		AddRoles(adminRole).
		Save(ctx)
	if err != nil {
		return fmt.Errorf("failed to create admin user: %w", err)
	}

	logger.InfoContext(ctx, "admin user created successfully")
	return nil
}

// hashPassword 简单的密码哈希（生产环境应使用 bcrypt）
func hashPassword(password string) string {
	hash := sha256.Sum256([]byte(password))
	return hex.EncodeToString(hash[:])
}

// Close 关闭数据库连接
func (d *Database) Close() error {
	if d.Client != nil {
		return d.Client.Close()
	}
	return nil
}
