package service

import (
	"context"
	"time"

	"zera/internal/logger"
)

// AuditLogService 审计日志服务
type AuditLogService struct {
	logger logger.Logger
}

// NewAuditLogService 创建审计日志服务
func NewAuditLogService(l logger.Logger) *AuditLogService {
	return &AuditLogService{
		logger: l,
	}
}

// ListAuditLogs 获取日志列表
func (s *AuditLogService) ListAuditLogs(
	ctx context.Context,
	page, pageSize int,
	level logger.Level,
	module, action, username, ip, resource string,
	startTime, endTime *time.Time,
	keyword, sortBy string,
	descending bool,
) (*logger.QueryResult, error) {
	opts := logger.QueryOptions{
		Page:       page,
		PageSize:   pageSize,
		Level:      level,
		Module:     module,
		Action:     action,
		Username:   username,
		IP:         ip,
		Resource:   resource,
		StartTime:  startTime,
		EndTime:    endTime,
		Keyword:    keyword,
		SortBy:     sortBy,
		Descending: descending,
	}

	return s.logger.Query(ctx, opts)
}

// GetAuditLog 获取单条日志
func (s *AuditLogService) GetAuditLog(ctx context.Context, id string) (*logger.Entry, error) {
	return s.logger.Get(ctx, id)
}

// GetAuditLogStats 获取日志统计
func (s *AuditLogService) GetAuditLogStats(
	ctx context.Context,
	startTime, endTime time.Time,
) (*logger.Stats, error) {
	return s.logger.GetStats(ctx, startTime, endTime)
}

// GetModules 获取所有模块列表
func (s *AuditLogService) GetModules(ctx context.Context) ([]string, error) {
	return s.logger.GetModules(ctx)
}

// WriteLog 写入日志（供其他服务调用）
func (s *AuditLogService) WriteLog(ctx context.Context, entry *logger.Entry) error {
	return s.logger.Write(ctx, entry)
}
