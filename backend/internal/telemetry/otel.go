// Package telemetry 提供 OpenTelemetry 集成，支持将日志、追踪、指标发送到 SigNoz
package telemetry

import (
	"context"
	"fmt"
	"runtime"
	"time"

	"zera/internal/config"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/exporters/otlp/otlplog/otlploggrpc"
	"go.opentelemetry.io/otel/exporters/otlp/otlpmetric/otlpmetricgrpc"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc"
	"go.opentelemetry.io/otel/log/global"
	"go.opentelemetry.io/otel/metric"
	"go.opentelemetry.io/otel/propagation"
	sdklog "go.opentelemetry.io/otel/sdk/log"
	sdkmetric "go.opentelemetry.io/otel/sdk/metric"
	"go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	semconv "go.opentelemetry.io/otel/semconv/v1.26.0"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
)

// Provider OpenTelemetry 提供者
type Provider struct {
	config         *config.TelemetryConfig
	logConfig      *config.LogConfig
	tracerProvider *sdktrace.TracerProvider
	loggerProvider *sdklog.LoggerProvider
	meterProvider  *sdkmetric.MeterProvider
	conn           *grpc.ClientConn
	stopMetrics    chan struct{}
}

// NewProvider 创建 OpenTelemetry 提供者
func NewProvider(cfg *config.TelemetryConfig, logCfg *config.LogConfig) (*Provider, error) {
	if !cfg.Enabled {
		return &Provider{config: cfg, logConfig: logCfg}, nil
	}

	ctx := context.Background()

	// 创建 gRPC 连接
	var opts []grpc.DialOption
	if cfg.Insecure {
		opts = append(opts, grpc.WithTransportCredentials(insecure.NewCredentials()))
	}

	conn, err := grpc.NewClient(cfg.Endpoint, opts...)
	if err != nil {
		return nil, fmt.Errorf("failed to create gRPC connection to %s: %w", cfg.Endpoint, err)
	}

	// 创建资源
	res, err := newResource(logCfg)
	if err != nil {
		conn.Close()
		return nil, fmt.Errorf("failed to create resource: %w", err)
	}

	// 创建追踪提供者
	tracerProvider, err := newTracerProvider(ctx, conn, res, cfg)
	if err != nil {
		conn.Close()
		return nil, fmt.Errorf("failed to create tracer provider: %w", err)
	}

	// 创建日志提供者
	loggerProvider, err := newLoggerProvider(ctx, conn, res, cfg)
	if err != nil {
		tracerProvider.Shutdown(ctx)
		conn.Close()
		return nil, fmt.Errorf("failed to create logger provider: %w", err)
	}

	// 创建指标提供者
	meterProvider, err := newMeterProvider(ctx, conn, res, cfg)
	if err != nil {
		loggerProvider.Shutdown(ctx)
		tracerProvider.Shutdown(ctx)
		conn.Close()
		return nil, fmt.Errorf("failed to create meter provider: %w", err)
	}

	// 设置全局提供者
	otel.SetTracerProvider(tracerProvider)
	otel.SetMeterProvider(meterProvider)
	otel.SetTextMapPropagator(propagation.NewCompositeTextMapPropagator(
		propagation.TraceContext{},
		propagation.Baggage{},
	))
	global.SetLoggerProvider(loggerProvider)

	provider := &Provider{
		config:         cfg,
		logConfig:      logCfg,
		tracerProvider: tracerProvider,
		loggerProvider: loggerProvider,
		meterProvider:  meterProvider,
		conn:           conn,
		stopMetrics:    make(chan struct{}),
	}

	// 启动运行时指标收集
	go provider.collectRuntimeMetrics()

	return provider, nil
}

// newResource 创建资源描述
func newResource(logCfg *config.LogConfig) (*resource.Resource, error) {
	return resource.New(
		context.Background(),
		resource.WithAttributes(
			semconv.ServiceName(logCfg.ServiceName),
			semconv.ServiceVersion(logCfg.ServiceVersion),
			semconv.DeploymentEnvironmentKey.String(logCfg.Environment),
			attribute.String("service.namespace", "zera"),
		),
		resource.WithHost(),
		resource.WithOS(),
		resource.WithProcess(),
	)
}

// newTracerProvider 创建追踪提供者
func newTracerProvider(ctx context.Context, conn *grpc.ClientConn, res *resource.Resource, cfg *config.TelemetryConfig) (*sdktrace.TracerProvider, error) {
	exporter, err := otlptracegrpc.New(ctx, otlptracegrpc.WithGRPCConn(conn))
	if err != nil {
		return nil, fmt.Errorf("failed to create trace exporter: %w", err)
	}

	// 配置采样率
	var sampler sdktrace.Sampler
	if cfg.TraceSampleRate >= 1.0 {
		sampler = sdktrace.AlwaysSample()
	} else if cfg.TraceSampleRate <= 0 {
		sampler = sdktrace.NeverSample()
	} else {
		sampler = sdktrace.TraceIDRatioBased(cfg.TraceSampleRate)
	}

	tp := sdktrace.NewTracerProvider(
		sdktrace.WithBatcher(exporter),
		sdktrace.WithResource(res),
		sdktrace.WithSampler(sampler),
	)

	return tp, nil
}

