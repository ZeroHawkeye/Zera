package middleware

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"

	"zera/internal/handler"
	"zera/internal/logger"
	"zera/internal/permission"

	"connectrpc.com/connect"
)

// 模块常量，用于日志记录
const auditLogModule = "audit_log"

// AuditLogInterceptor 审计日志拦截器
// 自动记录所有 API 请求的审计日志
type AuditLogInterceptor struct {
	logger logger.Writer
}

// NewAuditLogInterceptor 创建审计日志拦截器
func NewAuditLogInterceptor(logger logger.Writer) *AuditLogInterceptor {
	return &AuditLogInterceptor{
		logger: logger,
	}
}

// WrapUnary 包装一元调用
func (i *AuditLogInterceptor) WrapUnary(next connect.UnaryFunc) connect.UnaryFunc {
	return func(ctx context.Context, req connect.AnyRequest) (connect.AnyResponse, error) {
		startTime := time.Now()
		procedure := req.Spec().Procedure

		// 执行请求
		resp, err := next(ctx, req)

		// 计算耗时
		duration := time.Since(startTime).Milliseconds()

		// 构建日志条目
		entry := i.buildEntry(ctx, req.Header(), procedure, req.Any(), duration, err)

		// 异步写入日志
		go func() {
			writeCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()
			if writeErr := i.logger.Write(writeCtx, entry); writeErr != nil {
				// 日志写入失败不影响请求，但记录到系统日志
				logger.ErrorContext(ctx, "failed to write audit log",
					"error", writeErr,
					"procedure", procedure,
				)
			}
		}()

		return resp, err
	}
}

// WrapStreamingClient 包装流式客户端
func (i *AuditLogInterceptor) WrapStreamingClient(next connect.StreamingClientFunc) connect.StreamingClientFunc {
	return next
}

// WrapStreamingHandler 包装流式处理器
func (i *AuditLogInterceptor) WrapStreamingHandler(next connect.StreamingHandlerFunc) connect.StreamingHandlerFunc {
	return func(ctx context.Context, conn connect.StreamingHandlerConn) error {
		startTime := time.Now()
		procedure := conn.Spec().Procedure

		// 执行请求
		err := next(ctx, conn)

		// 计算耗时
		duration := time.Since(startTime).Milliseconds()

		// 构建日志条目
		entry := i.buildEntry(ctx, conn.RequestHeader(), procedure, nil, duration, err)

		// 异步写入日志
		go func() {
			writeCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()
			if writeErr := i.logger.Write(writeCtx, entry); writeErr != nil {
				// 日志写入失败不影响请求，但记录到系统日志
				logger.ErrorContext(ctx, "failed to write audit log",
					"error", writeErr,
					"procedure", procedure,
				)
			}
		}()

		return err
	}
}

// buildEntry 构建日志条目
func (i *AuditLogInterceptor) buildEntry(
	ctx context.Context,
	header http.Header,
	procedure string,
	requestBody interface{},
	durationMs int64,
	err error,
) *logger.Entry {
	entry := &logger.Entry{
		Level:      logger.LevelInfo,
		Path:       procedure,
		Method:     "POST", // Connect RPC 默认使用 POST
		DurationMs: &durationMs,
		CreatedAt:  time.Now(),
		IP:         extractClientIP(header),
		UserAgent:  header.Get("User-Agent"),
	}

	// 从权限注册表获取模块和操作信息
	if apiPerm := permission.GetByProcedure(procedure); apiPerm != nil {
		entry.Module = apiPerm.Resource
		if entry.Module == "" {
			entry.Module = "system"
		}
		entry.Action = apiPerm.Action
		if entry.Action == "" {
			entry.Action = extractActionFromProcedure(procedure)
		}
		entry.Resource = apiPerm.Resource
	} else {
		// 未注册的 API
		entry.Module = "unknown"
		entry.Action = extractActionFromProcedure(procedure)
	}

	// 从上下文获取用户信息
	if userID, ok := ctx.Value(handler.ContextKeyUserID).(int); ok {
		entry.UserID = &userID
	}
	if username, ok := ctx.Value(handler.ContextKeyUsername).(string); ok {
		entry.Username = username
	}

	// 处理请求体（脱敏）并提取资源 ID
	if requestBody != nil {
		entry.RequestBody = sanitizeRequestBody(requestBody)
		// 从请求体中提取资源 ID
		entry.ResourceID = extractResourceID(requestBody)
	}

	// 处理错误
	if err != nil {
		entry.Level = logger.LevelError
		entry.ErrorMessage = err.Error()

		// 根据 Connect 错误码设置状态码
		if connectErr, ok := err.(*connect.Error); ok {
			statusCode := connectCodeToHTTPStatus(connectErr.Code())
			entry.StatusCode = &statusCode
		} else {
			statusCode := 500
			entry.StatusCode = &statusCode
		}
	} else {
		statusCode := 200
		entry.StatusCode = &statusCode
	}

	return entry
}

// extractActionFromProcedure 从过程名提取操作
func extractActionFromProcedure(procedure string) string {
	// 格式: /package.Service/Method
	parts := strings.Split(procedure, "/")
	if len(parts) >= 3 {
		return parts[len(parts)-1]
	}
	return procedure
}

