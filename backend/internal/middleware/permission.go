package middleware

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strings"

	"zera/internal/auth"
	"zera/internal/handler"
	"zera/internal/permission"

	"connectrpc.com/connect"
)

// PermissionInterceptor 权限拦截器
// 统一处理认证和权限验证
type PermissionInterceptor struct {
	jwtManager        *auth.JWTManager
	permissionChecker *permission.Checker
}

// NewPermissionInterceptor 创建权限拦截器
func NewPermissionInterceptor(
	jwtManager *auth.JWTManager,
	checker *permission.Checker,
) *PermissionInterceptor {
	return &PermissionInterceptor{
		jwtManager:        jwtManager,
		permissionChecker: checker,
	}
}

// WrapUnary 包装一元调用
func (i *PermissionInterceptor) WrapUnary(next connect.UnaryFunc) connect.UnaryFunc {
	return func(ctx context.Context, req connect.AnyRequest) (connect.AnyResponse, error) {
		procedure := req.Spec().Procedure

		// 1. 获取权限定义
		apiPerm := permission.GetByProcedure(procedure)

		// 2. 未注册的 API 默认拒绝访问
		if apiPerm == nil {
			return nil, connect.NewError(
				connect.CodePermissionDenied,
				fmt.Errorf("未知的 API: %s", procedure),
			)
		}

		// 3. 公开 API，直接放行
		if apiPerm.IsPublic {
			return next(ctx, req)
		}

		// 4. 需要认证的 API
		if apiPerm.RequireAuth {
			// 从请求头获取令牌
			token := extractToken(req.Header())
			if token == "" {
				return nil, connect.NewError(
					connect.CodeUnauthenticated,
					errors.New("未提供认证令牌"),
				)
			}

			// 验证令牌
			claims, err := i.jwtManager.ValidateAccessToken(token)
			if err != nil {
				return nil, connect.NewError(
					connect.CodeUnauthenticated,
					errors.New("无效的认证令牌"),
				)
			}

			// 将用户信息存入上下文
			ctx = context.WithValue(ctx, handler.ContextKeyUserID, claims.UserID)
			ctx = context.WithValue(ctx, handler.ContextKeyUsername, claims.Username)
			ctx = context.WithValue(ctx, handler.ContextKeyRoles, claims.Roles)
			ctx = context.WithValue(ctx, handler.ContextKeyPermissions, claims.Permissions)

			// 5. 检查具体权限
			if apiPerm.Code != "" {
				// 管理员拥有所有权限
				if containsRole(claims.Roles, "admin") {
					return next(ctx, req)
				}

				// 检查用户是否拥有所需权限
				if !containsPermission(claims.Permissions, apiPerm.Code) {
					return nil, connect.NewError(
						connect.CodePermissionDenied,
						fmt.Errorf("缺少权限: %s (%s)", apiPerm.Name, apiPerm.Code),
					)
				}
			}
		}

		return next(ctx, req)
	}
}

// WrapStreamingClient 包装流式客户端
func (i *PermissionInterceptor) WrapStreamingClient(next connect.StreamingClientFunc) connect.StreamingClientFunc {
	return next
}

// WrapStreamingHandler 包装流式处理器
func (i *PermissionInterceptor) WrapStreamingHandler(next connect.StreamingHandlerFunc) connect.StreamingHandlerFunc {
	return func(ctx context.Context, conn connect.StreamingHandlerConn) error {
		procedure := conn.Spec().Procedure

		// 获取权限定义
		apiPerm := permission.GetByProcedure(procedure)

		// 未注册的 API 默认拒绝访问
		if apiPerm == nil {
			return connect.NewError(
				connect.CodePermissionDenied,
				fmt.Errorf("未知的 API: %s", procedure),
			)
		}

		// 公开 API，直接放行
		if apiPerm.IsPublic {
			return next(ctx, conn)
		}

		// 需要认证的 API
		if apiPerm.RequireAuth {
			token := extractToken(conn.RequestHeader())
			if token == "" {
				return connect.NewError(
					connect.CodeUnauthenticated,
					errors.New("未提供认证令牌"),
				)
			}

			claims, err := i.jwtManager.ValidateAccessToken(token)
			if err != nil {
				return connect.NewError(
					connect.CodeUnauthenticated,
					errors.New("无效的认证令牌"),
				)
			}

			ctx = context.WithValue(ctx, handler.ContextKeyUserID, claims.UserID)
			ctx = context.WithValue(ctx, handler.ContextKeyUsername, claims.Username)
			ctx = context.WithValue(ctx, handler.ContextKeyRoles, claims.Roles)
			ctx = context.WithValue(ctx, handler.ContextKeyPermissions, claims.Permissions)

			// 检查权限
			if apiPerm.Code != "" {
				if !containsRole(claims.Roles, "admin") && !containsPermission(claims.Permissions, apiPerm.Code) {
					return connect.NewError(
						connect.CodePermissionDenied,
						fmt.Errorf("缺少权限: %s", apiPerm.Code),
					)
				}
			}
		}

		return next(ctx, conn)
	}
}

// extractToken 从请求头提取令牌
func extractToken(header http.Header) string {
	authHeader := header.Get("Authorization")
	if authHeader == "" {
		return ""
	}

	parts := strings.SplitN(authHeader, " ", 2)
	if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
		return ""
	}

	return parts[1]
}

// containsPermission 检查权限列表中是否包含指定权限
func containsPermission(permissions []string, target string) bool {
	for _, p := range permissions {
		// 支持通配符权限
		if p == "*" || p == target {
			return true
		}
		// 支持资源级通配符，如 user:* 匹配所有 user 相关权限
		if strings.HasSuffix(p, ":*") {
			prefix := strings.TrimSuffix(p, "*")
			if strings.HasPrefix(target, prefix) {
				return true
			}
		}
	}
	return false
}

// containsRole 检查角色列表中是否包含指定角色
func containsRole(roles []string, target string) bool {
	for _, r := range roles {
		if r == target {
			return true
		}
	}
	return false
}
