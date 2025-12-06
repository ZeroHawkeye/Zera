// Package telemetry 分类日志记录器
package telemetry

import (
	"context"
	"log/slog"
	"time"

	"zera/internal/config"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/log"
	"go.opentelemetry.io/otel/log/global"
	"go.opentelemetry.io/otel/trace"
)

// LogCategory 日志分类
type LogCategory string

const (
	// LogCategoryAPI API 请求日志
	LogCategoryAPI LogCategory = "api"
	// LogCategoryApp 应用程序日志
	LogCategoryApp LogCategory = "app"
	// LogCategoryDB 数据库查询日志
	LogCategoryDB LogCategory = "db"
)

// CategoryLogger 分类日志记录器
type CategoryLogger struct {
	provider *Provider
	category LogCategory
	logger   log.Logger
}

// NewCategoryLogger 创建分类日志记录器
func NewCategoryLogger(provider *Provider, category LogCategory) *CategoryLogger {
	var logger log.Logger
	if provider != nil && provider.IsEnabled() && provider.LoggerProvider() != nil {
		logger = provider.LoggerProvider().Logger(
			string(category),
			log.WithInstrumentationVersion("1.0.0"),
		)
	}

	return &CategoryLogger{
		provider: provider,
		category: category,
		logger:   logger,
	}
}

// isEnabled 检查是否启用此类别的日志
func (l *CategoryLogger) isEnabled() bool {
	if l.provider == nil || !l.provider.IsEnabled() || l.logger == nil {
		return false
	}

	cfg := l.provider.Config()
	switch l.category {
	case LogCategoryAPI:
		return cfg.Logs.APIEnabled
	case LogCategoryApp:
		return cfg.Logs.AppEnabled
	case LogCategoryDB:
		return cfg.Logs.DBEnabled
	default:
		return true
	}
}

// Log 记录日志
func (l *CategoryLogger) Log(ctx context.Context, level slog.Level, msg string, attrs ...attribute.KeyValue) {
	if !l.isEnabled() {
		return
	}

	record := log.Record{}
	record.SetTimestamp(time.Now())
	record.SetBody(log.StringValue(msg))
	record.SetSeverity(slogLevelToOtelSeverity(level))
	record.SetSeverityText(level.String())

	// 添加分类属性
	attrs = append(attrs, attribute.String("log.category", string(l.category)))

	// 从上下文提取追踪信息
	if span := trace.SpanFromContext(ctx); span.SpanContext().IsValid() {
		sc := span.SpanContext()
		attrs = append(attrs,
			attribute.String("trace_id", sc.TraceID().String()),
			attribute.String("span_id", sc.SpanID().String()),
		)
	}

	// 添加所有属性
	for _, attr := range attrs {
		record.AddAttributes(attributeToKeyValue(attr))
	}

	l.logger.Emit(ctx, record)
}

// Debug 记录调试日志
func (l *CategoryLogger) Debug(ctx context.Context, msg string, attrs ...attribute.KeyValue) {
	l.Log(ctx, slog.LevelDebug, msg, attrs...)
}

// Info 记录信息日志
func (l *CategoryLogger) Info(ctx context.Context, msg string, attrs ...attribute.KeyValue) {
	l.Log(ctx, slog.LevelInfo, msg, attrs...)
}

// Warn 记录警告日志
func (l *CategoryLogger) Warn(ctx context.Context, msg string, attrs ...attribute.KeyValue) {
	l.Log(ctx, slog.LevelWarn, msg, attrs...)
}

// Error 记录错误日志
func (l *CategoryLogger) Error(ctx context.Context, msg string, attrs ...attribute.KeyValue) {
	l.Log(ctx, slog.LevelError, msg, attrs...)
}

// slogLevelToOtelSeverity 转换 slog 级别到 OpenTelemetry 严重性
func slogLevelToOtelSeverity(level slog.Level) log.Severity {
	switch {
	case level <= slog.LevelDebug:
		return log.SeverityDebug
	case level <= slog.LevelInfo:
		return log.SeverityInfo
	case level <= slog.LevelWarn:
		return log.SeverityWarn
	default:
		return log.SeverityError
	}
}

// attributeToKeyValue 转换 attribute.KeyValue 到 log.KeyValue
func attributeToKeyValue(attr attribute.KeyValue) log.KeyValue {
	key := string(attr.Key)
	switch attr.Value.Type() {
	case attribute.BOOL:
		return log.Bool(key, attr.Value.AsBool())
	case attribute.INT64:
		return log.Int64(key, attr.Value.AsInt64())
	case attribute.FLOAT64:
		return log.Float64(key, attr.Value.AsFloat64())
	case attribute.STRING:
		return log.String(key, attr.Value.AsString())
	case attribute.BOOLSLICE:
		// 转换为字符串
		return log.String(key, attr.Value.Emit())
	case attribute.INT64SLICE:
		return log.String(key, attr.Value.Emit())
	case attribute.FLOAT64SLICE:
		return log.String(key, attr.Value.Emit())
	case attribute.STRINGSLICE:
		return log.String(key, attr.Value.Emit())
	default:
		return log.String(key, attr.Value.Emit())
	}
}

