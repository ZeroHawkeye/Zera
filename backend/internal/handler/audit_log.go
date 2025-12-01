package handler

import (
	"context"
	"errors"
	"strconv"
	"time"

	"zera/gen/base"
	"zera/gen/base/baseconnect"
	"zera/internal/logger"
	"zera/internal/service"

	"buf.build/go/protovalidate"
	"connectrpc.com/connect"
)

// AuditLogHandler 审计日志处理器
type AuditLogHandler struct {
	baseconnect.UnimplementedAuditLogServiceHandler
	validator       protovalidate.Validator
	auditLogService *service.AuditLogService
}

// NewAuditLogHandler 创建审计日志处理器
func NewAuditLogHandler(
	validator protovalidate.Validator,
	auditLogService *service.AuditLogService,
) *AuditLogHandler {
	return &AuditLogHandler{
		validator:       validator,
		auditLogService: auditLogService,
	}
}

// ListAuditLogs 获取日志列表
func (h *AuditLogHandler) ListAuditLogs(
	ctx context.Context,
	req *connect.Request[base.ListAuditLogsRequest],
) (*connect.Response[base.ListAuditLogsResponse], error) {
	// 验证请求
	if err := h.validator.Validate(req.Msg); err != nil {
		return nil, connect.NewError(connect.CodeInvalidArgument, err)
	}

	// 解析时间范围
	var startTime, endTime *time.Time
	if req.Msg.StartTime != "" {
		t, err := time.Parse(time.RFC3339, req.Msg.StartTime)
		if err == nil {
			startTime = &t
		}
	}
	if req.Msg.EndTime != "" {
		t, err := time.Parse(time.RFC3339, req.Msg.EndTime)
		if err == nil {
			endTime = &t
		}
	}

	// 转换日志级别
	var level logger.Level
	switch req.Msg.Level {
	case base.LogLevel_LOG_LEVEL_DEBUG:
		level = logger.LevelDebug
	case base.LogLevel_LOG_LEVEL_INFO:
		level = logger.LevelInfo
	case base.LogLevel_LOG_LEVEL_WARNING:
		level = logger.LevelWarning
	case base.LogLevel_LOG_LEVEL_ERROR:
		level = logger.LevelError
	}

	// 调用服务层
	result, err := h.auditLogService.ListAuditLogs(
		ctx,
		int(req.Msg.Page),
		int(req.Msg.PageSize),
		level,
		req.Msg.Module,
		req.Msg.Action,
		req.Msg.Username,
		req.Msg.Ip,
		req.Msg.Resource,
		startTime,
		endTime,
		req.Msg.Keyword,
		req.Msg.SortBy,
		req.Msg.Descending,
	)
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, errors.New("获取日志列表失败"))
	}

	// 转换为 proto 响应
	logs := make([]*base.AuditLogEntry, 0, len(result.Entries))
	for idx, entry := range result.Entries {
		logs = append(logs, h.entryToProto(entry, idx))
	}

	return connect.NewResponse(&base.ListAuditLogsResponse{
		Logs:     logs,
		Total:    result.Total,
		Page:     int32(result.Page),
		PageSize: int32(result.PageSize),
	}), nil
}

// GetAuditLog 获取日志详情
func (h *AuditLogHandler) GetAuditLog(
	ctx context.Context,
	req *connect.Request[base.GetAuditLogRequest],
) (*connect.Response[base.GetAuditLogResponse], error) {
	// 验证请求
	if err := h.validator.Validate(req.Msg); err != nil {
		return nil, connect.NewError(connect.CodeInvalidArgument, err)
	}

	entry, err := h.auditLogService.GetAuditLog(ctx, req.Msg.Id)
	if err != nil {
		return nil, connect.NewError(connect.CodeNotFound, errors.New("日志不存在"))
	}

	return connect.NewResponse(&base.GetAuditLogResponse{
		Log: h.entryToProtoWithID(entry, req.Msg.Id),
	}), nil
}

