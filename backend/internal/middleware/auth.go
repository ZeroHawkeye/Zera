package middleware

import (
	"context"

	"zera/gen/base/baseconnect"
	"zera/internal/auth"
	"zera/internal/handler"

	"connectrpc.com/connect"
)

// AuthInterceptor 认证拦截器（已弃用，请使用 PermissionInterceptor）
// 保留用于向后兼容
type AuthInterceptor struct {
	jwtManager *auth.JWTManager
}

// NewAuthInterceptor 创建认证拦截器
// Deprecated: 请使用 NewPermissionInterceptor
func NewAuthInterceptor(jwtManager *auth.JWTManager) *AuthInterceptor {
	return &AuthInterceptor{
		jwtManager: jwtManager,
	}
}

// 需要认证的路由
var protectedRoutes = map[string]bool{
	baseconnect.AuthServiceGetCurrentUserProcedure: true,
	baseconnect.AuthServiceLogoutProcedure:         true,
}

// WrapUnary 包装一元调用
func (i *AuthInterceptor) WrapUnary(next connect.UnaryFunc) connect.UnaryFunc {
	return func(ctx context.Context, req connect.AnyRequest) (connect.AnyResponse, error) {
		// 检查是否需要认证
		if !protectedRoutes[req.Spec().Procedure] {
			return next(ctx, req)
		}

		// 从请求头获取令牌
		token := extractToken(req.Header())
		if token == "" {
			return nil, connect.NewError(connect.CodeUnauthenticated, nil)
		}

		// 验证令牌
		claims, err := i.jwtManager.ValidateAccessToken(token)
		if err != nil {
			return nil, connect.NewError(connect.CodeUnauthenticated, nil)
		}

		// 将用户信息存入上下文
		ctx = context.WithValue(ctx, handler.ContextKeyUserID, claims.UserID)
		ctx = context.WithValue(ctx, handler.ContextKeyUsername, claims.Username)
		ctx = context.WithValue(ctx, handler.ContextKeyRoles, claims.Roles)
		ctx = context.WithValue(ctx, handler.ContextKeyPermissions, claims.Permissions)

		return next(ctx, req)
	}
}

// WrapStreamingClient 包装流式客户端
func (i *AuthInterceptor) WrapStreamingClient(next connect.StreamingClientFunc) connect.StreamingClientFunc {
	return next
}

// WrapStreamingHandler 包装流式处理器
func (i *AuthInterceptor) WrapStreamingHandler(next connect.StreamingHandlerFunc) connect.StreamingHandlerFunc {
	return next
}
