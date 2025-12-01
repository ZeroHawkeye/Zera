// Package permission 提供 API 权限注册和管理功能
package permission

import (
	"zera/gen/base/baseconnect"
)

// APIPermission 定义 API 权限元数据
type APIPermission struct {
	// Procedure API 路由路径 (如 /base.UserService/ListUsers)
	Procedure string
	// Code 权限代码 (如 user:read)
	Code string
	// Name 权限显示名称
	Name string
	// Description 权限描述
	Description string
	// Resource 资源类型 (如 user, role, permission)
	Resource string
	// Action 操作类型 (如 create, read, update, delete)
	Action string
	// RequireAuth 是否需要认证
	RequireAuth bool
	// IsPublic 是否为公开 API（无需认证和权限）
	IsPublic bool
}

// ResourceGroup 资源分组定义
type ResourceGroup struct {
	// Resource 资源代码
	Resource string
	// Name 资源显示名称
	Name string
	// Description 资源描述
	Description string
	// Icon 图标名称（用于前端显示）
	Icon string
	// Order 排序顺序
	Order int
}

// Registry 权限注册表 - 定义所有 API 的权限
var Registry = []APIPermission{
	// ============================================
	// 认证服务 - 公开 API
	// ============================================
	{
		Procedure:   baseconnect.AuthServiceLoginProcedure,
		IsPublic:    true,
		RequireAuth: false,
	},
	{
		Procedure:   baseconnect.AuthServiceRefreshTokenProcedure,
		IsPublic:    true,
		RequireAuth: false,
	},
	{
		Procedure:   baseconnect.AuthServiceLogoutProcedure,
		RequireAuth: true,
		IsPublic:    false,
		// 登出只需要认证，不需要特定权限
	},
	{
		Procedure:   baseconnect.AuthServiceGetCurrentUserProcedure,
		RequireAuth: true,
		IsPublic:    false,
		// 获取当前用户只需要认证，不需要特定权限
	},

	// ============================================
	// 用户管理服务
	// ============================================
	{
		Procedure:   baseconnect.UserServiceListUsersProcedure,
		Code:        "user:read",
		Name:        "查看用户列表",
		Description: "获取系统用户列表",
		Resource:    "user",
		Action:      "read",
		RequireAuth: true,
	},
	{
		Procedure:   baseconnect.UserServiceGetUserProcedure,
		Code:        "user:read",
		Name:        "查看用户详情",
		Description: "获取单个用户详细信息",
		Resource:    "user",
		Action:      "read",
		RequireAuth: true,
	},
	{
		Procedure:   baseconnect.UserServiceCreateUserProcedure,
		Code:        "user:create",
		Name:        "创建用户",
		Description: "创建新用户账号",
		Resource:    "user",
		Action:      "create",
		RequireAuth: true,
	},
	{
		Procedure:   baseconnect.UserServiceUpdateUserProcedure,
		Code:        "user:update",
		Name:        "编辑用户",
		Description: "修改用户信息",
		Resource:    "user",
		Action:      "update",
		RequireAuth: true,
	},
	{
		Procedure:   baseconnect.UserServiceDeleteUserProcedure,
		Code:        "user:delete",
		Name:        "删除用户",
		Description: "删除用户账号",
		Resource:    "user",
		Action:      "delete",
		RequireAuth: true,
	},
	{
		Procedure:   baseconnect.UserServiceResetUserPasswordProcedure,
		Code:        "user:reset-password",
		Name:        "重置用户密码",
		Description: "重置指定用户的密码",
		Resource:    "user",
		Action:      "reset-password",
		RequireAuth: true,
	},
	{
		Procedure:   baseconnect.UserServiceBatchDeleteUsersProcedure,
		Code:        "user:delete",
		Name:        "批量删除用户",
		Description: "批量删除多个用户账号",
		Resource:    "user",
		Action:      "delete",
		RequireAuth: true,
	},
	{
		Procedure:   baseconnect.UserServiceBatchUpdateUserStatusProcedure,
		Code:        "user:update",
		Name:        "批量更新用户状态",
		Description: "批量启用或禁用用户",
		Resource:    "user",
		Action:      "update",
		RequireAuth: true,
	},

	// ============================================
	// 角色管理服务
	// ============================================
	{
		Procedure:   baseconnect.RoleServiceListRolesProcedure,
		Code:        "role:read",
		Name:        "查看角色列表",
		Description: "获取系统角色列表",
		Resource:    "role",
		Action:      "read",
		RequireAuth: true,
	},
	{
		Procedure:   baseconnect.RoleServiceGetRoleProcedure,
		Code:        "role:read",
		Name:        "查看角色详情",
		Description: "获取单个角色详细信息",
		Resource:    "role",
		Action:      "read",
		RequireAuth: true,
	},
	{
		Procedure:   baseconnect.RoleServiceCreateRoleProcedure,
		Code:        "role:create",
		Name:        "创建角色",
		Description: "创建新角色",
		Resource:    "role",
		Action:      "create",
		RequireAuth: true,
	},
	{
		Procedure:   baseconnect.RoleServiceUpdateRoleProcedure,
		Code:        "role:update",
		Name:        "编辑角色",
		Description: "修改角色信息",
		Resource:    "role",
		Action:      "update",
		RequireAuth: true,
	},
	{
		Procedure:   baseconnect.RoleServiceDeleteRoleProcedure,
		Code:        "role:delete",
		Name:        "删除角色",
		Description: "删除角色",
		Resource:    "role",
		Action:      "delete",
		RequireAuth: true,
	},
	{
		Procedure:   baseconnect.RoleServiceListPermissionsProcedure,
		Code:        "permission:read",
		Name:        "查看权限列表",
		Description: "获取所有可分配的权限列表",
		Resource:    "permission",
		Action:      "read",
		RequireAuth: true,
	},
	{
		Procedure:   baseconnect.RoleServiceGetRolePermissionsProcedure,
		Code:        "role:read",
		Name:        "查看角色权限",
		Description: "获取角色已分配的权限",
		Resource:    "role",
		Action:      "read",
		RequireAuth: true,
	},
	{
		Procedure:   baseconnect.RoleServiceUpdateRolePermissionsProcedure,
		Code:        "role:assign",
		Name:        "分配角色权限",
		Description: "为角色分配或移除权限",
		Resource:    "role",
		Action:      "assign",
		RequireAuth: true,
	},

	// ============================================
	// 审计日志服务
	// ============================================
	{
		Procedure:   baseconnect.AuditLogServiceListAuditLogsProcedure,
		Code:        "audit_log:read",
		Name:        "查看审计日志",
		Description: "获取系统审计日志列表",
		Resource:    "audit_log",
		Action:      "read",
		RequireAuth: true,
	},
	{
		Procedure:   baseconnect.AuditLogServiceGetAuditLogProcedure,
		Code:        "audit_log:read",
		Name:        "查看日志详情",
		Description: "获取单条审计日志详情",
		Resource:    "audit_log",
		Action:      "read",
		RequireAuth: true,
	},
	{
		Procedure:   baseconnect.AuditLogServiceGetAuditLogStatsProcedure,
		Code:        "audit_log:read",
		Name:        "查看日志统计",
		Description: "获取审计日志统计信息",
		Resource:    "audit_log",
		Action:      "read",
		RequireAuth: true,
	},
	{
		Procedure:   baseconnect.AuditLogServiceListAuditLogModulesProcedure,
		Code:        "audit_log:read",
		Name:        "查看日志模块",
		Description: "获取可用的日志模块列表",
		Resource:    "audit_log",
		Action:      "read",
		RequireAuth: true,
	},
}

