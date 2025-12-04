package middleware

import (
	"context"
	"net/http"

	"zera/internal/logger"

	"connectrpc.com/connect"
	"github.com/gin-gonic/gin"
)

const (
	// TraceIDHeader HTTP 请求头中的追踪ID字段名
	TraceIDHeader = "X-Trace-ID"
	// SpanIDHeader HTTP 请求头中的 Span ID 字段名
	SpanIDHeader = "X-Span-ID"
	// RequestIDHeader HTTP 请求头中的请求ID字段名
	RequestIDHeader = "X-Request-ID"
	// ParentSpanIDHeader 父 Span ID 请求头
	ParentSpanIDHeader = "X-Parent-Span-ID"

	// W3C Trace Context 标准头
	// TraceparentHeader W3C traceparent 头
	TraceparentHeader = "traceparent"
	// TracestateHeader W3C tracestate 头
	TracestateHeader = "tracestate"
)

// TraceInterceptor Connect RPC 追踪拦截器
// 自动为每个请求生成或传递追踪ID
type TraceInterceptor struct{}

// NewTraceInterceptor 创建追踪拦截器
func NewTraceInterceptor() *TraceInterceptor {
	return &TraceInterceptor{}
}

// WrapUnary 包装一元调用
func (i *TraceInterceptor) WrapUnary(next connect.UnaryFunc) connect.UnaryFunc {
	return func(ctx context.Context, req connect.AnyRequest) (connect.AnyResponse, error) {
		// 从请求头获取或生成追踪ID
		ctx = i.extractOrGenerateTraceContext(ctx, req.Header())

		// 执行请求
		resp, err := next(ctx, req)

		// 将追踪ID添加到响应头
		if resp != nil {
			i.addTraceHeaders(ctx, resp.Header())
		}

		return resp, err
	}
}

// WrapStreamingClient 包装流式客户端
func (i *TraceInterceptor) WrapStreamingClient(next connect.StreamingClientFunc) connect.StreamingClientFunc {
	return next
}

// WrapStreamingHandler 包装流式处理器
func (i *TraceInterceptor) WrapStreamingHandler(next connect.StreamingHandlerFunc) connect.StreamingHandlerFunc {
	return func(ctx context.Context, conn connect.StreamingHandlerConn) error {
		// 从请求头获取或生成追踪ID
		ctx = i.extractOrGenerateTraceContext(ctx, conn.RequestHeader())

		// 将追踪ID添加到响应头
		i.addTraceHeaders(ctx, conn.ResponseHeader())

		return next(ctx, conn)
	}
}

// extractOrGenerateTraceContext 从请求头提取或生成追踪上下文
func (i *TraceInterceptor) extractOrGenerateTraceContext(ctx context.Context, header http.Header) context.Context {
	// 尝试从 W3C traceparent 头提取（优先级最高）
	if traceparent := header.Get(TraceparentHeader); traceparent != "" {
		traceID, spanID := parseTraceparent(traceparent)
		if traceID != "" {
			ctx = logger.WithTraceID(ctx, traceID)
			if spanID != "" {
				// 当前请求的 span 是新的，原来的 span 成为父 span
				ctx = context.WithValue(ctx, logger.SpanIDKey, logger.GenerateSpanID())
			}
			return ctx
		}
	}

	// 尝试从自定义头提取
	traceID := header.Get(TraceIDHeader)
	if traceID == "" {
		traceID = header.Get(RequestIDHeader) // 兼容 X-Request-ID
	}
	if traceID == "" {
		// 生成新的追踪ID
		traceID = logger.GenerateTraceID()
	}

	ctx = logger.WithTraceID(ctx, traceID)

	// 生成 Span ID
	spanID := header.Get(SpanIDHeader)
	if spanID == "" {
		spanID = logger.GenerateSpanID()
	}
	ctx = logger.WithSpanID(ctx, spanID)

	// 请求ID（如果不同于追踪ID）
	requestID := header.Get(RequestIDHeader)
	if requestID != "" && requestID != traceID {
		ctx = logger.WithRequestID(ctx, requestID)
	}

	return ctx
}

