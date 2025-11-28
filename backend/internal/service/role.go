package service

import (
	"context"
	"errors"
	"strconv"
	"time"

	"zera/ent"
	"zera/ent/permission"
	"zera/ent/role"
	"zera/gen/base"
)

var (
	// ErrRoleNotFound 角色不存在
	ErrRoleNotFound = errors.New("role not found")
	// ErrRoleExists 角色已存在
	ErrRoleExists = errors.New("role already exists")
	// ErrRoleIsSystem 系统角色不可删除
	ErrRoleIsSystem = errors.New("system role cannot be deleted")
)

// RoleService 角色管理服务
type RoleService struct {
	client *ent.Client
}

// NewRoleService 创建角色管理服务
func NewRoleService(client *ent.Client) *RoleService {
	return &RoleService{
		client: client,
	}
}

// ListRoles 获取角色列表
func (s *RoleService) ListRoles(ctx context.Context, req *base.ListRolesRequest) (*base.ListRolesResponse, error) {
	query := s.client.Role.Query().
		WithPermissions().
		WithUsers()

	// 搜索条件
	if req.Keyword != "" {
		query = query.Where(
			role.Or(
				role.NameContains(req.Keyword),
				role.CodeContains(req.Keyword),
			),
		)
	}

	// 系统角色筛选
	if req.IsSystem != nil {
		query = query.Where(role.IsSystem(*req.IsSystem))
	}

	// 获取总数
	total, err := query.Clone().Count(ctx)
	if err != nil {
		return nil, err
	}

	// 排序
	query = query.Order(ent.Asc(role.FieldSortOrder), ent.Asc(role.FieldID))

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
	roles, err := query.Offset(offset).Limit(pageSize).All(ctx)
	if err != nil {
		return nil, err
	}

	// 转换为响应
	roleInfos := make([]*base.RoleInfo, 0, len(roles))
	for _, r := range roles {
		roleInfos = append(roleInfos, s.toRoleInfo(r))
	}

	return &base.ListRolesResponse{
		Roles:    roleInfos,
		Total:    int64(total),
		Page:     int32(page),
		PageSize: int32(pageSize),
	}, nil
}

// GetRole 获取角色详情
func (s *RoleService) GetRole(ctx context.Context, id int) (*base.GetRoleResponse, error) {
	r, err := s.client.Role.Query().
		Where(role.ID(id)).
		WithPermissions().
		WithUsers().
		Only(ctx)
	if err != nil {
		if ent.IsNotFound(err) {
			return nil, ErrRoleNotFound
		}
		return nil, err
	}

	return &base.GetRoleResponse{
		Role: s.toRoleInfo(r),
	}, nil
}

// CreateRole 创建角色
func (s *RoleService) CreateRole(ctx context.Context, req *base.CreateRoleRequest) (*base.CreateRoleResponse, error) {
	// 检查角色代码是否已存在
	exists, err := s.client.Role.Query().Where(role.Code(req.Code)).Exist(ctx)
	if err != nil {
		return nil, err
	}
	if exists {
		return nil, ErrRoleExists
	}

	// 创建角色
	create := s.client.Role.Create().
		SetCode(req.Code).
		SetName(req.Name).
		SetDescription(req.Description).
		SetSortOrder(int(req.SortOrder))

	r, err := create.Save(ctx)
	if err != nil {
		return nil, err
	}

	// 分配权限
	if len(req.Permissions) > 0 {
		permissions, err := s.client.Permission.Query().
			Where(permission.CodeIn(req.Permissions...)).
			All(ctx)
		if err != nil {
			return nil, err
		}
		if len(permissions) > 0 {
			_, err = r.Update().AddPermissions(permissions...).Save(ctx)
			if err != nil {
				return nil, err
			}
		}
	}

	// 重新查询以获取关联数据
	r, err = s.client.Role.Query().
		Where(role.ID(r.ID)).
		WithPermissions().
		WithUsers().
		Only(ctx)
	if err != nil {
		return nil, err
	}

	return &base.CreateRoleResponse{
		Role: s.toRoleInfo(r),
	}, nil
}

// UpdateRole 更新角色
func (s *RoleService) UpdateRole(ctx context.Context, id int, req *base.UpdateRoleRequest) (*base.UpdateRoleResponse, error) {
	r, err := s.client.Role.Query().Where(role.ID(id)).Only(ctx)
	if err != nil {
		if ent.IsNotFound(err) {
			return nil, ErrRoleNotFound
		}
		return nil, err
	}

	update := r.Update()

	if req.Name != nil {
		update = update.SetName(*req.Name)
	}
	if req.Description != nil {
		update = update.SetDescription(*req.Description)
	}
	if req.SortOrder != nil {
		update = update.SetSortOrder(int(*req.SortOrder))
	}

	_, err = update.Save(ctx)
	if err != nil {
		return nil, err
	}

	// 更新权限
	if len(req.Permissions) > 0 {
		// 清除现有权限
		_, err = r.Update().ClearPermissions().Save(ctx)
		if err != nil {
			return nil, err
		}
		// 添加新权限
		permissions, err := s.client.Permission.Query().
			Where(permission.CodeIn(req.Permissions...)).
			All(ctx)
		if err != nil {
			return nil, err
		}
		if len(permissions) > 0 {
			_, err = r.Update().AddPermissions(permissions...).Save(ctx)
			if err != nil {
				return nil, err
			}
		}
	}

	// 重新查询以获取更新后的数据
	r, err = s.client.Role.Query().
		Where(role.ID(id)).
		WithPermissions().
		WithUsers().
		Only(ctx)
	if err != nil {
		return nil, err
	}

	return &base.UpdateRoleResponse{
		Role: s.toRoleInfo(r),
	}, nil
}

