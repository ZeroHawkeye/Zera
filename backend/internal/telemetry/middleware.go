// Package telemetry 追踪中间件
package telemetry

import (
	"context"
	"time"

	"connectrpc.com/connect"
	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/propagation"
	"go.opentelemetry.io/otel/trace"
	"google.golang.org/protobuf/encoding/protojson"
	"google.golang.org/protobuf/proto"
)

const (
	// TracerName 追踪器名称
	TracerName = "zera"
)

// OtelTraceInterceptor OpenTelemetry 追踪拦截器 (Connect RPC)
type OtelTraceInterceptor struct {
	provider  *Provider
	loggerSet *LoggerSet
}

// NewOtelTraceInterceptor 创建 OpenTelemetry 追踪拦截器
func NewOtelTraceInterceptor(provider *Provider, loggerSet *LoggerSet) *OtelTraceInterceptor {
	return &OtelTraceInterceptor{
		provider:  provider,
		loggerSet: loggerSet,
	}
}

// WrapUnary 包装一元调用
func (i *OtelTraceInterceptor) WrapUnary(next connect.UnaryFunc) connect.UnaryFunc {
	return func(ctx context.Context, req connect.AnyRequest) (connect.AnyResponse, error) {
		if i.provider == nil || !i.provider.IsEnabled() {
			return next(ctx, req)
		}

		// 从请求头提取追踪上下文
		ctx = otel.GetTextMapPropagator().Extract(ctx, propagation.HeaderCarrier(req.Header()))

		tracer := otel.Tracer(TracerName)
		procedure := req.Spec().Procedure

		// 开始 span
		ctx, span := tracer.Start(ctx, procedure,
			trace.WithSpanKind(trace.SpanKindServer),
			trace.WithAttributes(
				attribute.String("rpc.system", "connect"),
				attribute.String("rpc.service", getServiceName(procedure)),
				attribute.String("rpc.method", getMethodName(procedure)),
				attribute.String("rpc.flavor", "connect"),
			),
		)
		defer span.End()

		startTime := time.Now()

		// 序列化请求体为 JSON
		reqBody := marshalProtoMessage(req.Any())

		// 执行请求
		resp, err := next(ctx, req)

		// 计算耗时
		duration := time.Since(startTime)

		// 序列化响应体为 JSON
		var respBody string
		if resp != nil {
			respBody = marshalProtoMessage(resp.Any())
		}

		// 设置 span 状态
		if err != nil {
			span.SetStatus(codes.Error, err.Error())
			span.RecordError(err)
		} else {
			span.SetStatus(codes.Ok, "")
		}

		// 记录 API 日志
		if i.loggerSet != nil {
			entry := APILogEntry{
				Method:       "POST",
				Path:         procedure,
				StatusCode:   getStatusCode(err),
				DurationMs:   duration.Milliseconds(),
				ClientIP:     getClientIP(req.Header()),
				UserAgent:    req.Header().Get("User-Agent"),
				RequestID:    span.SpanContext().TraceID().String(),
				RequestBody:  reqBody,
				ResponseBody: respBody,
			}
			if err != nil {
				entry.ErrorMessage = err.Error()
			}
			i.loggerSet.LogAPIRequest(ctx, entry)
		}

		// 将追踪上下文注入响应头
		if resp != nil {
			otel.GetTextMapPropagator().Inject(ctx, propagation.HeaderCarrier(resp.Header()))
		}

		return resp, err
	}
}

// WrapStreamingClient 包装流式客户端
func (i *OtelTraceInterceptor) WrapStreamingClient(next connect.StreamingClientFunc) connect.StreamingClientFunc {
	return next
}

