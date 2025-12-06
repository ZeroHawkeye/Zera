// Package telemetry 辅助函数，方便在应用程序代码中使用 OpenTelemetry
package telemetry

import (
	"context"
	"log/slog"

	"go.opentelemetry.io/otel/attribute"
)

// LogAPI 记录 API 日志的便捷函数
func LogAPI(ctx context.Context, entry APILogEntry) {
	if ls := GetLoggerSet(); ls != nil {
		ls.LogAPIRequest(ctx, entry)
	}
}

// LogDB 记录数据库日志的便捷函数
func LogDB(ctx context.Context, entry DBLogEntry, slowThreshold int64) {
	if ls := GetLoggerSet(); ls != nil {
		ls.LogDBQuery(ctx, entry, slowThreshold)
	}
}

// LogAppInfo 记录应用程序信息日志
func LogAppInfo(ctx context.Context, module, action, message string, details map[string]string) {
	if ls := GetLoggerSet(); ls != nil {
		ls.LogApp(ctx, slog.LevelInfo, AppLogEntry{
			Module:  module,
			Action:  action,
			Message: message,
			Details: details,
		})
	}
}

// LogAppWarn 记录应用程序警告日志
func LogAppWarn(ctx context.Context, module, action, message string, details map[string]string) {
	if ls := GetLoggerSet(); ls != nil {
		ls.LogApp(ctx, slog.LevelWarn, AppLogEntry{
			Module:  module,
			Action:  action,
			Message: message,
			Details: details,
		})
	}
}

// LogAppError 记录应用程序错误日志
func LogAppError(ctx context.Context, module, action, message string, err error, details map[string]string) {
	if ls := GetLoggerSet(); ls != nil {
		entry := AppLogEntry{
			Module:  module,
			Action:  action,
			Message: message,
			Details: details,
		}
		if err != nil {
			entry.Error = err.Error()
		}
		ls.LogApp(ctx, slog.LevelError, entry)
	}
}

// LogAppDebug 记录应用程序调试日志
func LogAppDebug(ctx context.Context, module, action, message string, details map[string]string) {
	if ls := GetLoggerSet(); ls != nil {
		ls.LogApp(ctx, slog.LevelDebug, AppLogEntry{
			Module:  module,
			Action:  action,
			Message: message,
			Details: details,
		})
	}
}

// LogDBQuery 记录数据库查询的便捷函数
func LogDBQuery(ctx context.Context, table, operation, sql string, durationMs int64, rowCount int64, err error) {
	if ls := GetLoggerSet(); ls != nil {
		entry := DBLogEntry{
			Operation:  operation,
			Table:      table,
			SQL:        sql,
			DurationMs: durationMs,
			RowCount:   rowCount,
		}
		if err != nil {
			entry.Error = err.Error()
		}
		// 使用默认慢查询阈值 100ms
		ls.LogDBQuery(ctx, entry, 100)
	}
}

// LogDBTransaction 记录数据库事务的便捷函数
func LogDBTransaction(ctx context.Context, operation string, durationMs int64, err error) {
	if ls := GetLoggerSet(); ls != nil {
		entry := DBLogEntry{
			Operation:  operation,
			Table:      "_transaction",
			DurationMs: durationMs,
		}
		if err != nil {
			entry.Error = err.Error()
		}
		ls.LogDBQuery(ctx, entry, 0)
	}
}

// WithSpan 创建一个新的 span 并在函数结束时自动结束
// 用法:
//
//	ctx, end := telemetry.WithSpan(ctx, "operation_name")
//	defer end()
func WithSpan(ctx context.Context, name string, attrs ...attribute.KeyValue) (context.Context, func()) {
	ctx, span := StartSpan(ctx, name)
	if len(attrs) > 0 {
		span.SetAttributes(attrs...)
	}
	return ctx, func() {
		span.End()
	}
}

// RecordError 记录错误到当前 span 和应用日志
func RecordError(ctx context.Context, module string, err error, message string) {
	if err == nil {
		return
	}

	// 记录到 span
	SetSpanError(ctx, err)

	// 记录到应用日志
	LogAppError(ctx, module, "error", message, err, nil)
}

// Attr 创建属性的便捷函数
var (
	AttrString  = attribute.String
	AttrInt     = attribute.Int
	AttrInt64   = attribute.Int64
	AttrFloat64 = attribute.Float64
	AttrBool    = attribute.Bool
)