// DeleteRole 删除角色
func (s *RoleService) DeleteRole(ctx context.Context, id int) error {
	r, err := s.client.Role.Query().Where(role.ID(id)).Only(ctx)
	if err != nil {
		if ent.IsNotFound(err) {
			return ErrRoleNotFound
		}
		return err
	}

	// 检查是否为系统角色
	if r.IsSystem {
		return ErrRoleIsSystem
	}

	err = s.client.Role.DeleteOneID(id).Exec(ctx)
	if err != nil {
		return err
	}

	return nil
}

// ListPermissions 获取权限列表
func (s *RoleService) ListPermissions(ctx context.Context, req *base.ListPermissionsRequest) (*base.ListPermissionsResponse, error) {
	query := s.client.Permission.Query()

	// 资源筛选
	if req.Resource != "" {
		query = query.Where(permission.Resource(req.Resource))
	}

	// 排序
	query = query.Order(ent.Asc(permission.FieldResource), ent.Asc(permission.FieldAction))

	permissions, err := query.All(ctx)
	if err != nil {
		return nil, err
	}

	// 转换为响应
	permissionInfos := make([]*base.PermissionInfo, 0, len(permissions))
	groupMap := make(map[string]*base.PermissionGroup)

	for _, p := range permissions {
		info := s.toPermissionInfo(p)
		permissionInfos = append(permissionInfos, info)

		// 分组
		if group, ok := groupMap[p.Resource]; ok {
			group.Permissions = append(group.Permissions, info)
		} else {
			groupMap[p.Resource] = &base.PermissionGroup{
				Resource:     p.Resource,
				ResourceName: s.getResourceName(p.Resource),
				Permissions:  []*base.PermissionInfo{info},
			}
		}
	}

	// 转换分组为列表
	groups := make([]*base.PermissionGroup, 0, len(groupMap))
	for _, group := range groupMap {
		groups = append(groups, group)
	}

	return &base.ListPermissionsResponse{
		Permissions: permissionInfos,
		Groups:      groups,
	}, nil
}

// GetRolePermissions 获取角色权限
func (s *RoleService) GetRolePermissions(ctx context.Context, roleID int) (*base.GetRolePermissionsResponse, error) {
	r, err := s.client.Role.Query().
		Where(role.ID(roleID)).
		WithPermissions().
		Only(ctx)
	if err != nil {
		if ent.IsNotFound(err) {
			return nil, ErrRoleNotFound
		}
		return nil, err
	}

	// 获取角色拥有的权限代码
	permCodes := make([]string, 0, len(r.Edges.Permissions))
	for _, p := range r.Edges.Permissions {
		permCodes = append(permCodes, p.Code)
	}

	// 获取所有权限分组
	allPermResp, err := s.ListPermissions(ctx, &base.ListPermissionsRequest{})
	if err != nil {
		return nil, err
	}

	return &base.GetRolePermissionsResponse{
		Permissions:         permCodes,
		AllPermissionGroups: allPermResp.Groups,
	}, nil
}

// UpdateRolePermissions 更新角色权限
func (s *RoleService) UpdateRolePermissions(ctx context.Context, roleID int, permissionCodes []string) error {
	r, err := s.client.Role.Query().Where(role.ID(roleID)).Only(ctx)
	if err != nil {
		if ent.IsNotFound(err) {
			return ErrRoleNotFound
		}
		return err
	}

	// 清除现有权限
	_, err = r.Update().ClearPermissions().Save(ctx)
	if err != nil {
		return err
	}

	// 添加新权限
	if len(permissionCodes) > 0 {
		permissions, err := s.client.Permission.Query().
			Where(permission.CodeIn(permissionCodes...)).
			All(ctx)
		if err != nil {
			return err
		}
		if len(permissions) > 0 {
			_, err = r.Update().AddPermissions(permissions...).Save(ctx)
			if err != nil {
				return err
			}
		}
	}

	return nil
}

// toRoleInfo 将 ent.Role 转换为 base.RoleInfo
func (s *RoleService) toRoleInfo(r *ent.Role) *base.RoleInfo {
	permissions := make([]string, 0, len(r.Edges.Permissions))
	for _, p := range r.Edges.Permissions {
		permissions = append(permissions, p.Code)
	}

	return &base.RoleInfo{
		Id:          strconv.Itoa(r.ID),
		Code:        r.Code,
		Name:        r.Name,
		Description: r.Description,
		IsSystem:    r.IsSystem,
		SortOrder:   int32(r.SortOrder),
		Permissions: permissions,
		UserCount:   int32(len(r.Edges.Users)),
		CreatedAt:   r.CreatedAt.Format(time.RFC3339),
		UpdatedAt:   r.UpdatedAt.Format(time.RFC3339),
	}
}

// toPermissionInfo 将 ent.Permission 转换为 base.PermissionInfo
func (s *RoleService) toPermissionInfo(p *ent.Permission) *base.PermissionInfo {
	return &base.PermissionInfo{
		Id:          strconv.Itoa(p.ID),
		Code:        p.Code,
		Name:        p.Name,
		Description: p.Description,
		Resource:    p.Resource,
		Action:      p.Action,
		CreatedAt:   p.CreatedAt.Format(time.RFC3339),
	}
}

// getResourceName 获取资源显示名称
func (s *RoleService) getResourceName(resource string) string {
	resourceNames := map[string]string{
		"user":       "用户管理",
		"role":       "角色管理",
		"permission": "权限管理",
		"article":    "文章管理",
		"system":     "系统设置",
	}
	if name, ok := resourceNames[resource]; ok {
		return name
	}
	return resource
}
