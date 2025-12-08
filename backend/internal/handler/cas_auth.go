package handler

import (
	"context"
	"errors"

	"zera/gen/base"
	"zera/gen/base/baseconnect"
	"zera/internal/auth"
	"zera/internal/logger"
	"zera/internal/service"

	"buf.build/go/protovalidate"
	"connectrpc.com/connect"
)

// CASAuthHandler CAS 认证处理器
type CASAuthHandler struct {
	baseconnect.UnimplementedCASAuthServiceHandler
	validator      protovalidate.Validator
	casAuthService *service.CASAuthService
	userService    *service.UserService
	jwtManager     *auth.JWTManager
}

// NewCASAuthHandler 创建 CAS 认证处理器
func NewCASAuthHandler(
	validator protovalidate.Validator,
	casAuthService *service.CASAuthService,
	userService *service.UserService,
	jwtManager *auth.JWTManager,
) *CASAuthHandler {
	return &CASAuthHandler{
		validator:      validator,
		casAuthService: casAuthService,
		userService:    userService,
		jwtManager:     jwtManager,
	}
}

// GetCASLoginURL 获取 CAS 登录 URL
func (h *CASAuthHandler) GetCASLoginURL(
	ctx context.Context,
	req *connect.Request[base.GetCASLoginURLRequest],
) (*connect.Response[base.GetCASLoginURLResponse], error) {
	logger.InfoContext(ctx, "getting CAS login URL", "redirect_url", req.Msg.RedirectUrl)

	resp, err := h.casAuthService.GetCASLoginURL(ctx, req.Msg.RedirectUrl)
	if err != nil {
		logger.ErrorContext(ctx, "failed to get CAS login URL", "error", err)
		return nil, connect.NewError(connect.CodeInternal, errors.New("获取 CAS 登录地址失败"))
	}

	return connect.NewResponse(resp), nil
}

// CASCallback CAS 回调处理
func (h *CASAuthHandler) CASCallback(
	ctx context.Context,
	req *connect.Request[base.CASCallbackRequest],
) (*connect.Response[base.CASCallbackResponse], error) {
	// 验证请求
	if err := h.validator.Validate(req.Msg); err != nil {
		return nil, connect.NewError(connect.CodeInvalidArgument, err)
	}

	logger.InfoContext(ctx, "CAS callback received", "service", req.Msg.Service)

	resp, err := h.casAuthService.CASCallback(ctx, req.Msg.Ticket, req.Msg.Service)
	if err != nil {
		if errors.Is(err, service.ErrCASNotEnabled) {
			logger.WarnContext(ctx, "CAS authentication is not enabled")
			return nil, connect.NewError(connect.CodeFailedPrecondition, errors.New("CAS 认证未启用"))
		}
		if errors.Is(err, service.ErrCASTicketInvalid) {
			logger.WarnContext(ctx, "CAS ticket validation failed", "error", err)
			return nil, connect.NewError(connect.CodeUnauthenticated, errors.New("CAS 票据验证失败，请重新登录"))
		}
		if errors.Is(err, service.ErrCASUserCreateFailed) {
			logger.ErrorContext(ctx, "failed to create CAS user", "error", err)
			return nil, connect.NewError(connect.CodeInternal, errors.New("创建用户失败，请联系管理员"))
		}
		logger.ErrorContext(ctx, "CAS callback error", "error", err)
		return nil, connect.NewError(connect.CodeInternal, errors.New("CAS 认证失败"))
	}

	if resp.IsNewUser {
		logger.InfoContext(ctx, "new CAS user created", "username", resp.User.Username)
	} else {
		logger.InfoContext(ctx, "CAS user logged in", "username", resp.User.Username)
	}

	return connect.NewResponse(resp), nil
}

// CASLogout CAS 登出
func (h *CASAuthHandler) CASLogout(
	ctx context.Context,
	req *connect.Request[base.CASLogoutRequest],
) (*connect.Response[base.CASLogoutResponse], error) {
	logger.InfoContext(ctx, "CAS logout requested")

	resp, err := h.casAuthService.CASLogout(ctx, req.Msg.AccessToken)
	if err != nil {
		logger.ErrorContext(ctx, "CAS logout error", "error", err)
		return nil, connect.NewError(connect.CodeInternal, errors.New("登出失败"))
	}

	return connect.NewResponse(resp), nil
}

