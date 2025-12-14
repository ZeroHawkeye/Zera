package logger

import (
	"context"
	"strconv"
	"time"

	"zera/ent"
	"zera/ent/auditlog"
)

// EntLogger 基于 Ent ORM 的数据库日志实现
type EntLogger struct {
	client *ent.Client
}

// NewEntLogger 创建数据库日志记录器
func NewEntLogger(client *ent.Client) *EntLogger {
	return &EntLogger{client: client}
}

// Write 写入单条日志
func (l *EntLogger) Write(ctx context.Context, entry *Entry) error {
	create := l.client.AuditLog.Create().
		SetLevel(auditlog.Level(entry.Level)).
		SetModule(entry.Module).
		SetAction(entry.Action).
		SetNillableResource(nilIfEmpty(entry.Resource)).
		SetNillableResourceID(nilIfEmpty(entry.ResourceID)).
		SetNillableUserID(entry.UserID).
		SetNillableUsername(nilIfEmpty(entry.Username)).
		SetNillableIP(nilIfEmpty(entry.IP)).
		SetNillableUserAgent(nilIfEmpty(entry.UserAgent)).
		SetNillableMethod(nilIfEmpty(entry.Method)).
		SetNillablePath(nilIfEmpty(entry.Path)).
		SetNillableStatusCode(entry.StatusCode).
		SetNillableDurationMs(entry.DurationMs).
		SetNillableErrorMessage(nilIfEmpty(entry.ErrorMessage)).
		SetNillableRequestBody(nilIfEmpty(entry.RequestBody)).
		SetNillableResponseBody(nilIfEmpty(entry.ResponseBody)).
		SetNillableDetails(nilIfEmpty(entry.Details))

	if !entry.CreatedAt.IsZero() {
		create.SetCreatedAt(entry.CreatedAt)
	}

	_, err := create.Save(ctx)
	return err
}

// WriteBatch 批量写入日志
func (l *EntLogger) WriteBatch(ctx context.Context, entries []*Entry) error {
	bulk := make([]*ent.AuditLogCreate, 0, len(entries))
	for _, entry := range entries {
		create := l.client.AuditLog.Create().
			SetLevel(auditlog.Level(entry.Level)).
			SetModule(entry.Module).
			SetAction(entry.Action).
			SetNillableResource(nilIfEmpty(entry.Resource)).
			SetNillableResourceID(nilIfEmpty(entry.ResourceID)).
			SetNillableUserID(entry.UserID).
			SetNillableUsername(nilIfEmpty(entry.Username)).
			SetNillableIP(nilIfEmpty(entry.IP)).
			SetNillableUserAgent(nilIfEmpty(entry.UserAgent)).
			SetNillableMethod(nilIfEmpty(entry.Method)).
			SetNillablePath(nilIfEmpty(entry.Path)).
			SetNillableStatusCode(entry.StatusCode).
			SetNillableDurationMs(entry.DurationMs).
			SetNillableErrorMessage(nilIfEmpty(entry.ErrorMessage)).
			SetNillableRequestBody(nilIfEmpty(entry.RequestBody)).
			SetNillableResponseBody(nilIfEmpty(entry.ResponseBody)).
			SetNillableDetails(nilIfEmpty(entry.Details))

		if !entry.CreatedAt.IsZero() {
			create.SetCreatedAt(entry.CreatedAt)
		}

		bulk = append(bulk, create)
	}

	_, err := l.client.AuditLog.CreateBulk(bulk...).Save(ctx)
	return err
}

// Close 关闭日志记录器
func (l *EntLogger) Close() error {
	// 数据库连接由外部管理，这里不需要关闭
	return nil
}

// Query 查询日志
func (l *EntLogger) Query(ctx context.Context, opts QueryOptions) (*QueryResult, error) {
	query := l.client.AuditLog.Query()

	// 应用筛选条件
	if opts.Level != "" {
		query = query.Where(auditlog.LevelEQ(auditlog.Level(opts.Level)))
	}
	if opts.Module != "" {
		query = query.Where(auditlog.ModuleEQ(opts.Module))
	}
	if opts.Action != "" {
		query = query.Where(auditlog.ActionEQ(opts.Action))
	}
	if opts.Username != "" {
		query = query.Where(auditlog.UsernameContains(opts.Username))
	}
	if opts.IP != "" {
		query = query.Where(auditlog.IPEQ(opts.IP))
	}
	if opts.Resource != "" {
		query = query.Where(auditlog.ResourceEQ(opts.Resource))
	}
	if opts.StartTime != nil {
		query = query.Where(auditlog.CreatedAtGTE(*opts.StartTime))
	}
	if opts.EndTime != nil {
		query = query.Where(auditlog.CreatedAtLTE(*opts.EndTime))
	}
	if opts.Keyword != "" {
		query = query.Where(
			auditlog.Or(
				auditlog.ModuleContains(opts.Keyword),
				auditlog.ActionContains(opts.Keyword),
				auditlog.UsernameContains(opts.Keyword),
				auditlog.DetailsContains(opts.Keyword),
				auditlog.ErrorMessageContains(opts.Keyword),
			),
		)
	}

	// 获取总数
	total, err := query.Clone().Count(ctx)
	if err != nil {
		return nil, err
	}

	// 应用排序
	if opts.SortBy != "" {
		if opts.Descending {
			query = query.Order(ent.Desc(opts.SortBy))
		} else {
			query = query.Order(ent.Asc(opts.SortBy))
		}
	} else {
		// 默认按创建时间降序
		query = query.Order(ent.Desc(auditlog.FieldCreatedAt))
	}

	// 应用分页
	if opts.Page > 0 && opts.PageSize > 0 {
		offset := (opts.Page - 1) * opts.PageSize
		query = query.Offset(offset).Limit(opts.PageSize)
	}

	// 执行查询
	logs, err := query.All(ctx)
	if err != nil {
		return nil, err
	}

	// 转换为 Entry
	entries := make([]*Entry, 0, len(logs))
	for _, log := range logs {
		entries = append(entries, l.toEntry(log))
	}

	return &QueryResult{
		Entries:  entries,
		Total:    int64(total),
		Page:     opts.Page,
		PageSize: opts.PageSize,
	}, nil
}

