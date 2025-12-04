package logger

import (
	"context"
	"sync"
	"time"
)

// AsyncLogger 异步日志记录器，用于高并发场景
// 通过缓冲通道和批量写入提高性能
type AsyncLogger struct {
	writer    Writer
	reader    Reader
	entryChan chan *Entry
	wg        sync.WaitGroup
	closed    bool
	mu        sync.RWMutex

	// 配置选项
	batchSize     int
	flushInterval time.Duration
}

// AsyncLoggerConfig 异步日志记录器配置
type AsyncLoggerConfig struct {
	// BufferSize 缓冲区大小
	BufferSize int
	// BatchSize 批量写入大小
	BatchSize int
	// FlushInterval 刷新间隔
	FlushInterval time.Duration
}

// DefaultAsyncLoggerConfig 默认配置
var DefaultAsyncLoggerConfig = AsyncLoggerConfig{
	BufferSize:    1000,
	BatchSize:     100,
	FlushInterval: 5 * time.Second,
}

// NewAsyncLogger 创建异步日志记录器
// 注意: logger 参数已废弃，现在使用全局日志系统
func NewAsyncLogger(writer Writer, reader Reader, _ interface{}, cfg *AsyncLoggerConfig) *AsyncLogger {
	if cfg == nil {
		cfg = &DefaultAsyncLoggerConfig
	}

	l := &AsyncLogger{
		writer:        writer,
		reader:        reader,
		entryChan:     make(chan *Entry, cfg.BufferSize),
		batchSize:     cfg.BatchSize,
		flushInterval: cfg.FlushInterval,
	}

	// 启动后台写入 goroutine
	l.wg.Add(1)
	go l.processEntries()

	return l
}

// Write 异步写入日志
func (l *AsyncLogger) Write(ctx context.Context, entry *Entry) error {
	l.mu.RLock()
	defer l.mu.RUnlock()

	if l.closed {
		return nil
	}

	select {
	case l.entryChan <- entry:
		return nil
	default:
		// 通道已满，同步写入
		Warn("audit log buffer full, writing synchronously")
		return l.writer.Write(ctx, entry)
	}
}

// WriteBatch 批量写入（直接调用底层 writer）
func (l *AsyncLogger) WriteBatch(ctx context.Context, entries []*Entry) error {
	return l.writer.WriteBatch(ctx, entries)
}

// Close 关闭异步日志记录器
func (l *AsyncLogger) Close() error {
	l.mu.Lock()
	l.closed = true
	l.mu.Unlock()

	close(l.entryChan)
	l.wg.Wait()

	return l.writer.Close()
}

// Query 查询日志
func (l *AsyncLogger) Query(ctx context.Context, opts QueryOptions) (*QueryResult, error) {
	return l.reader.Query(ctx, opts)
}

// Get 获取单条日志
func (l *AsyncLogger) Get(ctx context.Context, id string) (*Entry, error) {
	return l.reader.Get(ctx, id)
}

// GetStats 获取统计信息
func (l *AsyncLogger) GetStats(ctx context.Context, startTime, endTime time.Time) (*Stats, error) {
	return l.reader.GetStats(ctx, startTime, endTime)
}

// GetModules 获取所有模块列表
func (l *AsyncLogger) GetModules(ctx context.Context) ([]string, error) {
	return l.reader.GetModules(ctx)
}

// processEntries 后台处理日志条目
func (l *AsyncLogger) processEntries() {
	defer l.wg.Done()

	batch := make([]*Entry, 0, l.batchSize)
	ticker := time.NewTicker(l.flushInterval)
	defer ticker.Stop()

	flush := func() {
		if len(batch) == 0 {
			return
		}

		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		if err := l.writer.WriteBatch(ctx, batch); err != nil {
			Error("failed to write audit logs", "error", err, "count", len(batch))
		}

		batch = batch[:0]
	}

	for {
		select {
		case entry, ok := <-l.entryChan:
			if !ok {
				// 通道已关闭，刷新剩余日志
				flush()
				return
			}

			batch = append(batch, entry)
			if len(batch) >= l.batchSize {
				flush()
			}

		case <-ticker.C:
			flush()
		}
	}
}