// extractClientIP 提取客户端 IP
func extractClientIP(header http.Header) string {
	// 按优先级检查各种头
	if ip := header.Get("X-Real-IP"); ip != "" {
		return ip
	}
	if ip := header.Get("X-Forwarded-For"); ip != "" {
		// X-Forwarded-For 可能包含多个 IP，取第一个
		parts := strings.Split(ip, ",")
		return strings.TrimSpace(parts[0])
	}
	// 从 Connect-RPC 头中获取（由 Gin 中间件设置）
	if ip := header.Get("X-Client-IP"); ip != "" {
		return ip
	}
	return ""
}

// extractResourceID 从请求体中提取资源 ID
// 支持常见的 ID 字段名称：id, user_id, role_id, userId, roleId 等
func extractResourceID(body interface{}) string {
	data, err := json.Marshal(body)
	if err != nil {
		return ""
	}

	var jsonMap map[string]interface{}
	if err := json.Unmarshal(data, &jsonMap); err != nil {
		return ""
	}

	// 按优先级检查各种 ID 字段
	idFields := []string{"id", "Id", "ID", "user_id", "userId", "role_id", "roleId", "log_id", "logId"}
	for _, field := range idFields {
		if val, ok := jsonMap[field]; ok {
			return formatResourceID(val)
		}
	}

	// 检查 ids 数组字段（批量操作）
	idsFields := []string{"ids", "Ids", "IDS", "user_ids", "userIds", "role_ids", "roleIds"}
	for _, field := range idsFields {
		if val, ok := jsonMap[field]; ok {
			if ids, ok := val.([]interface{}); ok && len(ids) > 0 {
				// 对于批量操作，返回第一个 ID 加上数量提示
				first := formatResourceID(ids[0])
				if len(ids) > 1 {
					return first + " (+" + formatResourceID(len(ids)-1) + " more)"
				}
				return first
			}
		}
	}

	return ""
}

// formatResourceID 将各种类型的 ID 格式化为字符串
func formatResourceID(val interface{}) string {
	switch v := val.(type) {
	case string:
		return v
	case float64:
		// JSON 数字默认解析为 float64
		if v == float64(int64(v)) {
			return strconv.FormatInt(int64(v), 10)
		}
		return strconv.FormatFloat(v, 'f', -1, 64)
	case int:
		return strconv.Itoa(v)
	case int64:
		return strconv.FormatInt(v, 10)
	case int32:
		return strconv.FormatInt(int64(v), 10)
	default:
		return ""
	}
}

// sanitizeRequestBody 脱敏请求体
func sanitizeRequestBody(body interface{}) string {
	data, err := json.Marshal(body)
	if err != nil {
		return ""
	}

	// 脱敏敏感字段
	var jsonMap map[string]interface{}
	if err := json.Unmarshal(data, &jsonMap); err != nil {
		return string(data)
	}

	sanitizeMap(jsonMap)

	result, _ := json.Marshal(jsonMap)
	return string(result)
}

// sensitiveFieldPatterns 敏感字段正则模式
var sensitiveFieldPatterns = []*regexp.Regexp{
	regexp.MustCompile(`(?i)password`),
	regexp.MustCompile(`(?i)token`),
	regexp.MustCompile(`(?i)secret`),
	regexp.MustCompile(`(?i)key`),
	regexp.MustCompile(`(?i)credential`),
	regexp.MustCompile(`(?i)auth`),
}

// sanitizeMap 递归脱敏 map 中的敏感字段
func sanitizeMap(m map[string]interface{}) {
	for key, value := range m {
		// 检查是否为敏感字段
		isSensitive := false
		for _, pattern := range sensitiveFieldPatterns {
			if pattern.MatchString(key) {
				isSensitive = true
				break
			}
		}

		if isSensitive {
			m[key] = "***"
		} else if nested, ok := value.(map[string]interface{}); ok {
			sanitizeMap(nested)
		}
	}
}

// connectCodeToHTTPStatus 将 Connect 错误码转换为 HTTP 状态码
func connectCodeToHTTPStatus(code connect.Code) int {
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
	default:
		return 500
	}
}

// GinAuditLogMiddleware Gin 框架的审计日志中间件
// 用于记录非 Connect RPC 的请求
func GinAuditLogMiddleware(auditLogger logger.Writer) func(c interface {
	Request() *http.Request
	Writer() interface{ Status() int }
	Next()
}) {
	// TODO: 如果需要记录其他非 RPC 请求，可以实现此中间件
	return nil
}

// ResponseBodyWriter 用于捕获响应体的 Writer
type ResponseBodyWriter struct {
	http.ResponseWriter
	body *bytes.Buffer
}

// Write 写入响应体
func (w *ResponseBodyWriter) Write(b []byte) (int, error) {
	w.body.Write(b)
	return w.ResponseWriter.Write(b)
}

// ReadRequestBody 读取并恢复请求体
func ReadRequestBody(r *http.Request) ([]byte, error) {
	if r.Body == nil {
		return nil, nil
	}

	body, err := io.ReadAll(r.Body)
	if err != nil {
		return nil, err
	}

	// 恢复请求体以便后续处理
	r.Body = io.NopCloser(bytes.NewBuffer(body))
	return body, nil
}