// GetPublicCASSettings 获取公开的 CAS 设置
func (h *CASAuthHandler) GetPublicCASSettings(
	ctx context.Context,
	req *connect.Request[base.GetPublicCASSettingsRequest],
) (*connect.Response[base.GetPublicCASSettingsResponse], error) {
	resp, err := h.casAuthService.GetPublicCASSettings(ctx)
	if err != nil {
		logger.ErrorContext(ctx, "failed to get public CAS settings", "error", err)
		return nil, connect.NewError(connect.CodeInternal, errors.New("获取 CAS 设置失败"))
	}

	return connect.NewResponse(resp), nil
}

// GetCASConfig 获取 CAS 配置 (管理员)
func (h *CASAuthHandler) GetCASConfig(
	ctx context.Context,
	req *connect.Request[base.GetCASConfigRequest],
) (*connect.Response[base.GetCASConfigResponse], error) {
	config, err := h.casAuthService.GetCASConfig(ctx)
	if err != nil {
		logger.ErrorContext(ctx, "failed to get CAS config", "error", err)
		return nil, connect.NewError(connect.CodeInternal, errors.New("获取 CAS 配置失败"))
	}

	return connect.NewResponse(&base.GetCASConfigResponse{
		Config: service.ConvertToCASConfigProto(config),
	}), nil
}

// UpdateCASConfig 更新 CAS 配置 (管理员)
func (h *CASAuthHandler) UpdateCASConfig(
	ctx context.Context,
	req *connect.Request[base.UpdateCASConfigRequest],
) (*connect.Response[base.UpdateCASConfigResponse], error) {
	// 验证请求
	if err := h.validator.Validate(req.Msg); err != nil {
		return nil, connect.NewError(connect.CodeInvalidArgument, err)
	}

	logger.InfoContext(ctx, "updating CAS config")

	config := service.ConvertFromCASConfigProto(req.Msg.Config)
	err := h.casAuthService.UpdateCASConfig(ctx, config)
	if err != nil {
		logger.ErrorContext(ctx, "failed to update CAS config", "error", err)
		return nil, connect.NewError(connect.CodeInternal, errors.New("更新 CAS 配置失败"))
	}

	// 重新初始化 Casdoor 客户端以应用新配置
	if h.userService != nil {
		if err := h.userService.InitCasdoorClient(ctx); err != nil {
			logger.WarnContext(ctx, "failed to reinitialize casdoor client after config update", "error", err)
		} else {
			logger.InfoContext(ctx, "casdoor client reinitialized after config update",
				"sync_enabled", config.SyncToCasdoor)
		}
	}

	// 获取更新后的配置
	updatedConfig, err := h.casAuthService.GetCASConfig(ctx)
	if err != nil {
		logger.ErrorContext(ctx, "failed to get updated CAS config", "error", err)
		return nil, connect.NewError(connect.CodeInternal, errors.New("获取更新后的配置失败"))
	}

	logger.InfoContext(ctx, "CAS config updated successfully", "enabled", updatedConfig.Enabled)

	return connect.NewResponse(&base.UpdateCASConfigResponse{
		Success: true,
		Config:  service.ConvertToCASConfigProto(updatedConfig),
	}), nil
}

// TestCASConnection 测试 CAS 连接 (管理员)
func (h *CASAuthHandler) TestCASConnection(
	ctx context.Context,
	req *connect.Request[base.TestCASConnectionRequest],
) (*connect.Response[base.TestCASConnectionResponse], error) {
	logger.InfoContext(ctx, "testing CAS connection")

	var config *service.CASConfig
	if req.Msg.Config != nil {
		config = service.ConvertFromCASConfigProto(req.Msg.Config)
	}

	resp, err := h.casAuthService.TestCASConnection(ctx, config)
	if err != nil {
		logger.ErrorContext(ctx, "CAS connection test error", "error", err)
		return nil, connect.NewError(connect.CodeInternal, errors.New("测试连接失败"))
	}

	if resp.Success {
		logger.InfoContext(ctx, "CAS connection test successful", "server_version", resp.ServerVersion)
	} else {
		logger.WarnContext(ctx, "CAS connection test failed", "error", resp.ErrorMessage)
	}

	return connect.NewResponse(resp), nil
}