// LoggerSet 日志记录器集合
type LoggerSet struct {
	API *CategoryLogger
	App *CategoryLogger
	DB  *CategoryLogger
}

// NewLoggerSet 创建日志记录器集合
func NewLoggerSet(provider *Provider) *LoggerSet {
	return &LoggerSet{
		API: NewCategoryLogger(provider, LogCategoryAPI),
		App: NewCategoryLogger(provider, LogCategoryApp),
		DB:  NewCategoryLogger(provider, LogCategoryDB),
	}
}

// APILogEntry API 日志条目
type APILogEntry struct {
	Method       string
	Path         string
	StatusCode   int
	DurationMs   int64
	ClientIP     string
	UserAgent    string
	RequestID    string
	UserID       int
	Username     string
	ErrorMessage string
	RequestBody  string // 请求体 (JSON 格式)
	ResponseBody string // 响应体 (JSON 格式)
}

// LogAPIRequest 记录 API 请求日志
func (l *LoggerSet) LogAPIRequest(ctx context.Context, entry APILogEntry) {
	attrs := []attribute.KeyValue{
		attribute.String("http.method", entry.Method),
		attribute.String("http.route", entry.Path),
		attribute.Int("http.status_code", entry.StatusCode),
		attribute.Int64("http.duration_ms", entry.DurationMs),
		attribute.String("http.client_ip", entry.ClientIP),
		attribute.String("http.user_agent", entry.UserAgent),
	}

	if entry.RequestID != "" {
		attrs = append(attrs, attribute.String("request_id", entry.RequestID))
	}
	if entry.UserID > 0 {
		attrs = append(attrs, attribute.Int("user_id", entry.UserID))
	}
	if entry.Username != "" {
		attrs = append(attrs, attribute.String("username", entry.Username))
	}
	if entry.ErrorMessage != "" {
		attrs = append(attrs, attribute.String("error.message", entry.ErrorMessage))
	}
	if entry.RequestBody != "" {
		attrs = append(attrs, attribute.String("http.request.body", entry.RequestBody))
	}
	if entry.ResponseBody != "" {
		attrs = append(attrs, attribute.String("http.response.body", entry.ResponseBody))
	}

	level := slog.LevelInfo
	msg := "API request completed"
	if entry.StatusCode >= 500 {
		level = slog.LevelError
		msg = "API request failed"
	} else if entry.StatusCode >= 400 {
		level = slog.LevelWarn
		msg = "API request client error"
	}

	l.API.Log(ctx, level, msg, attrs...)
}

// DBLogEntry 数据库日志条目
type DBLogEntry struct {
	Operation  string // query, exec, tx_begin, tx_commit, tx_rollback
	Table      string
	SQL        string
	Args       string // JSON 格式的参数
	DurationMs int64
	RowCount   int64
	Error      string
}

// LogDBQuery 记录数据库查询日志
func (l *LoggerSet) LogDBQuery(ctx context.Context, entry DBLogEntry, slowThreshold int64) {
	attrs := []attribute.KeyValue{
		attribute.String("db.operation", entry.Operation),
		attribute.Int64("db.duration_ms", entry.DurationMs),
	}

	if entry.Table != "" {
		attrs = append(attrs, attribute.String("db.table", entry.Table))
	}
	if entry.SQL != "" {
		attrs = append(attrs, attribute.String("db.statement", entry.SQL))
	}
	if entry.Args != "" {
		attrs = append(attrs, attribute.String("db.args", entry.Args))
	}
	if entry.RowCount >= 0 {
		attrs = append(attrs, attribute.Int64("db.row_count", entry.RowCount))
	}
	if entry.Error != "" {
		attrs = append(attrs, attribute.String("error.message", entry.Error))
	}

	level := slog.LevelDebug
	msg := "Database " + entry.Operation

	if entry.Error != "" {
		level = slog.LevelError
		msg = "Database " + entry.Operation + " failed"
	} else if entry.DurationMs > slowThreshold && slowThreshold > 0 {
		level = slog.LevelWarn
		msg = "Database slow " + entry.Operation
		attrs = append(attrs, attribute.Bool("db.slow_query", true))
	}

	l.DB.Log(ctx, level, msg, attrs...)
}

// AppLogEntry 应用程序日志条目
type AppLogEntry struct {
	Module  string
	Action  string
	Message string
	Error   string
	Details map[string]string
}

