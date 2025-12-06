// Package telemetry 数据库查询日志钩子
package telemetry

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"entgo.io/ent"
)

// DBHook 数据库日志钩子
type DBHook struct {
	loggerSet     *LoggerSet
	slowThreshold int64
}

// NewDBHook 创建数据库日志钩子
func NewDBHook(loggerSet *LoggerSet, slowThresholdMs int64) *DBHook {
	return &DBHook{
		loggerSet:     loggerSet,
		slowThreshold: slowThresholdMs,
	}
}

// contextKey 上下文键类型
type contextKey string

const (
	// DBQueryStartTimeKey 查询开始时间上下文键
	DBQueryStartTimeKey contextKey = "db_query_start_time"
	// DBOperationKey 操作类型上下文键
	DBOperationKey contextKey = "db_operation"
)

// Hook 返回 Ent 钩子函数
func (h *DBHook) Hook() ent.Hook {
	return func(next ent.Mutator) ent.Mutator {
		return ent.MutateFunc(func(ctx context.Context, m ent.Mutation) (ent.Value, error) {
			if h.loggerSet == nil || h.loggerSet.DB == nil {
				return next.Mutate(ctx, m)
			}

			startTime := time.Now()
			operation := getOperationType(m.Op())
			table := m.Type()

			// 执行操作
			v, err := next.Mutate(ctx, m)

			// 计算耗时
			duration := time.Since(startTime).Milliseconds()

			// 记录日志
			entry := DBLogEntry{
				Operation:  operation,
				Table:      table,
				DurationMs: duration,
				RowCount:   getAffectedRows(v),
			}

			if err != nil {
				entry.Error = err.Error()
			}

			h.loggerSet.LogDBQuery(ctx, entry, h.slowThreshold)

			return v, err
		})
	}
}

// getOperationType 获取操作类型字符串
func getOperationType(op ent.Op) string {
	switch {
	case op.Is(ent.OpCreate):
		return "insert"
	case op.Is(ent.OpUpdate):
		return "update"
	case op.Is(ent.OpUpdateOne):
		return "update_one"
	case op.Is(ent.OpDelete):
		return "delete"
	case op.Is(ent.OpDeleteOne):
		return "delete_one"
	default:
		return "unknown"
	}
}

// getAffectedRows 获取影响的行数
func getAffectedRows(v ent.Value) int64 {
	if v == nil {
		return 0
	}
	// 批量操作返回 int
	if count, ok := v.(int); ok {
		return int64(count)
	}
	// 单条记录操作返回 1
	return 1
}

// QueryLogger 查询日志记录器
// 用于记录读取操作的日志
type QueryLogger struct {
	loggerSet     *LoggerSet
	slowThreshold int64
}

// NewQueryLogger 创建查询日志记录器
func NewQueryLogger(loggerSet *LoggerSet, slowThresholdMs int64) *QueryLogger {
	return &QueryLogger{
		loggerSet:     loggerSet,
		slowThreshold: slowThresholdMs,
	}
}

// LogQuery 记录查询日志
func (l *QueryLogger) LogQuery(ctx context.Context, table string, operation string, sql string, args []interface{}, duration time.Duration, rowCount int, err error) {
	if l.loggerSet == nil || l.loggerSet.DB == nil {
		return
	}

	entry := DBLogEntry{
		Operation:  operation,
		Table:      table,
		SQL:        truncateSQL(sql, 1000),
		Args:       formatArgs(args),
		DurationMs: duration.Milliseconds(),
		RowCount:   int64(rowCount),
	}

	if err != nil {
		entry.Error = err.Error()
	}

	l.loggerSet.LogDBQuery(ctx, entry, l.slowThreshold)
}

// LogTransaction 记录事务日志
func (l *QueryLogger) LogTransaction(ctx context.Context, operation string, duration time.Duration, err error) {
	if l.loggerSet == nil || l.loggerSet.DB == nil {
		return
	}

	entry := DBLogEntry{
		Operation:  operation,
		Table:      "_transaction",
		DurationMs: duration.Milliseconds(),
	}

	if err != nil {
		entry.Error = err.Error()
	}

	l.loggerSet.LogDBQuery(ctx, entry, l.slowThreshold)
}

// truncateSQL 截断过长的 SQL
func truncateSQL(sql string, maxLen int) string {
	sql = strings.TrimSpace(sql)
	if len(sql) <= maxLen {
		return sql
	}
	return sql[:maxLen] + "..."
}

// formatArgs 格式化参数为 JSON
func formatArgs(args []interface{}) string {
	if len(args) == 0 {
		return ""
	}

	// 限制参数数量
	maxArgs := 10
	if len(args) > maxArgs {
		args = args[:maxArgs]
	}

	// 转换为安全格式
	safeArgs := make([]interface{}, len(args))
	for i, arg := range args {
		safeArgs[i] = formatArg(arg)
	}

	data, err := json.Marshal(safeArgs)
	if err != nil {
		return fmt.Sprintf("[%d args]", len(args))
	}

	// 限制长度
	if len(data) > 500 {
		return string(data[:500]) + "..."
	}

	return string(data)
}

// formatArg 格式化单个参数
func formatArg(arg interface{}) interface{} {
	if arg == nil {
		return nil
	}

	switch v := arg.(type) {
	case string:
		// 截断过长的字符串
		if len(v) > 100 {
			return v[:100] + "..."
		}
		return v
	case []byte:
		// 二进制数据显示为 [N bytes]
		return fmt.Sprintf("[%d bytes]", len(v))
	default:
		return v
	}
}

// DriverWrapper 数据库驱动包装器
// 用于拦截底层 SQL 查询
type DriverWrapper struct {
	QueryLogger *QueryLogger
}

// NewDriverWrapper 创建驱动包装器
func NewDriverWrapper(loggerSet *LoggerSet, slowThresholdMs int64) *DriverWrapper {
	return &DriverWrapper{
		QueryLogger: NewQueryLogger(loggerSet, slowThresholdMs),
	}
}