// newLoggerProvider 创建日志提供者
func newLoggerProvider(ctx context.Context, conn *grpc.ClientConn, res *resource.Resource, cfg *config.TelemetryConfig) (*sdklog.LoggerProvider, error) {
	exporter, err := otlploggrpc.New(ctx, otlploggrpc.WithGRPCConn(conn))
	if err != nil {
		return nil, fmt.Errorf("failed to create log exporter: %w", err)
	}

	// 配置批量处理
	batchInterval := time.Duration(cfg.LogBatchInterval) * time.Second
	if batchInterval <= 0 {
		batchInterval = 5 * time.Second
	}

	batchSize := cfg.LogBatchSize
	if batchSize <= 0 {
		batchSize = 512
	}

	lp := sdklog.NewLoggerProvider(
		sdklog.WithProcessor(
			sdklog.NewBatchProcessor(
				exporter,
				sdklog.WithExportInterval(batchInterval),
				sdklog.WithExportMaxBatchSize(batchSize),
			),
		),
		sdklog.WithResource(res),
	)

	return lp, nil
}

// newMeterProvider 创建指标提供者
func newMeterProvider(ctx context.Context, conn *grpc.ClientConn, res *resource.Resource, cfg *config.TelemetryConfig) (*sdkmetric.MeterProvider, error) {
	exporter, err := otlpmetricgrpc.New(ctx, otlpmetricgrpc.WithGRPCConn(conn))
	if err != nil {
		return nil, fmt.Errorf("failed to create metric exporter: %w", err)
	}

	mp := sdkmetric.NewMeterProvider(
		sdkmetric.WithReader(
			sdkmetric.NewPeriodicReader(
				exporter,
				sdkmetric.WithInterval(15*time.Second), // 每 15 秒导出一次指标
			),
		),
		sdkmetric.WithResource(res),
	)

	return mp, nil
}

// collectRuntimeMetrics 收集运行时指标
func (p *Provider) collectRuntimeMetrics() {
	if p.meterProvider == nil {
		return
	}

	meter := p.meterProvider.Meter("zera.runtime")

	// 创建指标
	cpuGauge, _ := meter.Float64ObservableGauge(
		"process.runtime.go.goroutines",
		metric.WithDescription("Number of goroutines"),
	)

	memAllocGauge, _ := meter.Int64ObservableGauge(
		"process.runtime.go.mem.heap_alloc",
		metric.WithDescription("Bytes of allocated heap objects"),
		metric.WithUnit("By"),
	)

	memTotalAllocGauge, _ := meter.Int64ObservableGauge(
		"process.runtime.go.mem.heap_sys",
		metric.WithDescription("Bytes of heap memory obtained from the OS"),
		metric.WithUnit("By"),
	)

	gcCountGauge, _ := meter.Int64ObservableGauge(
		"process.runtime.go.gc.count",
		metric.WithDescription("Number of completed GC cycles"),
	)

	gcPauseGauge, _ := meter.Int64ObservableGauge(
		"process.runtime.go.gc.pause_total_ns",
		metric.WithDescription("Cumulative nanoseconds in GC stop-the-world pauses"),
		metric.WithUnit("ns"),
	)

	// 注册回调
	_, _ = meter.RegisterCallback(
		func(_ context.Context, o metric.Observer) error {
			var ms runtime.MemStats
			runtime.ReadMemStats(&ms)

			o.ObserveFloat64(cpuGauge, float64(runtime.NumGoroutine()))
			o.ObserveInt64(memAllocGauge, int64(ms.HeapAlloc))
			o.ObserveInt64(memTotalAllocGauge, int64(ms.HeapSys))
			o.ObserveInt64(gcCountGauge, int64(ms.NumGC))
			o.ObserveInt64(gcPauseGauge, int64(ms.PauseTotalNs))

			return nil
		},
		cpuGauge,
		memAllocGauge,
		memTotalAllocGauge,
		gcCountGauge,
		gcPauseGauge,
	)
}

// TracerProvider 返回追踪提供者
func (p *Provider) TracerProvider() *sdktrace.TracerProvider {
	return p.tracerProvider
}

// LoggerProvider 返回日志提供者
func (p *Provider) LoggerProvider() *sdklog.LoggerProvider {
	return p.loggerProvider
}

// IsEnabled 返回是否启用遥测
func (p *Provider) IsEnabled() bool {
	return p.config.Enabled
}

// Config 返回遥测配置
func (p *Provider) Config() *config.TelemetryConfig {
	return p.config
}

// MeterProvider 返回指标提供者
func (p *Provider) MeterProvider() *sdkmetric.MeterProvider {
	return p.meterProvider
}

// Shutdown 关闭所有提供者
func (p *Provider) Shutdown(ctx context.Context) error {
	if !p.config.Enabled {
		return nil
	}

	// 停止指标收集
	if p.stopMetrics != nil {
		close(p.stopMetrics)
	}

	var errs []error

	if p.meterProvider != nil {
		if err := p.meterProvider.Shutdown(ctx); err != nil {
			errs = append(errs, fmt.Errorf("failed to shutdown meter provider: %w", err))
		}
	}

	if p.loggerProvider != nil {
		if err := p.loggerProvider.Shutdown(ctx); err != nil {
			errs = append(errs, fmt.Errorf("failed to shutdown logger provider: %w", err))
		}
	}

	if p.tracerProvider != nil {
		if err := p.tracerProvider.Shutdown(ctx); err != nil {
			errs = append(errs, fmt.Errorf("failed to shutdown tracer provider: %w", err))
		}
	}

	if p.conn != nil {
		if err := p.conn.Close(); err != nil {
			errs = append(errs, fmt.Errorf("failed to close gRPC connection: %w", err))
		}
	}

	if len(errs) > 0 {
		return fmt.Errorf("shutdown errors: %v", errs)
	}

	return nil
}