// Get 获取单条日志
func (l *EntLogger) Get(ctx context.Context, id string) (*Entry, error) {
	logID, err := strconv.Atoi(id)
	if err != nil {
		return nil, err
	}

	log, err := l.client.AuditLog.Get(ctx, logID)
	if err != nil {
		return nil, err
	}

	return l.toEntry(log), nil
}

// GetStats 获取统计信息
func (l *EntLogger) GetStats(ctx context.Context, startTime, endTime time.Time) (*Stats, error) {
	query := l.client.AuditLog.Query()

	if !startTime.IsZero() {
		query = query.Where(auditlog.CreatedAtGTE(startTime))
	}
	if !endTime.IsZero() {
		query = query.Where(auditlog.CreatedAtLTE(endTime))
	}

	// 获取总数
	total, err := query.Clone().Count(ctx)
	if err != nil {
		return nil, err
	}

	// 获取各级别日志数量
	levelCounts := make(map[Level]int64)
	for _, level := range []Level{LevelDebug, LevelInfo, LevelWarning, LevelError} {
		count, err := query.Clone().Where(auditlog.LevelEQ(auditlog.Level(level))).Count(ctx)
		if err != nil {
			return nil, err
		}
		levelCounts[level] = int64(count)
	}

	// 获取各模块日志数量
	moduleCounts := make(map[string]int64)
	modules, err := l.GetModules(ctx)
	if err != nil {
		return nil, err
	}
	for _, module := range modules {
		count, err := query.Clone().Where(auditlog.ModuleEQ(module)).Count(ctx)
		if err != nil {
			return nil, err
		}
		moduleCounts[module] = int64(count)
	}

	// TODO: 获取各操作日志数量（可选优化）
	actionCounts := make(map[string]int64)

	return &Stats{
		Total:        int64(total),
		LevelCounts:  levelCounts,
		ModuleCounts: moduleCounts,
		ActionCounts: actionCounts,
	}, nil
}

// GetModules 获取所有模块列表
func (l *EntLogger) GetModules(ctx context.Context) ([]string, error) {
	// 使用 GROUP BY 查询所有不同的模块
	logs, err := l.client.AuditLog.Query().
		Unique(true).
		Select(auditlog.FieldModule).
		All(ctx)
	if err != nil {
		return nil, err
	}

	modules := make([]string, 0, len(logs))
	seen := make(map[string]bool)
	for _, log := range logs {
		if !seen[log.Module] {
			seen[log.Module] = true
			modules = append(modules, log.Module)
		}
	}

	return modules, nil
}

// toEntry 将 ent.AuditLog 转换为 Entry
func (l *EntLogger) toEntry(log *ent.AuditLog) *Entry {
	entry := &Entry{
		Level:     Level(log.Level),
		Module:    log.Module,
		Action:    log.Action,
		Username:  log.Username,
		IP:        log.IP,
		UserAgent: log.UserAgent,
		Method:    log.Method,
		Path:      log.Path,
		CreatedAt: log.CreatedAt,
	}

	// 可选字段
	if log.Resource != "" {
		entry.Resource = log.Resource
	}
	if log.ResourceID != "" {
		entry.ResourceID = log.ResourceID
	}
	if log.UserID != nil {
		entry.UserID = log.UserID
	}
	if log.StatusCode != nil {
		entry.StatusCode = log.StatusCode
	}
	if log.DurationMs != nil {
		entry.DurationMs = log.DurationMs
	}
	if log.ErrorMessage != "" {
		entry.ErrorMessage = log.ErrorMessage
	}
	if log.RequestBody != "" {
		entry.RequestBody = log.RequestBody
	}
	if log.ResponseBody != "" {
		entry.ResponseBody = log.ResponseBody
	}
	// Details 优先使用数据库中存储的 details 字段
	// 如果没有则使用 request_body 作为详细信息（便于前端查看请求内容）
	if log.Details != "" {
		entry.Details = log.Details
	} else if log.RequestBody != "" {
		entry.Details = log.RequestBody
	}

	return entry
}

// EntryWithID 返回带有 ID 的 Entry（用于返回给前端）
type EntryWithID struct {
	ID string
	*Entry
}

// ToEntryWithID 转换为带 ID 的条目
func (l *EntLogger) ToEntryWithID(log *ent.AuditLog) *EntryWithID {
	return &EntryWithID{
		ID:    strconv.Itoa(log.ID),
		Entry: l.toEntry(log),
	}
}

// nilIfEmpty 如果字符串为空则返回 nil
func nilIfEmpty(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}