// WrapStreamingHandler 包装流式处理器
func (i *OtelTraceInterceptor) WrapStreamingHandler(next connect.StreamingHandlerFunc) connect.StreamingHandlerFunc {
	return func(ctx context.Context, conn connect.StreamingHandlerConn) error {
		if i.provider == nil || !i.provider.IsEnabled() {
			return next(ctx, conn)
		}

		// 从请求头提取追踪上下文
		ctx = otel.GetTextMapPropagator().Extract(ctx, propagation.HeaderCarrier(conn.RequestHeader()))

		tracer := otel.Tracer(TracerName)
		procedure := conn.Spec().Procedure

		// 开始 span
		ctx, span := tracer.Start(ctx, procedure,
			trace.WithSpanKind(trace.SpanKindServer),
			trace.WithAttributes(
				attribute.String("rpc.system", "connect"),
				attribute.String("rpc.service", getServiceName(procedure)),
				attribute.String("rpc.method", getMethodName(procedure)),
				attribute.String("rpc.flavor", "connect"),
				attribute.Bool("rpc.streaming", true),
			),
		)
		defer span.End()

		startTime := time.Now()

		// 将追踪上下文注入响应头
		otel.GetTextMapPropagator().Inject(ctx, propagation.HeaderCarrier(conn.ResponseHeader()))

		// 执行请求
		err := next(ctx, conn)

		// 计算耗时
		duration := time.Since(startTime)

		// 设置 span 状态
		if err != nil {
			span.SetStatus(codes.Error, err.Error())
			span.RecordError(err)
		} else {
			span.SetStatus(codes.Ok, "")
		}

		// 记录 API 日志
		if i.loggerSet != nil {
			i.loggerSet.LogAPIRequest(ctx, APILogEntry{
				Method:     "POST",
				Path:       procedure,
				StatusCode: getStatusCode(err),
				DurationMs: duration.Milliseconds(),
				ClientIP:   conn.RequestHeader().Get("X-Real-IP"),
				UserAgent:  conn.RequestHeader().Get("User-Agent"),
				RequestID:  span.SpanContext().TraceID().String(),
			})
		}

		return err
	}
}

// getServiceName 从 procedure 获取服务名
func getServiceName(procedure string) string {
	// procedure 格式: /package.Service/Method
	if len(procedure) < 2 {
		return procedure
	}
	parts := splitProcedure(procedure)
	if len(parts) >= 2 {
		return parts[0]
	}
	return procedure
}

// getMethodName 从 procedure 获取方法名
func getMethodName(procedure string) string {
	parts := splitProcedure(procedure)
	if len(parts) >= 2 {
		return parts[1]
	}
	return procedure
}

// splitProcedure 分割 procedure
func splitProcedure(procedure string) []string {
	// 移除开头的 /
	if len(procedure) > 0 && procedure[0] == '/' {
		procedure = procedure[1:]
	}
	// 查找最后一个 /
	for i := len(procedure) - 1; i >= 0; i-- {
		if procedure[i] == '/' {
			return []string{procedure[:i], procedure[i+1:]}
		}
	}
	return []string{procedure}
}

// getStatusCode 根据错误获取状态码
func getStatusCode(err error) int {
	if err == nil {
		return 200
	}
	// 根据 Connect 错误类型返回对应的 HTTP 状态码
	if connectErr := new(connect.Error); err != nil {
		code := connect.CodeOf(err)
		switch code {
		case connect.CodeCanceled:
			return 499
		case connect.CodeUnknown:
			return 500
		case connect.CodeInvalidArgument:
			return 400
		case connect.CodeDeadlineExceeded:
			return 504
		case connect.CodeNotFound:
			return 404
		case connect.CodeAlreadyExists:
			return 409
		case connect.CodePermissionDenied:
			return 403
		case connect.CodeResourceExhausted:
			return 429
		case connect.CodeFailedPrecondition:
			return 400
		case connect.CodeAborted:
			return 409
		case connect.CodeOutOfRange:
			return 400
		case connect.CodeUnimplemented:
			return 501
		case connect.CodeInternal:
			return 500
		case connect.CodeUnavailable:
			return 503
		case connect.CodeDataLoss:
			return 500
		case connect.CodeUnauthenticated:
			return 401
		}
		_ = connectErr // 使用变量避免编译警告
	}
	return 500
}

// marshalProtoMessage 将 proto message 序列化为 JSON 字符串
func marshalProtoMessage(msg interface{}) string {
	if msg == nil {
		return ""
	}

	// 尝试转换为 proto.Message
	protoMsg, ok := msg.(proto.Message)
	if !ok {
		return ""
	}

	// 使用 protojson 序列化
	opts := protojson.MarshalOptions{
		EmitUnpopulated: false, // 不输出空字段
		UseProtoNames:   true,  // 使用 proto 字段名
	}

	data, err := opts.Marshal(protoMsg)
	if err != nil {
		return ""
	}

	// 限制长度，避免日志过大
	result := string(data)
	if len(result) > 4096 {
		return result[:4096] + "...[truncated]"
	}

	return result
}

