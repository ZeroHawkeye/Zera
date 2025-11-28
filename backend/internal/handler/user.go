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

// UserHandler 用户管理处理器
type UserHandler struct {
	baseconnect.UnimplementedUserServiceHandler
	validator   protovalidate.Validator
	userService *service.UserService
}

// NewUserHandler 创建用户管理处理器
func NewUserHandler(
	validator protovalidate.Validator,
	userService *service.UserService,
) *UserHandler {
	return &UserHandler{
		validator:   validator,
		userService: userService,
	}
}

// ListUsers 获取用户列表
func (h *UserHandler) ListUsers(
	ctx context.Context,
	req *connect.Request[base.ListUsersRequest],
) (*connect.Response[base.ListUsersResponse], error) {
	// 验证请求
	if err := h.validator.Validate(req.Msg); err != nil {
		return nil, connect.NewError(connect.CodeInvalidArgument, err)
	}

	resp, err := h.userService.ListUsers(ctx, req.Msg)
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, errors.New("获取用户列表失败"))
	}

	return connect.NewResponse(resp), nil
}

// GetUser 获取用户详情
func (h *UserHandler) GetUser(
	ctx context.Context,
	req *connect.Request[base.GetUserRequest],
) (*connect.Response[base.GetUserResponse], error) {
	// 验证请求
	if err := h.validator.Validate(req.Msg); err != nil {
		return nil, connect.NewError(connect.CodeInvalidArgument, err)
	}

	id, err := strconv.Atoi(req.Msg.Id)
	if err != nil {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("无效的用户ID"))
	}

	resp, err := h.userService.GetUser(ctx, id)
	if err != nil {
		if errors.Is(err, service.ErrUserNotFound) {
			return nil, connect.NewError(connect.CodeNotFound, errors.New("用户不存在"))
		}
		return nil, connect.NewError(connect.CodeInternal, errors.New("获取用户详情失败"))
	}

	return connect.NewResponse(resp), nil
}

// CreateUser 创建用户
func (h *UserHandler) CreateUser(
	ctx context.Context,
	req *connect.Request[base.CreateUserRequest],
) (*connect.Response[base.CreateUserResponse], error) {
	// 验证请求
	if err := h.validator.Validate(req.Msg); err != nil {
		return nil, connect.NewError(connect.CodeInvalidArgument, err)
	}

	resp, err := h.userService.CreateUser(ctx, req.Msg)
	if err != nil {
		if errors.Is(err, service.ErrUserExists) {
			return nil, connect.NewError(connect.CodeAlreadyExists, errors.New("用户名或邮箱已存在"))
		}
		return nil, connect.NewError(connect.CodeInternal, errors.New("创建用户失败"))
	}

	return connect.NewResponse(resp), nil
}

// UpdateUser 更新用户
func (h *UserHandler) UpdateUser(
	ctx context.Context,
	req *connect.Request[base.UpdateUserRequest],
) (*connect.Response[base.UpdateUserResponse], error) {
	// 验证请求
	if err := h.validator.Validate(req.Msg); err != nil {
		return nil, connect.NewError(connect.CodeInvalidArgument, err)
	}

	id, err := strconv.Atoi(req.Msg.Id)
	if err != nil {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("无效的用户ID"))
	}

	resp, err := h.userService.UpdateUser(ctx, id, req.Msg)
	if err != nil {
		if errors.Is(err, service.ErrUserNotFound) {
			return nil, connect.NewError(connect.CodeNotFound, errors.New("用户不存在"))
		}
		if errors.Is(err, service.ErrUserExists) {
			return nil, connect.NewError(connect.CodeAlreadyExists, errors.New("邮箱已被其他用户使用"))
		}
		return nil, connect.NewError(connect.CodeInternal, errors.New("更新用户失败"))
	}

	return connect.NewResponse(resp), nil
}

// DeleteUser 删除用户
func (h *UserHandler) DeleteUser(
	ctx context.Context,
	req *connect.Request[base.DeleteUserRequest],
) (*connect.Response[base.DeleteUserResponse], error) {
	// 验证请求
	if err := h.validator.Validate(req.Msg); err != nil {
		return nil, connect.NewError(connect.CodeInvalidArgument, err)
	}

	id, err := strconv.Atoi(req.Msg.Id)
	if err != nil {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("无效的用户ID"))
	}

	err = h.userService.DeleteUser(ctx, id)
	if err != nil {
		if errors.Is(err, service.ErrUserNotFound) {
			return nil, connect.NewError(connect.CodeNotFound, errors.New("用户不存在"))
		}
		return nil, connect.NewError(connect.CodeInternal, errors.New("删除用户失败"))
	}

	return connect.NewResponse(&base.DeleteUserResponse{Success: true}), nil
}

// ResetUserPassword 重置用户密码
func (h *UserHandler) ResetUserPassword(
	ctx context.Context,
	req *connect.Request[base.ResetUserPasswordRequest],
) (*connect.Response[base.ResetUserPasswordResponse], error) {
	// 验证请求
	if err := h.validator.Validate(req.Msg); err != nil {
		return nil, connect.NewError(connect.CodeInvalidArgument, err)
	}

	id, err := strconv.Atoi(req.Msg.Id)
	if err != nil {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("无效的用户ID"))
	}

	err = h.userService.ResetPassword(ctx, id, req.Msg.NewPassword)
	if err != nil {
		if errors.Is(err, service.ErrUserNotFound) {
			return nil, connect.NewError(connect.CodeNotFound, errors.New("用户不存在"))
		}
		return nil, connect.NewError(connect.CodeInternal, errors.New("重置密码失败"))
	}

	return connect.NewResponse(&base.ResetUserPasswordResponse{Success: true}), nil
}

// BatchDeleteUsers 批量删除用户
func (h *UserHandler) BatchDeleteUsers(
	ctx context.Context,
	req *connect.Request[base.BatchDeleteUsersRequest],
) (*connect.Response[base.BatchDeleteUsersResponse], error) {
	// 验证请求
	if err := h.validator.Validate(req.Msg); err != nil {
		return nil, connect.NewError(connect.CodeInvalidArgument, err)
	}

	ids := make([]int, 0, len(req.Msg.Ids))
	for _, idStr := range req.Msg.Ids {
		id, err := strconv.Atoi(idStr)
		if err != nil {
			continue
		}
		ids = append(ids, id)
	}

	deletedCount, failedIds := h.userService.BatchDeleteUsers(ctx, ids)

	return connect.NewResponse(&base.BatchDeleteUsersResponse{
		DeletedCount: int32(deletedCount),
		FailedIds:    failedIds,
	}), nil
}

// BatchUpdateUserStatus 批量更新用户状态
func (h *UserHandler) BatchUpdateUserStatus(
	ctx context.Context,
	req *connect.Request[base.BatchUpdateUserStatusRequest],
) (*connect.Response[base.BatchUpdateUserStatusResponse], error) {
	// 验证请求
	if err := h.validator.Validate(req.Msg); err != nil {
		return nil, connect.NewError(connect.CodeInvalidArgument, err)
	}

	ids := make([]int, 0, len(req.Msg.Ids))
	for _, idStr := range req.Msg.Ids {
		id, err := strconv.Atoi(idStr)
		if err != nil {
			continue
		}
		ids = append(ids, id)
	}

	updatedCount, failedIds := h.userService.BatchUpdateStatus(ctx, ids, req.Msg.Status)

	return connect.NewResponse(&base.BatchUpdateUserStatusResponse{
		UpdatedCount: int32(updatedCount),
		FailedIds:    failedIds,
	}), nil
}
