package middleware

import (
	"context"
	"time"

	"zera/internal/logger"

	"connectrpc.com/connect"
)

// LoggingInterceptor Connect RPC 日志拦截器
// 记录每个 RPC 调用的详细信息
type LoggingInterceptor struct{}

// NewLoggingInterceptor 创建日志拦截器
func NewLoggingInterceptor() *LoggingInterceptor {
	return &LoggingInterceptor{}
}

// WrapUnary 包装一元调用
func (i *LoggingInterceptor) WrapUnary(next connect.UnaryFunc) connect.UnaryFunc {
	return func(ctx context.Context, req connect.AnyRequest) (connect.AnyResponse, error) {
		startTime := time.Now()
		procedure := req.Spec().Procedure

		// 记录请求开始
		logger.DebugContext(ctx, "rpc call started",
			"procedure", procedure,
			"protocol", req.Spec().StreamType.String(),
		)

		// 执行请求
		resp, err := next(ctx, req)

		// 计算耗时
		duration := time.Since(startTime)

		// 记录请求结束
		if err != nil {
			logger.ErrorContext(ctx, "rpc call failed",
				"procedure", procedure,
				"duration_ms", duration.Milliseconds(),
				"error", err,
			)
		} else {
			logger.InfoContext(ctx, "rpc call completed",
				"procedure", procedure,
				"duration_ms", duration.Milliseconds(),
			)
		}

		return resp, err
	}
}

// WrapStreamingClient 包装流式客户端
func (i *LoggingInterceptor) WrapStreamingClient(next connect.StreamingClientFunc) connect.StreamingClientFunc {
	return next
}

// WrapStreamingHandler 包装流式处理器
func (i *LoggingInterceptor) WrapStreamingHandler(next connect.StreamingHandlerFunc) connect.StreamingHandlerFunc {
	return func(ctx context.Context, conn connect.StreamingHandlerConn) error {
		startTime := time.Now()
		procedure := conn.Spec().Procedure

		// 记录请求开始
		logger.DebugContext(ctx, "streaming rpc started",
			"procedure", procedure,
		)

		// 执行请求
		err := next(ctx, conn)

		// 计算耗时
		duration := time.Since(startTime)

		// 记录请求结束
		if err != nil {
			logger.ErrorContext(ctx, "streaming rpc failed",
				"procedure", procedure,
				"duration_ms", duration.Milliseconds(),
				"error", err,
			)
		} else {
			logger.InfoContext(ctx, "streaming rpc completed",
				"procedure", procedure,
				"duration_ms", duration.Milliseconds(),
			)
		}

		return err
	}
}
