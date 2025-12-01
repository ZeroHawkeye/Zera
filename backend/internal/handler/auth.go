package handler

import (
	"context"
	"errors"
	"log"
	"strings"

	"zera/gen/base"
	"zera/gen/base/baseconnect"
	"zera/internal/auth"
	"zera/internal/service"

	"buf.build/go/protovalidate"
	"connectrpc.com/connect"
)

// ContextKey 上下文键类型
type ContextKey string

const (
	// ContextKeyUserID 用户ID上下文键
	ContextKeyUserID ContextKey = "user_id"
	// ContextKeyUsername 用户名上下文键
	ContextKeyUsername ContextKey = "username"
	// ContextKeyRoles 角色列表上下文键
	ContextKeyRoles ContextKey = "roles"
	// ContextKeyPermissions 权限列表上下文键
	ContextKeyPermissions ContextKey = "permissions"
)

// AuthHandler 认证处理器
type AuthHandler struct {
	baseconnect.UnimplementedAuthServiceHandler
	validator   protovalidate.Validator
	authService *service.AuthService
	jwtManager  *auth.JWTManager
}

// NewAuthHandler 创建认证处理器
func NewAuthHandler(
	validator protovalidate.Validator,
	authService *service.AuthService,
	jwtManager *auth.JWTManager,
) *AuthHandler {
	return &AuthHandler{
		validator:   validator,
		authService: authService,
		jwtManager:  jwtManager,
	}
}

// Login 用户登录
func (h *AuthHandler) Login(
	ctx context.Context,
	req *connect.Request[base.LoginRequest],
) (*connect.Response[base.LoginResponse], error) {
	// 验证请求
	if err := h.validator.Validate(req.Msg); err != nil {
		return nil, connect.NewError(connect.CodeInvalidArgument, err)
	}

	log.Printf("Login attempt for user: %s", req.Msg.Username)

	// 调用服务层
	resp, err := h.authService.Login(ctx, req.Msg.Username, req.Msg.Password)
	if err != nil {
		if errors.Is(err, service.ErrInvalidCredentials) {
			return nil, connect.NewError(connect.CodeUnauthenticated, errors.New("用户名或密码错误"))
		}
		if errors.Is(err, service.ErrUserInactive) {
			return nil, connect.NewError(connect.CodePermissionDenied, errors.New("用户已被禁用"))
		}
		log.Printf("Login error: %v", err)
		return nil, connect.NewError(connect.CodeInternal, errors.New("登录失败"))
	}

	log.Printf("User %s logged in successfully", req.Msg.Username)

	return connect.NewResponse(resp), nil
}

// Logout 用户登出
func (h *AuthHandler) Logout(
	ctx context.Context,
	req *connect.Request[base.LogoutRequest],
) (*connect.Response[base.LogoutResponse], error) {
	token := req.Msg.AccessToken
	if token == "" {
		// 尝试从 Header 获取令牌
		token = extractTokenFromHeader(req.Header().Get("Authorization"))
	}

	if token == "" {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("缺少访问令牌"))
	}

	success, err := h.authService.Logout(ctx, token)
	if err != nil {
		if errors.Is(err, service.ErrInvalidToken) {
			return nil, connect.NewError(connect.CodeUnauthenticated, errors.New("无效的令牌"))
		}
		return nil, connect.NewError(connect.CodeInternal, errors.New("登出失败"))
	}

	return connect.NewResponse(&base.LogoutResponse{
		Success: success,
	}), nil
}

// RefreshToken 刷新令牌
func (h *AuthHandler) RefreshToken(
	ctx context.Context,
	req *connect.Request[base.RefreshTokenRequest],
) (*connect.Response[base.RefreshTokenResponse], error) {
	// 验证请求
	if err := h.validator.Validate(req.Msg); err != nil {
		return nil, connect.NewError(connect.CodeInvalidArgument, err)
	}

	resp, err := h.authService.RefreshToken(ctx, req.Msg.RefreshToken)
	if err != nil {
		if errors.Is(err, service.ErrInvalidToken) {
			return nil, connect.NewError(connect.CodeUnauthenticated, errors.New("无效的刷新令牌"))
		}
		if errors.Is(err, service.ErrUserNotFound) {
			return nil, connect.NewError(connect.CodeNotFound, errors.New("用户不存在"))
		}
		if errors.Is(err, service.ErrUserInactive) {
			return nil, connect.NewError(connect.CodePermissionDenied, errors.New("用户已被禁用"))
		}
		return nil, connect.NewError(connect.CodeInternal, errors.New("刷新令牌失败"))
	}

	return connect.NewResponse(resp), nil
}

// GetCurrentUser 获取当前用户信息
func (h *AuthHandler) GetCurrentUser(
	ctx context.Context,
	req *connect.Request[base.GetCurrentUserRequest],
) (*connect.Response[base.GetCurrentUserResponse], error) {
	// 从上下文获取用户ID
	userID, ok := ctx.Value(ContextKeyUserID).(int)
	if !ok {
		return nil, connect.NewError(connect.CodeUnauthenticated, errors.New("未登录"))
	}

	userInfo, err := h.authService.GetCurrentUser(ctx, userID)
	if err != nil {
		if errors.Is(err, service.ErrUserNotFound) {
			return nil, connect.NewError(connect.CodeNotFound, errors.New("用户不存在"))
		}
		return nil, connect.NewError(connect.CodeInternal, errors.New("获取用户信息失败"))
	}

	return connect.NewResponse(&base.GetCurrentUserResponse{
		User: userInfo,
	}), nil
}

// extractTokenFromHeader 从 Authorization 头提取令牌
func extractTokenFromHeader(authHeader string) string {
	if authHeader == "" {
		return ""
	}

	parts := strings.SplitN(authHeader, " ", 2)
	if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
		return ""
	}

	return parts[1]
}
