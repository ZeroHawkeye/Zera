package handler

import (
	"context"
	"errors"

	"zera/gen/base"
	"zera/gen/base/baseconnect"
	"zera/internal/service"

	"buf.build/go/protovalidate"
	"connectrpc.com/connect"
)

// SystemSettingHandler 系统设置处理器
type SystemSettingHandler struct {
	baseconnect.UnimplementedSystemSettingServiceHandler
	validator      protovalidate.Validator
	settingService *service.SystemSettingService
}

// NewSystemSettingHandler 创建系统设置处理器
func NewSystemSettingHandler(
	validator protovalidate.Validator,
	settingService *service.SystemSettingService,
) *SystemSettingHandler {
	return &SystemSettingHandler{
		validator:      validator,
		settingService: settingService,
	}
}

// GetSystemSettings 获取系统设置
func (h *SystemSettingHandler) GetSystemSettings(
	ctx context.Context,
	req *connect.Request[base.GetSystemSettingsRequest],
) (*connect.Response[base.GetSystemSettingsResponse], error) {
	resp, err := h.settingService.GetAllSettings(ctx)
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, errors.New("获取系统设置失败"))
	}

	return connect.NewResponse(resp), nil
}

// UpdateSystemSettings 更新系统设置
func (h *SystemSettingHandler) UpdateSystemSettings(
	ctx context.Context,
	req *connect.Request[base.UpdateSystemSettingsRequest],
) (*connect.Response[base.UpdateSystemSettingsResponse], error) {
	// 验证请求
	if err := h.validator.Validate(req.Msg); err != nil {
		return nil, connect.NewError(connect.CodeInvalidArgument, err)
	}

	if req.Msg.Settings == nil {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("设置不能为空"))
	}

	resp, err := h.settingService.UpdateSettings(ctx, req.Msg.Settings)
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, errors.New("更新系统设置失败"))
	}

	return connect.NewResponse(resp), nil
}

// GetPublicSettings 获取公开设置（无需认证）
func (h *SystemSettingHandler) GetPublicSettings(
	ctx context.Context,
	req *connect.Request[base.GetPublicSettingsRequest],
) (*connect.Response[base.GetPublicSettingsResponse], error) {
	resp, err := h.settingService.GetPublicSettings(ctx)
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, errors.New("获取公开设置失败"))
	}

	return connect.NewResponse(resp), nil
}