// GetAuditLogStats 获取日志统计
func (h *AuditLogHandler) GetAuditLogStats(
	ctx context.Context,
	req *connect.Request[base.GetAuditLogStatsRequest],
) (*connect.Response[base.GetAuditLogStatsResponse], error) {
	// 解析时间范围
	var startTime, endTime time.Time
	if req.Msg.StartTime != "" {
		t, err := time.Parse(time.RFC3339, req.Msg.StartTime)
		if err == nil {
			startTime = t
		}
	}
	if req.Msg.EndTime != "" {
		t, err := time.Parse(time.RFC3339, req.Msg.EndTime)
		if err == nil {
			endTime = t
		}
	}

	stats, err := h.auditLogService.GetAuditLogStats(ctx, startTime, endTime)
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, errors.New("获取日志统计失败"))
	}

	// 转换 level counts
	levelCounts := make(map[string]int64)
	for level, count := range stats.LevelCounts {
		levelCounts[string(level)] = count
	}

	return connect.NewResponse(&base.GetAuditLogStatsResponse{
		Total:        stats.Total,
		LevelCounts:  levelCounts,
		ModuleCounts: stats.ModuleCounts,
		ActionCounts: stats.ActionCounts,
	}), nil
}

// ListAuditLogModules 获取可用模块列表
func (h *AuditLogHandler) ListAuditLogModules(
	ctx context.Context,
	req *connect.Request[base.ListAuditLogModulesRequest],
) (*connect.Response[base.ListAuditLogModulesResponse], error) {
	modules, err := h.auditLogService.GetModules(ctx)
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, errors.New("获取模块列表失败"))
	}

	return connect.NewResponse(&base.ListAuditLogModulesResponse{
		Modules: modules,
	}), nil
}

// entryToProto 将 logger.Entry 转换为 proto 消息
func (h *AuditLogHandler) entryToProto(entry *logger.Entry, idx int) *base.AuditLogEntry {
	protoEntry := &base.AuditLogEntry{
		Id:        strconv.Itoa(idx), // 临时 ID，实际应从数据库获取
		Module:    entry.Module,
		Action:    entry.Action,
		Resource:  entry.Resource,
		Username:  entry.Username,
		Ip:        entry.IP,
		UserAgent: entry.UserAgent,
		Method:    entry.Method,
		Path:      entry.Path,
		Details:   entry.Details,
		CreatedAt: entry.CreatedAt.Format(time.RFC3339),
	}

	// 转换日志级别
	switch entry.Level {
	case logger.LevelDebug:
		protoEntry.Level = base.LogLevel_LOG_LEVEL_DEBUG
	case logger.LevelInfo:
		protoEntry.Level = base.LogLevel_LOG_LEVEL_INFO
	case logger.LevelWarning:
		protoEntry.Level = base.LogLevel_LOG_LEVEL_WARNING
	case logger.LevelError:
		protoEntry.Level = base.LogLevel_LOG_LEVEL_ERROR
	}

	// 可选字段
	if entry.ResourceID != "" {
		protoEntry.ResourceId = entry.ResourceID
	}
	if entry.UserID != nil {
		protoEntry.UserId = strconv.Itoa(*entry.UserID)
	}
	if entry.StatusCode != nil {
		protoEntry.StatusCode = int32(*entry.StatusCode)
	}
	if entry.DurationMs != nil {
		protoEntry.DurationMs = *entry.DurationMs
	}
	if entry.ErrorMessage != "" {
		protoEntry.ErrorMessage = entry.ErrorMessage
	}

	return protoEntry
}

// entryToProtoWithID 将 logger.Entry 转换为带 ID 的 proto 消息
func (h *AuditLogHandler) entryToProtoWithID(entry *logger.Entry, id string) *base.AuditLogEntry {
	protoEntry := h.entryToProto(entry, 0)
	protoEntry.Id = id
	return protoEntry
}
