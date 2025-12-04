// Package logger 提供统一的日志记录功能，支持结构化日志、追踪ID、行号记录等
// 设计目标：方便后续对接 SignOz、Elasticsearch 等第三方日志平台
package logger

import (
	"context"
	"io"
	"log/slog"
	"os"
	"runtime"
	"sync"
	"time"
)

// LogFormat 日志格式类型
type LogFormat string

const (
	// FormatJSON JSON 格式，适合生产环境和日志平台对接
	FormatJSON LogFormat = "json"
	// FormatText 文本格式，适合开发调试
	FormatText LogFormat = "text"
)

// LogLevel 日志级别
type LogLevel string

const (
	LogLevelDebug LogLevel = "debug"
	LogLevelInfo  LogLevel = "info"
	LogLevelWarn  LogLevel = "warn"
	LogLevelError LogLevel = "error"
)

// LogConfig 日志配置
type LogConfig struct {
	// Level 日志级别: debug, info, warn, error
	Level LogLevel `toml:"level"`
	// Format 日志格式: json, text
	Format LogFormat `toml:"format"`
	// Output 输出目标: stdout, stderr, file path
	Output string `toml:"output"`
	// AddSource 是否添加源代码位置（文件名和行号）
	AddSource bool `toml:"add_source"`
	// ServiceName 服务名称，用于日志标识
	ServiceName string `toml:"service_name"`
	// ServiceVersion 服务版本
	ServiceVersion string `toml:"service_version"`
	// Environment 运行环境: development, staging, production
	Environment string `toml:"environment"`
}

// DefaultLogConfig 默认日志配置
func DefaultLogConfig() *LogConfig {
	return &LogConfig{
		Level:          LogLevelInfo,
		Format:         FormatText,
		Output:         "stdout",
		AddSource:      true,
		ServiceName:    "zera",
		ServiceVersion: "1.0.0",
		Environment:    "development",
	}
}

// 上下文键类型
type contextKey string

const (
	// TraceIDKey 追踪ID上下文键
	TraceIDKey contextKey = "trace_id"
	// SpanIDKey Span ID上下文键（用于分布式追踪）
	SpanIDKey contextKey = "span_id"
	// UserIDKey 用户ID上下文键
	UserIDKey contextKey = "user_id"
	// UsernameKey 用户名上下文键
	UsernameKey contextKey = "username"
	// RequestIDKey 请求ID上下文键
	RequestIDKey contextKey = "request_id"
)

// 全局日志实例
var (
	globalLogger *slog.Logger
	globalMu     sync.RWMutex
	initialized  bool
)

// GlobalLogger 全局日志管理器
type GlobalLogger struct {
	logger *slog.Logger
	config *LogConfig
	output io.WriteCloser
}

// NewGlobalLogger 创建全局日志管理器
func NewGlobalLogger(cfg *LogConfig) (*GlobalLogger, error) {
	if cfg == nil {
		cfg = DefaultLogConfig()
	}

	// 确定输出目标
	var output io.WriteCloser
	switch cfg.Output {
	case "stdout", "":
		output = os.Stdout
	case "stderr":
		output = os.Stderr
	default:
		// 文件输出
		file, err := os.OpenFile(cfg.Output, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0644)
		if err != nil {
			return nil, err
		}
		output = file
	}

	// 确定日志级别
	var level slog.Level
	switch cfg.Level {
	case LogLevelDebug:
		level = slog.LevelDebug
	case LogLevelWarn:
		level = slog.LevelWarn
	case LogLevelError:
		level = slog.LevelError
	default:
		level = slog.LevelInfo
	}

	// 创建 Handler 选项
	opts := &slog.HandlerOptions{
		Level:     level,
		AddSource: cfg.AddSource,
		ReplaceAttr: func(groups []string, a slog.Attr) slog.Attr {
			// 自定义时间格式
			if a.Key == slog.TimeKey {
				if t, ok := a.Value.Any().(time.Time); ok {
					a.Value = slog.StringValue(t.Format(time.RFC3339Nano))
				}
			}
			// 自定义级别格式
			if a.Key == slog.LevelKey {
				if lvl, ok := a.Value.Any().(slog.Level); ok {
					a.Value = slog.StringValue(lvl.String())
				}
			}
			// 简化源代码路径
			if a.Key == slog.SourceKey {
				if src, ok := a.Value.Any().(*slog.Source); ok {
					// 只保留文件名和行号，不要完整路径
					a.Value = slog.GroupValue(
						slog.String("file", shortFile(src.File)),
						slog.Int("line", src.Line),
						slog.String("function", shortFunc(src.Function)),
					)
				}
			}
			return a
		},
	}

	// 创建 Handler
	var handler slog.Handler
	switch cfg.Format {
	case FormatJSON:
		handler = slog.NewJSONHandler(output, opts)
	default:
		handler = slog.NewTextHandler(output, opts)
	}

	// 包装 Handler 以添加默认字段
	handler = &contextHandler{
		Handler: handler,
		config:  cfg,
	}

	logger := slog.New(handler)

	gl := &GlobalLogger{
		logger: logger,
		config: cfg,
		output: output,
	}

	// 设置全局实例
	globalMu.Lock()
	globalLogger = logger
	initialized = true
	globalMu.Unlock()

	return gl, nil
}

