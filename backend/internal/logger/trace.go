package logger

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"sync/atomic"
	"time"
)

// TraceIDGenerator 追踪ID生成器接口
type TraceIDGenerator interface {
	Generate() string
}

// DefaultTraceIDGenerator 默认追踪ID生成器
// 生成格式: {timestamp}-{random}-{counter}
// 例如: 20231204150405-a1b2c3d4-00001
type DefaultTraceIDGenerator struct {
	counter uint64
}

// NewDefaultTraceIDGenerator 创建默认追踪ID生成器
func NewDefaultTraceIDGenerator() *DefaultTraceIDGenerator {
	return &DefaultTraceIDGenerator{}
}

// Generate 生成追踪ID
func (g *DefaultTraceIDGenerator) Generate() string {
	// 时间戳部分
	timestamp := time.Now().Format("20060102150405")

	// 随机部分
	randomBytes := make([]byte, 4)
	if _, err := rand.Read(randomBytes); err != nil {
		// 如果随机数生成失败，使用计数器
		randomBytes = []byte{0, 0, 0, 0}
	}
	randomPart := hex.EncodeToString(randomBytes)

	// 计数器部分
	count := atomic.AddUint64(&g.counter, 1)

	return fmt.Sprintf("%s-%s-%05d", timestamp, randomPart, count%100000)
}

// UUIDTraceIDGenerator UUID格式的追踪ID生成器
// 生成标准的 UUID v4 格式
type UUIDTraceIDGenerator struct{}

// NewUUIDTraceIDGenerator 创建UUID追踪ID生成器
func NewUUIDTraceIDGenerator() *UUIDTraceIDGenerator {
	return &UUIDTraceIDGenerator{}
}

// Generate 生成UUID格式的追踪ID
func (g *UUIDTraceIDGenerator) Generate() string {
	uuid := make([]byte, 16)
	if _, err := rand.Read(uuid); err != nil {
		// 如果随机数生成失败，返回时间戳
		return fmt.Sprintf("%d", time.Now().UnixNano())
	}

	// 设置版本 (4) 和变体位
	uuid[6] = (uuid[6] & 0x0f) | 0x40
	uuid[8] = (uuid[8] & 0x3f) | 0x80

	return fmt.Sprintf("%x-%x-%x-%x-%x",
		uuid[0:4], uuid[4:6], uuid[6:8], uuid[8:10], uuid[10:16])
}

// W3CTraceIDGenerator W3C Trace Context 格式的追踪ID生成器
// 生成符合 OpenTelemetry 标准的 32 字符十六进制字符串
type W3CTraceIDGenerator struct{}

// NewW3CTraceIDGenerator 创建W3C格式追踪ID生成器
func NewW3CTraceIDGenerator() *W3CTraceIDGenerator {
	return &W3CTraceIDGenerator{}
}

// Generate 生成W3C格式的追踪ID (32字符十六进制)
func (g *W3CTraceIDGenerator) Generate() string {
	traceID := make([]byte, 16)
	if _, err := rand.Read(traceID); err != nil {
		// 如果随机数生成失败，使用时间戳填充
		now := time.Now().UnixNano()
		for i := 0; i < 16; i++ {
			traceID[i] = byte(now >> (i * 4))
		}
	}
	return hex.EncodeToString(traceID)
}

// GenerateSpanID 生成 Span ID (16字符十六进制)
func (g *W3CTraceIDGenerator) GenerateSpanID() string {
	spanID := make([]byte, 8)
	if _, err := rand.Read(spanID); err != nil {
		now := time.Now().UnixNano()
		for i := 0; i < 8; i++ {
			spanID[i] = byte(now >> (i * 8))
		}
	}
	return hex.EncodeToString(spanID)
}

// 全局追踪ID生成器实例
var globalTraceIDGenerator TraceIDGenerator = NewW3CTraceIDGenerator()

// SetTraceIDGenerator 设置全局追踪ID生成器
func SetTraceIDGenerator(gen TraceIDGenerator) {
	globalTraceIDGenerator = gen
}

// GenerateTraceID 使用全局生成器生成追踪ID
func GenerateTraceID() string {
	return globalTraceIDGenerator.Generate()
}

// GenerateSpanID 生成 Span ID
func GenerateSpanID() string {
	if gen, ok := globalTraceIDGenerator.(*W3CTraceIDGenerator); ok {
		return gen.GenerateSpanID()
	}
	// 回退到简单实现
	spanID := make([]byte, 8)
	if _, err := rand.Read(spanID); err != nil {
		return fmt.Sprintf("%d", time.Now().UnixNano())
	}
	return hex.EncodeToString(spanID)
}
