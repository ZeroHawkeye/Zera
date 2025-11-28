package handler

import (
	"context"
	"errors"
	"strconv"

	"zera/gen/base"
	"zera/gen/base/baseconnect"
	"zera/internal/service"

	"buf.build/go/protovalidate"
	"connectrpc.com/connect"
)

// RoleHandler 角色管理处理器
type RoleHandler struct {
	baseconnect.UnimplementedRoleServiceHandler
	validator   protovalidate.Validator
	roleService *service.RoleService
}

// NewRoleHandler 创建角色管理处理器
func NewRoleHandler(
	validator protovalidate.Validator,
	roleService *service.RoleService,
) *RoleHandler {
	return &RoleHandler{
		validator:   validator,
		roleService: roleService,
	}
}

// ListRoles 获取角色列表
func (h *RoleHandler) ListRoles(
	ctx context.Context,
	req *connect.Request[base.ListRolesRequest],
) (*connect.Response[base.ListRolesResponse], error) {
	// 验证请求
	if err := h.validator.Validate(req.Msg); err != nil {
		return nil, connect.NewError(connect.CodeInvalidArgument, err)
	}

	resp, err := h.roleService.ListRoles(ctx, req.Msg)
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, errors.New("获取角色列表失败"))
	}

	return connect.NewResponse(resp), nil
}

// GetRole 获取角色详情
func (h *RoleHandler) GetRole(
	ctx context.Context,
	req *connect.Request[base.GetRoleRequest],
) (*connect.Response[base.GetRoleResponse], error) {
	// 验证请求
	if err := h.validator.Validate(req.Msg); err != nil {
		return nil, connect.NewError(connect.CodeInvalidArgument, err)
	}

	id, err := strconv.Atoi(req.Msg.Id)
	if err != nil {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("无效的角色ID"))
	}

	resp, err := h.roleService.GetRole(ctx, id)
	if err != nil {
		if errors.Is(err, service.ErrRoleNotFound) {
			return nil, connect.NewError(connect.CodeNotFound, errors.New("角色不存在"))
		}
		return nil, connect.NewError(connect.CodeInternal, errors.New("获取角色详情失败"))
	}

	return connect.NewResponse(resp), nil
}

// CreateRole 创建角色
func (h *RoleHandler) CreateRole(
	ctx context.Context,
	req *connect.Request[base.CreateRoleRequest],
) (*connect.Response[base.CreateRoleResponse], error) {
	// 验证请求
	if err := h.validator.Validate(req.Msg); err != nil {
		return nil, connect.NewError(connect.CodeInvalidArgument, err)
	}

	resp, err := h.roleService.CreateRole(ctx, req.Msg)
	if err != nil {
		if errors.Is(err, service.ErrRoleExists) {
			return nil, connect.NewError(connect.CodeAlreadyExists, errors.New("角色代码已存在"))
		}
		return nil, connect.NewError(connect.CodeInternal, errors.New("创建角色失败"))
	}

	return connect.NewResponse(resp), nil
}

// UpdateRole 更新角色
func (h *RoleHandler) UpdateRole(
	ctx context.Context,
	req *connect.Request[base.UpdateRoleRequest],
) (*connect.Response[base.UpdateRoleResponse], error) {
	// 验证请求
	if err := h.validator.Validate(req.Msg); err != nil {
		return nil, connect.NewError(connect.CodeInvalidArgument, err)
	}

	id, err := strconv.Atoi(req.Msg.Id)
	if err != nil {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("无效的角色ID"))
	}

	resp, err := h.roleService.UpdateRole(ctx, id, req.Msg)
	if err != nil {
		if errors.Is(err, service.ErrRoleNotFound) {
			return nil, connect.NewError(connect.CodeNotFound, errors.New("角色不存在"))
		}
		return nil, connect.NewError(connect.CodeInternal, errors.New("更新角色失败"))
	}

	return connect.NewResponse(resp), nil
}

// DeleteRole 删除角色
func (h *RoleHandler) DeleteRole(
	ctx context.Context,
	req *connect.Request[base.DeleteRoleRequest],
) (*connect.Response[base.DeleteRoleResponse], error) {
	// 验证请求
	if err := h.validator.Validate(req.Msg); err != nil {
		return nil, connect.NewError(connect.CodeInvalidArgument, err)
	}

	id, err := strconv.Atoi(req.Msg.Id)
	if err != nil {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("无效的角色ID"))
	}

	err = h.roleService.DeleteRole(ctx, id)
	if err != nil {
		if errors.Is(err, service.ErrRoleNotFound) {
			return nil, connect.NewError(connect.CodeNotFound, errors.New("角色不存在"))
		}
		if errors.Is(err, service.ErrRoleIsSystem) {
			return nil, connect.NewError(connect.CodePermissionDenied, errors.New("系统角色不可删除"))
		}
		return nil, connect.NewError(connect.CodeInternal, errors.New("删除角色失败"))
	}

	return connect.NewResponse(&base.DeleteRoleResponse{Success: true}), nil
}

// ListPermissions 获取权限列表
func (h *RoleHandler) ListPermissions(
	ctx context.Context,
	req *connect.Request[base.ListPermissionsRequest],
) (*connect.Response[base.ListPermissionsResponse], error) {
	resp, err := h.roleService.ListPermissions(ctx, req.Msg)
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, errors.New("获取权限列表失败"))
	}

	return connect.NewResponse(resp), nil
}

// GetRolePermissions 获取角色权限
func (h *RoleHandler) GetRolePermissions(
	ctx context.Context,
	req *connect.Request[base.GetRolePermissionsRequest],
) (*connect.Response[base.GetRolePermissionsResponse], error) {
	// 验证请求
	if err := h.validator.Validate(req.Msg); err != nil {
		return nil, connect.NewError(connect.CodeInvalidArgument, err)
	}

	roleID, err := strconv.Atoi(req.Msg.RoleId)
	if err != nil {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("无效的角色ID"))
	}

	resp, err := h.roleService.GetRolePermissions(ctx, roleID)
	if err != nil {
		if errors.Is(err, service.ErrRoleNotFound) {
			return nil, connect.NewError(connect.CodeNotFound, errors.New("角色不存在"))
		}
		return nil, connect.NewError(connect.CodeInternal, errors.New("获取角色权限失败"))
	}

	return connect.NewResponse(resp), nil
}

// UpdateRolePermissions 更新角色权限
func (h *RoleHandler) UpdateRolePermissions(
	ctx context.Context,
	req *connect.Request[base.UpdateRolePermissionsRequest],
) (*connect.Response[base.UpdateRolePermissionsResponse], error) {
	// 验证请求
	if err := h.validator.Validate(req.Msg); err != nil {
		return nil, connect.NewError(connect.CodeInvalidArgument, err)
	}

	roleID, err := strconv.Atoi(req.Msg.RoleId)
	if err != nil {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("无效的角色ID"))
	}

	err = h.roleService.UpdateRolePermissions(ctx, roleID, req.Msg.Permissions)
	if err != nil {
		if errors.Is(err, service.ErrRoleNotFound) {
			return nil, connect.NewError(connect.CodeNotFound, errors.New("角色不存在"))
		}
		return nil, connect.NewError(connect.CodeInternal, errors.New("更新角色权限失败"))
	}

	return connect.NewResponse(&base.UpdateRolePermissionsResponse{Success: true}), nil
}