// Logger 返回底层的 slog.Logger
func (g *GlobalLogger) Logger() *slog.Logger {
	return g.logger
}

// Close 关闭日志管理器
func (g *GlobalLogger) Close() error {
	if g.output != nil && g.output != os.Stdout && g.output != os.Stderr {
		return g.output.Close()
	}
	return nil
}

// contextHandler 自定义 Handler，用于从上下文提取字段
type contextHandler struct {
	slog.Handler
	config *LogConfig
}

// Handle 处理日志记录，从上下文提取追踪信息
func (h *contextHandler) Handle(ctx context.Context, r slog.Record) error {
	// 添加服务信息
	if h.config.ServiceName != "" {
		r.AddAttrs(slog.String("service", h.config.ServiceName))
	}
	if h.config.ServiceVersion != "" {
		r.AddAttrs(slog.String("version", h.config.ServiceVersion))
	}
	if h.config.Environment != "" {
		r.AddAttrs(slog.String("env", h.config.Environment))
	}

	// 从上下文提取追踪信息
	if ctx != nil {
		if traceID, ok := ctx.Value(TraceIDKey).(string); ok && traceID != "" {
			r.AddAttrs(slog.String("trace_id", traceID))
		}
		if spanID, ok := ctx.Value(SpanIDKey).(string); ok && spanID != "" {
			r.AddAttrs(slog.String("span_id", spanID))
		}
		if requestID, ok := ctx.Value(RequestIDKey).(string); ok && requestID != "" {
			r.AddAttrs(slog.String("request_id", requestID))
		}
		if userID, ok := ctx.Value(UserIDKey).(int); ok {
			r.AddAttrs(slog.Int("user_id", userID))
		}
		if username, ok := ctx.Value(UsernameKey).(string); ok && username != "" {
			r.AddAttrs(slog.String("username", username))
		}
	}

	return h.Handler.Handle(ctx, r)
}

// WithAttrs 返回带有额外属性的新 Handler
func (h *contextHandler) WithAttrs(attrs []slog.Attr) slog.Handler {
	return &contextHandler{
		Handler: h.Handler.WithAttrs(attrs),
		config:  h.config,
	}
}

// WithGroup 返回带有分组的新 Handler
func (h *contextHandler) WithGroup(name string) slog.Handler {
	return &contextHandler{
		Handler: h.Handler.WithGroup(name),
		config:  h.config,
	}
}

// shortFile 获取短文件名
func shortFile(file string) string {
	for i := len(file) - 1; i > 0; i-- {
		if file[i] == '/' || file[i] == '\\' {
			return file[i+1:]
		}
	}
	return file
}

// shortFunc 获取短函数名
func shortFunc(fn string) string {
	for i := len(fn) - 1; i > 0; i-- {
		if fn[i] == '/' {
			return fn[i+1:]
		}
	}
	return fn
}