// addTraceHeaders 将追踪信息添加到响应头
func (i *TraceInterceptor) addTraceHeaders(ctx context.Context, header http.Header) {
	if traceID := logger.GetTraceID(ctx); traceID != "" {
		header.Set(TraceIDHeader, traceID)
	}
	if spanID := logger.GetSpanID(ctx); spanID != "" {
		header.Set(SpanIDHeader, spanID)
	}
	if requestID := logger.GetRequestID(ctx); requestID != "" {
		header.Set(RequestIDHeader, requestID)
	}
}

// parseTraceparent 解析 W3C traceparent 头
// 格式: version-trace_id-parent_id-trace_flags
// 例如: 00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01
func parseTraceparent(traceparent string) (traceID, spanID string) {
	if len(traceparent) < 55 {
		return "", ""
	}

	// 简单解析，不做完整验证
	parts := make([]string, 0, 4)
	start := 0
	for i := 0; i < len(traceparent); i++ {
		if traceparent[i] == '-' {
			parts = append(parts, traceparent[start:i])
			start = i + 1
		}
	}
	parts = append(parts, traceparent[start:])

	if len(parts) != 4 {
		return "", ""
	}

	return parts[1], parts[2]
}

// TraceMiddleware Gin 框架的追踪中间件
func TraceMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// 从请求头获取或生成追踪ID
		traceID := c.GetHeader(TraceIDHeader)
		if traceID == "" {
			traceID = c.GetHeader(RequestIDHeader)
		}
		if traceID == "" {
			// 尝试解析 W3C traceparent
			if traceparent := c.GetHeader(TraceparentHeader); traceparent != "" {
				traceID, _ = parseTraceparent(traceparent)
			}
		}
		if traceID == "" {
			traceID = logger.GenerateTraceID()
		}

		// 生成 Span ID
		spanID := c.GetHeader(SpanIDHeader)
		if spanID == "" {
			spanID = logger.GenerateSpanID()
		}

		// 将追踪信息添加到上下文
		ctx := c.Request.Context()
		ctx = logger.WithTraceID(ctx, traceID)
		ctx = logger.WithSpanID(ctx, spanID)

		// 请求ID
		requestID := c.GetHeader(RequestIDHeader)
		if requestID != "" && requestID != traceID {
			ctx = logger.WithRequestID(ctx, requestID)
		}

		// 更新请求上下文
		c.Request = c.Request.WithContext(ctx)

		// 设置响应头
		c.Header(TraceIDHeader, traceID)
		c.Header(SpanIDHeader, spanID)

		// 继续处理请求
		c.Next()
	}
}

// LoggingMiddleware Gin 框架的日志中间件
// 记录每个请求的详细信息
func LoggingMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// 记录请求开始
		ctx := c.Request.Context()
		path := c.Request.URL.Path
		method := c.Request.Method

		logger.InfoContext(ctx, "request started",
			"method", method,
			"path", path,
			"client_ip", c.ClientIP(),
			"user_agent", c.Request.UserAgent(),
		)

		// 处理请求
		c.Next()

		// 记录请求结束
		status := c.Writer.Status()
		if status >= 500 {
			logger.ErrorContext(ctx, "request completed",
				"method", method,
				"path", path,
				"status", status,
				"client_ip", c.ClientIP(),
			)
		} else if status >= 400 {
			logger.WarnContext(ctx, "request completed",
				"method", method,
				"path", path,
				"status", status,
				"client_ip", c.ClientIP(),
			)
		} else {
			logger.InfoContext(ctx, "request completed",
				"method", method,
				"path", path,
				"status", status,
				"client_ip", c.ClientIP(),
			)
		}
	}
}