// ResourceGroups 资源分组定义 - 用于前端权限配置界面展示
var ResourceGroups = []ResourceGroup{
	{
		Resource:    "user",
		Name:        "用户管理",
		Description: "用户账号相关操作",
		Icon:        "UserOutlined",
		Order:       1,
	},
	{
		Resource:    "role",
		Name:        "角色管理",
		Description: "角色及权限分配",
		Icon:        "TeamOutlined",
		Order:       2,
	},
	{
		Resource:    "permission",
		Name:        "权限管理",
		Description: "系统权限配置",
		Icon:        "SafetyOutlined",
		Order:       3,
	},
	{
		Resource:    "audit_log",
		Name:        "审计日志",
		Description: "系统操作日志查看",
		Icon:        "FileTextOutlined",
		Order:       4,
	},
}

// 快速查找映射表
var (
	procedureToPermission map[string]*APIPermission
	codeToPermission      map[string]*APIPermission
	uniquePermissions     []*APIPermission
	resourceGroupMap      map[string]*ResourceGroup
)

func init() {
	initMaps()
}

// initMaps 初始化查找映射表
func initMaps() {
	procedureToPermission = make(map[string]*APIPermission)
	codeToPermission = make(map[string]*APIPermission)
	resourceGroupMap = make(map[string]*ResourceGroup)
	seen := make(map[string]bool)

	// 构建 API 权限映射
	for i := range Registry {
		p := &Registry[i]
		procedureToPermission[p.Procedure] = p

		// 去重收集唯一权限（用于同步到数据库）
		if p.Code != "" && !seen[p.Code] {
			seen[p.Code] = true
			codeToPermission[p.Code] = p
			uniquePermissions = append(uniquePermissions, p)
		}
	}

	// 构建资源分组映射
	for i := range ResourceGroups {
		g := &ResourceGroups[i]
		resourceGroupMap[g.Resource] = g
	}
}