// ============================================================================
// 全局日志函数
// ============================================================================

// L 返回全局日志实例
func L() *slog.Logger {
	globalMu.RLock()
	defer globalMu.RUnlock()
	if globalLogger == nil {
		// 返回默认日志器
		return slog.Default()
	}
	return globalLogger
}

// Debug 输出调试日志
func Debug(msg string, args ...any) {
	L().Debug(msg, args...)
}

// DebugContext 输出带上下文的调试日志
func DebugContext(ctx context.Context, msg string, args ...any) {
	L().DebugContext(ctx, msg, args...)
}

// Info 输出信息日志
func Info(msg string, args ...any) {
	L().Info(msg, args...)
}

// InfoContext 输出带上下文的信息日志
func InfoContext(ctx context.Context, msg string, args ...any) {
	L().InfoContext(ctx, msg, args...)
}

// Warn 输出警告日志
func Warn(msg string, args ...any) {
	L().Warn(msg, args...)
}

// WarnContext 输出带上下文的警告日志
func WarnContext(ctx context.Context, msg string, args ...any) {
	L().WarnContext(ctx, msg, args...)
}

// Error 输出错误日志
func Error(msg string, args ...any) {
	L().Error(msg, args...)
}

// ErrorContext 输出带上下文的错误日志
func ErrorContext(ctx context.Context, msg string, args ...any) {
	L().ErrorContext(ctx, msg, args...)
}

// With 返回带有额外字段的日志器
func With(args ...any) *slog.Logger {
	return L().With(args...)
}

// WithContext 返回带有上下文的日志器
func WithContext(ctx context.Context) *slog.Logger {
	return L()
}

// ============================================================================
// 上下文辅助函数
// ============================================================================

// WithTraceID 将追踪ID添加到上下文
func WithTraceID(ctx context.Context, traceID string) context.Context {
	return context.WithValue(ctx, TraceIDKey, traceID)
}

// GetTraceID 从上下文获取追踪ID
func GetTraceID(ctx context.Context) string {
	if traceID, ok := ctx.Value(TraceIDKey).(string); ok {
		return traceID
	}
	return ""
}

// WithSpanID 将Span ID添加到上下文
func WithSpanID(ctx context.Context, spanID string) context.Context {
	return context.WithValue(ctx, SpanIDKey, spanID)
}

// GetSpanID 从上下文获取Span ID
func GetSpanID(ctx context.Context) string {
	if spanID, ok := ctx.Value(SpanIDKey).(string); ok {
		return spanID
	}
	return ""
}

// WithRequestID 将请求ID添加到上下文
func WithRequestID(ctx context.Context, requestID string) context.Context {
	return context.WithValue(ctx, RequestIDKey, requestID)
}

// GetRequestID 从上下文获取请求ID
func GetRequestID(ctx context.Context) string {
	if requestID, ok := ctx.Value(RequestIDKey).(string); ok {
		return requestID
	}
	return ""
}

// WithUserInfo 将用户信息添加到上下文
func WithUserInfo(ctx context.Context, userID int, username string) context.Context {
	ctx = context.WithValue(ctx, UserIDKey, userID)
	ctx = context.WithValue(ctx, UsernameKey, username)
	return ctx
}

// ============================================================================
// 辅助函数
// ============================================================================

// Caller 获取调用者信息
func Caller(skip int) (file string, line int, fn string) {
	pc, file, line, ok := runtime.Caller(skip + 1)
	if !ok {
		return "unknown", 0, "unknown"
	}
	fn = runtime.FuncForPC(pc).Name()
	return shortFile(file), line, shortFunc(fn)
}

// LogError 记录错误日志并返回错误
func LogError(ctx context.Context, err error, msg string, args ...any) error {
	if err != nil {
		args = append(args, "error", err)
		ErrorContext(ctx, msg, args...)
	}
	return err
}

// LogErrorf 记录格式化错误日志并返回错误
func LogErrorf(ctx context.Context, err error, format string, args ...any) error {
	if err != nil {
		ErrorContext(ctx, format, append(args, "error", err)...)
	}
	return err
}