// LogApp 记录应用程序日志
func (l *LoggerSet) LogApp(ctx context.Context, level slog.Level, entry AppLogEntry) {
	attrs := []attribute.KeyValue{}

	if entry.Module != "" {
		attrs = append(attrs, attribute.String("module", entry.Module))
	}
	if entry.Action != "" {
		attrs = append(attrs, attribute.String("action", entry.Action))
	}
	if entry.Error != "" {
		attrs = append(attrs, attribute.String("error.message", entry.Error))
	}
	for k, v := range entry.Details {
		attrs = append(attrs, attribute.String(k, v))
	}

	l.App.Log(ctx, level, entry.Message, attrs...)
}

// globalLoggerSet 全局日志记录器集合
var globalLoggerSet *LoggerSet

// InitGlobalLoggerSet 初始化全局日志记录器集合
func InitGlobalLoggerSet(provider *Provider) {
	globalLoggerSet = NewLoggerSet(provider)
}

// GetLoggerSet 获取全局日志记录器集合
func GetLoggerSet() *LoggerSet {
	return globalLoggerSet
}

// OtelSlogHandler OpenTelemetry slog Handler
// 将 slog 日志转发到 OpenTelemetry
type OtelSlogHandler struct {
	provider *Provider
	cfg      *config.TelemetryLogsConfig
	attrs    []slog.Attr
	groups   []string
}

// NewOtelSlogHandler 创建 OpenTelemetry slog Handler
func NewOtelSlogHandler(provider *Provider, cfg *config.TelemetryLogsConfig) *OtelSlogHandler {
	return &OtelSlogHandler{
		provider: provider,
		cfg:      cfg,
	}
}

// Enabled 检查是否启用指定级别的日志
func (h *OtelSlogHandler) Enabled(_ context.Context, _ slog.Level) bool {
	return h.provider != nil && h.provider.IsEnabled() && h.cfg.AppEnabled
}

// Handle 处理日志记录
func (h *OtelSlogHandler) Handle(ctx context.Context, r slog.Record) error {
	if !h.Enabled(ctx, r.Level) {
		return nil
	}

	logger := global.GetLoggerProvider().Logger("app", log.WithInstrumentationVersion("1.0.0"))

	record := log.Record{}
	record.SetTimestamp(r.Time)
	record.SetBody(log.StringValue(r.Message))
	record.SetSeverity(slogLevelToOtelSeverity(r.Level))
	record.SetSeverityText(r.Level.String())

	// 添加分类
	record.AddAttributes(log.String("log.category", "app"))

	// 添加 slog 属性
	r.Attrs(func(attr slog.Attr) bool {
		record.AddAttributes(slogAttrToLogKeyValue(attr))
		return true
	})

	// 添加预设属性
	for _, attr := range h.attrs {
		record.AddAttributes(slogAttrToLogKeyValue(attr))
	}

	// 从上下文提取追踪信息
	if span := trace.SpanFromContext(ctx); span.SpanContext().IsValid() {
		sc := span.SpanContext()
		record.AddAttributes(
			log.String("trace_id", sc.TraceID().String()),
			log.String("span_id", sc.SpanID().String()),
		)
	}

	logger.Emit(ctx, record)
	return nil
}

// WithAttrs 返回带有属性的新 Handler
func (h *OtelSlogHandler) WithAttrs(attrs []slog.Attr) slog.Handler {
	newHandler := &OtelSlogHandler{
		provider: h.provider,
		cfg:      h.cfg,
		attrs:    append(h.attrs, attrs...),
		groups:   h.groups,
	}
	return newHandler
}

// WithGroup 返回带有分组的新 Handler
func (h *OtelSlogHandler) WithGroup(name string) slog.Handler {
	newHandler := &OtelSlogHandler{
		provider: h.provider,
		cfg:      h.cfg,
		attrs:    h.attrs,
		groups:   append(h.groups, name),
	}
	return newHandler
}

// slogAttrToLogKeyValue 转换 slog.Attr 到 log.KeyValue
func slogAttrToLogKeyValue(attr slog.Attr) log.KeyValue {
	key := attr.Key
	val := attr.Value

	switch val.Kind() {
	case slog.KindBool:
		return log.Bool(key, val.Bool())
	case slog.KindInt64:
		return log.Int64(key, val.Int64())
	case slog.KindUint64:
		return log.Int64(key, int64(val.Uint64()))
	case slog.KindFloat64:
		return log.Float64(key, val.Float64())
	case slog.KindString:
		return log.String(key, val.String())
	case slog.KindTime:
		return log.String(key, val.Time().Format(time.RFC3339Nano))
	case slog.KindDuration:
		return log.Int64(key, val.Duration().Milliseconds())
	default:
		return log.String(key, val.String())
	}
}
