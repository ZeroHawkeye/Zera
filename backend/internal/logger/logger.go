// Package logger 提供可扩展的日志记录抽象层，支持多种日志存储后端（数据库、Elasticsearch等）
package logger

import (
	"context"
	"time"
)

// Level 日志级别
type Level string

const (
	LevelDebug   Level = "debug"
	LevelInfo    Level = "info"
	LevelWarning Level = "warning"
	LevelError   Level = "error"
)

// Entry 日志条目
type Entry struct {
	// Level 日志级别
	Level Level
	// Module 模块名称（如 user, role, auth）
	Module string
	// Action 操作名称（如 login, create, delete）
	Action string
	// Resource 资源类型
	Resource string
	// ResourceID 资源ID
	ResourceID string
	// UserID 操作用户ID
	UserID *int
	// Username 操作用户名
	Username string
	// IP 客户端IP地址
	IP string
	// UserAgent 用户代理
	UserAgent string
	// Method 请求方法
	Method string
	// Path 请求路径
	Path string
	// StatusCode 响应状态码
	StatusCode *int
	// DurationMs 请求耗时(毫秒)
	DurationMs *int64
	// ErrorMessage 错误信息
	ErrorMessage string
	// RequestBody 请求体(敏感信息已脱敏)
	RequestBody string
	// ResponseBody 响应体
	ResponseBody string
	// Details 详细信息(JSON格式)
	Details string
	// CreatedAt 创建时间
	CreatedAt time.Time
}

// Writer 日志写入器接口
// 实现此接口以支持不同的日志存储后端
type Writer interface {
	// Write 写入单条日志
	Write(ctx context.Context, entry *Entry) error
	// WriteBatch 批量写入日志（用于高并发场景）
	WriteBatch(ctx context.Context, entries []*Entry) error
	// Close 关闭写入器，释放资源
	Close() error
}

// Reader 日志读取器接口
// 实现此接口以支持不同的日志查询后端
type Reader interface {
	// Query 查询日志
	Query(ctx context.Context, opts QueryOptions) (*QueryResult, error)
	// Get 获取单条日志
	Get(ctx context.Context, id string) (*Entry, error)
	// GetStats 获取统计信息
	GetStats(ctx context.Context, startTime, endTime time.Time) (*Stats, error)
	// GetModules 获取所有模块列表
	GetModules(ctx context.Context) ([]string, error)
}

// QueryOptions 查询选项
type QueryOptions struct {
	// Page 页码（从1开始）
	Page int
	// PageSize 每页数量
	PageSize int
	// Level 日志级别筛选
	Level Level
	// Module 模块筛选
	Module string
	// Action 操作筛选
	Action string
	// Username 用户名筛选
	Username string
	// IP IP地址筛选
	IP string
	// Resource 资源类型筛选
	Resource string
	// StartTime 开始时间
	StartTime *time.Time
	// EndTime 结束时间
	EndTime *time.Time
	// Keyword 搜索关键词
	Keyword string
	// SortBy 排序字段
	SortBy string
	// Descending 是否降序
	Descending bool
}

// QueryResult 查询结果
type QueryResult struct {
	// Entries 日志条目列表
	Entries []*Entry
	// Total 总数
	Total int64
	// Page 当前页码
	Page int
	// PageSize 每页数量
	PageSize int
}

// Stats 日志统计
type Stats struct {
	// Total 总日志数
	Total int64
	// LevelCounts 各级别日志数量
	LevelCounts map[Level]int64
	// ModuleCounts 各模块日志数量
	ModuleCounts map[string]int64
	// ActionCounts 各操作日志数量
	ActionCounts map[string]int64
}

// Logger 审计日志记录器
// 组合 Writer 和 Reader 接口
type Logger interface {
	Writer
	Reader
}
