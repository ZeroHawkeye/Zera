package middleware

import (
	"context"
	"errors"

	"zera/ent"
	"zera/internal/handler"
	"zera/internal/service"

	"connectrpc.com/connect"
)

// MaintenanceInterceptor 维护模式拦截器
type MaintenanceInterceptor struct {
	client *ent.Client
}

// NewMaintenanceInterceptor 创建维护模式拦截器
func NewMaintenanceInterceptor(client *ent.Client) *MaintenanceInterceptor {
	return &MaintenanceInterceptor{
		client: client,
	}
}

// WrapUnary 包装一元调用
func (i *MaintenanceInterceptor) WrapUnary(next connect.UnaryFunc) connect.UnaryFunc {
	return func(ctx context.Context, req connect.AnyRequest) (connect.AnyResponse, error) {
		// 检查是否处于维护模式
		settingService := service.NewSystemSettingService(i.client)
		inMaintenance, err := settingService.IsMaintenanceMode(ctx)
		if err != nil {
			// 如果获取失败，放行请求
			return next(ctx, req)
		}

		if inMaintenance {
			// 检查是否是管理员
			roles, ok := ctx.Value(handler.ContextKeyRoles).([]string)
			if ok && containsRole(roles, "admin") {
				// 管理员可以在维护模式下访问
				return next(ctx, req)
			}

			// 允许公开 API（如登录）
			// 这些在 PermissionInterceptor 之前已经处理
			// 但登录是在 PermissionInterceptor 中处理的，所以这里需要特殊处理
			procedure := req.Spec().Procedure
			if isAllowedDuringMaintenance(procedure) {
				return next(ctx, req)
			}

			return nil, connect.NewError(
				connect.CodeUnavailable,
				errors.New("系统正在维护中，请稍后再试"),
			)
		}

		return next(ctx, req)
	}
}

// WrapStreamingClient 包装流式客户端
func (i *MaintenanceInterceptor) WrapStreamingClient(next connect.StreamingClientFunc) connect.StreamingClientFunc {
	return next
}

// WrapStreamingHandler 包装流式处理器
func (i *MaintenanceInterceptor) WrapStreamingHandler(next connect.StreamingHandlerFunc) connect.StreamingHandlerFunc {
	return func(ctx context.Context, conn connect.StreamingHandlerConn) error {
		settingService := service.NewSystemSettingService(i.client)
		inMaintenance, err := settingService.IsMaintenanceMode(ctx)
		if err != nil {
			return next(ctx, conn)
		}

		if inMaintenance {
			roles, ok := ctx.Value(handler.ContextKeyRoles).([]string)
			if ok && containsRole(roles, "admin") {
				return next(ctx, conn)
			}

			procedure := conn.Spec().Procedure
			if isAllowedDuringMaintenance(procedure) {
				return next(ctx, conn)
			}

			return connect.NewError(
				connect.CodeUnavailable,
				errors.New("系统正在维护中，请稍后再试"),
			)
		}

		return next(ctx, conn)
	}
}

// isAllowedDuringMaintenance 检查是否在维护模式下允许访问
func isAllowedDuringMaintenance(procedure string) bool {
	// 允许登录、注册、公开设置等接口
	allowedProcedures := map[string]bool{
		"/base.AuthService/Login":                      true,
		"/base.AuthService/Register":                   true,
		"/base.AuthService/Logout":                     true,
		"/base.AuthService/RefreshToken":               true,
		"/base.SystemSettingService/GetPublicSettings": true,
	}
	return allowedProcedures[procedure]
}