// getClientIP 从请求头获取客户端 IP
func getClientIP(header interface{ Get(string) string }) string {
	// 优先从 X-Real-IP 获取
	if ip := header.Get("X-Real-IP"); ip != "" {
		return ip
	}
	// 其次从 X-Forwarded-For 获取
	if ip := header.Get("X-Forwarded-For"); ip != "" {
		return ip
	}
	return ""
}

// OtelGinMiddleware OpenTelemetry Gin 中间件
func OtelGinMiddleware(provider *Provider, loggerSet *LoggerSet) gin.HandlerFunc {
	return func(c *gin.Context) {
		if provider == nil || !provider.IsEnabled() {
			c.Next()
			return
		}

		// 从请求头提取追踪上下文
		ctx := otel.GetTextMapPropagator().Extract(c.Request.Context(), propagation.HeaderCarrier(c.Request.Header))

		tracer := otel.Tracer(TracerName)
		path := c.FullPath()
		if path == "" {
			path = c.Request.URL.Path
		}

		// 开始 span
		ctx, span := tracer.Start(ctx, c.Request.Method+" "+path,
			trace.WithSpanKind(trace.SpanKindServer),
			trace.WithAttributes(
				attribute.String("http.method", c.Request.Method),
				attribute.String("http.route", path),
				attribute.String("http.url", c.Request.URL.String()),
				attribute.String("http.host", c.Request.Host),
				attribute.String("http.user_agent", c.Request.UserAgent()),
				attribute.String("http.client_ip", c.ClientIP()),
			),
		)
		defer span.End()

		// 更新请求上下文
		c.Request = c.Request.WithContext(ctx)

		startTime := time.Now()

		// 处理请求
		c.Next()

		// 计算耗时
		duration := time.Since(startTime)
		statusCode := c.Writer.Status()

		// 设置 span 属性
		span.SetAttributes(attribute.Int("http.status_code", statusCode))

		// 设置 span 状态
		if statusCode >= 500 {
			span.SetStatus(codes.Error, "Server error")
		} else if statusCode >= 400 {
			span.SetStatus(codes.Error, "Client error")
		} else {
			span.SetStatus(codes.Ok, "")
		}

		// 记录 API 日志
		if loggerSet != nil {
			var errorMsg string
			if len(c.Errors) > 0 {
				errorMsg = c.Errors.String()
			}

			loggerSet.LogAPIRequest(ctx, APILogEntry{
				Method:       c.Request.Method,
				Path:         path,
				StatusCode:   statusCode,
				DurationMs:   duration.Milliseconds(),
				ClientIP:     c.ClientIP(),
				UserAgent:    c.Request.UserAgent(),
				RequestID:    span.SpanContext().TraceID().String(),
				ErrorMessage: errorMsg,
			})
		}

		// 将追踪上下文注入响应头
		otel.GetTextMapPropagator().Inject(ctx, propagation.HeaderCarrier(c.Writer.Header()))
	}
}

// SpanFromContext 从上下文获取当前 span
func SpanFromContext(ctx context.Context) trace.Span {
	return trace.SpanFromContext(ctx)
}

// StartSpan 开始一个新的 span
func StartSpan(ctx context.Context, name string, opts ...trace.SpanStartOption) (context.Context, trace.Span) {
	return otel.Tracer(TracerName).Start(ctx, name, opts...)
}

// AddSpanEvent 添加 span 事件
func AddSpanEvent(ctx context.Context, name string, attrs ...attribute.KeyValue) {
	span := trace.SpanFromContext(ctx)
	if span.IsRecording() {
		span.AddEvent(name, trace.WithAttributes(attrs...))
	}
}

// SetSpanError 设置 span 错误
func SetSpanError(ctx context.Context, err error) {
	span := trace.SpanFromContext(ctx)
	if span.IsRecording() && err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
	}
}

// SetSpanAttributes 设置 span 属性
func SetSpanAttributes(ctx context.Context, attrs ...attribute.KeyValue) {
	span := trace.SpanFromContext(ctx)
	if span.IsRecording() {
		span.SetAttributes(attrs...)
	}
}
