package permission

import (
	"context"

	"zera/ent"
	"zera/ent/permission"
	"zera/ent/role"
	"zera/ent/user"
)

// Checker 权限检查器 - 用于运行时检查用户权限
type Checker struct {
	client *ent.Client
}

// NewChecker 创建权限检查器
func NewChecker(client *ent.Client) *Checker {
	return &Checker{client: client}
}

// HasPermission 检查用户是否拥有指定权限
// 通过用户的角色间接获取权限
func (c *Checker) HasPermission(ctx context.Context, userID int, permissionCode string) (bool, error) {
	if permissionCode == "" {
		return true, nil
	}

	// 查询用户是否通过任意角色拥有该权限
	exists, err := c.client.User.
		Query().
		Where(user.ID(userID)).
		QueryRoles().
		QueryPermissions().
		Where(permission.Code(permissionCode)).
		Exist(ctx)

	return exists, err
}

// HasAnyPermission 检查用户是否拥有任意一个指定权限
func (c *Checker) HasAnyPermission(ctx context.Context, userID int, permissionCodes []string) (bool, error) {
	if len(permissionCodes) == 0 {
		return true, nil
	}

	exists, err := c.client.User.
		Query().
		Where(user.ID(userID)).
		QueryRoles().
		QueryPermissions().
		Where(permission.CodeIn(permissionCodes...)).
		Exist(ctx)

	return exists, err
}

// HasAllPermissions 检查用户是否拥有所有指定权限
func (c *Checker) HasAllPermissions(ctx context.Context, userID int, permissionCodes []string) (bool, error) {
	if len(permissionCodes) == 0 {
		return true, nil
	}

	for _, code := range permissionCodes {
		has, err := c.HasPermission(ctx, userID, code)
		if err != nil {
			return false, err
		}
		if !has {
			return false, nil
		}
	}
	return true, nil
}

// GetUserPermissions 获取用户的所有权限代码
func (c *Checker) GetUserPermissions(ctx context.Context, userID int) ([]string, error) {
	permissions, err := c.client.User.
		Query().
		Where(user.ID(userID)).
		QueryRoles().
		QueryPermissions().
		All(ctx)

	if err != nil {
		return nil, err
	}

	// 去重
	seen := make(map[string]bool)
	var result []string
	for _, p := range permissions {
		if !seen[p.Code] {
			seen[p.Code] = true
			result = append(result, p.Code)
		}
	}

	return result, nil
}

// GetUserRoles 获取用户的所有角色代码
func (c *Checker) GetUserRoles(ctx context.Context, userID int) ([]string, error) {
	roles, err := c.client.User.
		Query().
		Where(user.ID(userID)).
		QueryRoles().
		All(ctx)

	if err != nil {
		return nil, err
	}

	result := make([]string, 0, len(roles))
	for _, r := range roles {
		result = append(result, r.Code)
	}

	return result, nil
}

// IsAdmin 检查用户是否为管理员
func (c *Checker) IsAdmin(ctx context.Context, userID int) (bool, error) {
	return c.client.User.
		Query().
		Where(user.ID(userID)).
		QueryRoles().
		Where(role.Code("admin")).
		Exist(ctx)
}

// GetRolePermissions 获取角色的所有权限代码
func (c *Checker) GetRolePermissions(ctx context.Context, roleID int) ([]string, error) {
	permissions, err := c.client.Role.
		Query().
		Where(role.ID(roleID)).
		QueryPermissions().
		All(ctx)

	if err != nil {
		return nil, err
	}

	result := make([]string, 0, len(permissions))
	for _, p := range permissions {
		result = append(result, p.Code)
	}

	return result, nil
}