// GetByProcedure 根据 API 路由获取权限定义
func GetByProcedure(procedure string) *APIPermission {
	return procedureToPermission[procedure]
}

// GetByCode 根据权限代码获取权限定义
func GetByCode(code string) *APIPermission {
	return codeToPermission[code]
}

// GetUniquePermissions 获取所有唯一权限（用于同步到数据库）
func GetUniquePermissions() []*APIPermission {
	return uniquePermissions
}

// GetResourceGroup 获取资源分组信息
func GetResourceGroup(resource string) *ResourceGroup {
	return resourceGroupMap[resource]
}

// GetAllResourceGroups 获取所有资源分组
func GetAllResourceGroups() []ResourceGroup {
	return ResourceGroups
}

// GetResourceName 获取资源显示名称
func GetResourceName(resource string) string {
	if g := resourceGroupMap[resource]; g != nil {
		return g.Name
	}
	return resource
}

// IsPublicAPI 判断是否为公开 API
func IsPublicAPI(procedure string) bool {
	p := procedureToPermission[procedure]
	return p != nil && p.IsPublic
}

// RequiresAuth 判断 API 是否需要认证
func RequiresAuth(procedure string) bool {
	p := procedureToPermission[procedure]
	if p == nil {
		// 未注册的 API 默认需要认证
		return true
	}
	return p.RequireAuth
}

// GetRequiredPermission 获取 API 所需的权限代码
func GetRequiredPermission(procedure string) string {
	p := procedureToPermission[procedure]
	if p == nil {
		return ""
	}
	return p.Code
}

// GetAllProcedures 获取所有已注册的 API 路由
func GetAllProcedures() []string {
	procedures := make([]string, 0, len(Registry))
	for _, p := range Registry {
		procedures = append(procedures, p.Procedure)
	}
	return procedures
}

// GetPermissionsByResource 获取指定资源的所有权限
func GetPermissionsByResource(resource string) []*APIPermission {
	var result []*APIPermission
	seen := make(map[string]bool)
	for _, p := range uniquePermissions {
		if p.Resource == resource && !seen[p.Code] {
			seen[p.Code] = true
			result = append(result, p)
		}
	}
	return result
}
