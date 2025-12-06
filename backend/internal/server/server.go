package server

import (
	"context"
	"fmt"

	"zera/gen/base/baseconnect"
	"zera/internal/auth"
	"zera/internal/config"
	"zera/internal/database"
	"zera/internal/handler"
	"zera/internal/logger"
	"zera/internal/middleware"
	"zera/internal/permission"
	"zera/internal/service"
	"zera/internal/static"
	"zera/internal/storage"
	"zera/internal/telemetry"

	"buf.build/go/protovalidate"
	"connectrpc.com/connect"
	"github.com/gin-gonic/gin"
)

// Server HTTP 服务器
type Server struct {
	config        *config.Config
	engine        *gin.Engine
	db            *database.Database
	storage       *storage.Storage
	localStorage  *static.LocalStorage
	auditLogger   *logger.AsyncLogger
	globalLogger  *logger.GlobalLogger
	otelProvider  *telemetry.Provider
	otelLoggerSet *telemetry.LoggerSet
}

// New 创建服务器实例
func New(cfg *config.Config) (*Server, error) {
	// 初始化全局日志系统
	logCfg := &logger.LogConfig{
		Level:          logger.LogLevel(cfg.Log.Level),
		Format:         logger.LogFormat(cfg.Log.Format),
		Output:         cfg.Log.Output,
		AddSource:      cfg.Log.AddSource,
		ServiceName:    cfg.Log.ServiceName,
		ServiceVersion: cfg.Log.ServiceVersion,
		Environment:    cfg.Log.Environment,
	}
	globalLogger, err := logger.NewGlobalLogger(logCfg)
	if err != nil {
		return nil, fmt.Errorf("failed to initialize logger: %w", err)
	}

	// 获取 slog.Logger 实例供内部组件使用
	slogger := globalLogger.Logger()

	logger.Info("initializing server",
		"service", cfg.Log.ServiceName,
		"version", cfg.Log.ServiceVersion,
		"environment", cfg.Log.Environment,
	)

	// 初始化 OpenTelemetry 提供者
	var otelProvider *telemetry.Provider
	var otelLoggerSet *telemetry.LoggerSet
	if cfg.Telemetry.Enabled {
		logger.Info("initializing OpenTelemetry",
			"endpoint", cfg.Telemetry.Endpoint,
			"protocol", cfg.Telemetry.Protocol,
		)
		otelProvider, err = telemetry.NewProvider(&cfg.Telemetry, &cfg.Log)
		if err != nil {
			globalLogger.Close()
			return nil, fmt.Errorf("failed to initialize OpenTelemetry: %w", err)
		}
		otelLoggerSet = telemetry.NewLoggerSet(otelProvider)
		telemetry.InitGlobalLoggerSet(otelProvider)
		logger.Info("OpenTelemetry initialized successfully",
			"api_logs", cfg.Telemetry.Logs.APIEnabled,
			"app_logs", cfg.Telemetry.Logs.AppEnabled,
			"db_logs", cfg.Telemetry.Logs.DBEnabled,
		)
	} else {
		logger.Info("OpenTelemetry is disabled")
	}

	// 初始化数据库连接
	logger.Info("connecting to database", "host", cfg.Database.Host, "port", cfg.Database.Port)
	db, err := database.New(cfg)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to database: %w", err)
	}
	logger.Info("database connected successfully")

	// 开发模式下自动迁移
	if err := db.AutoMigrate(context.Background()); err != nil {
		db.Close()
		return nil, fmt.Errorf("failed to run auto migration: %w", err)
	}

	// 初始化系统角色
	if err := db.InitSystemRoles(context.Background()); err != nil {
		db.Close()
		return nil, fmt.Errorf("failed to init system roles: %w", err)
	}

	// 同步权限到数据库
	permSyncer := permission.NewSyncer(db.Client, slogger)
	if _, err := permSyncer.SyncPermissions(context.Background()); err != nil {
		db.Close()
		return nil, fmt.Errorf("failed to sync permissions: %w", err)
	}

	// 初始化管理员用户
	if err := db.InitAdminUser(context.Background()); err != nil {
		db.Close()
		return nil, fmt.Errorf("failed to init admin user: %w", err)
	}

	// 初始化对象存储服务
	storageClient, err := storage.New(&cfg.Storage, slogger)
	if err != nil {
		db.Close()
		return nil, fmt.Errorf("failed to init storage service: %w", err)
	}

	// 确保默认存储桶存在
	if err := storageClient.EnsureBucket(context.Background()); err != nil {
		db.Close()
		storageClient.Close()
		return nil, fmt.Errorf("failed to ensure storage bucket: %w", err)
	}

	// 初始化本地静态资源存储
	localStorage, err := static.NewLocalStorage(&cfg.Static)
	if err != nil {
		db.Close()
		storageClient.Close()
		return nil, fmt.Errorf("failed to init local storage: %w", err)
	}

	// 确保 Logo 目录存在
	if err := localStorage.EnsureLogoDir(); err != nil {
		logger.Warn("failed to ensure logo directory", "error", err)
	}

	// 创建验证器
	validator, err := protovalidate.New()
	if err != nil {
		db.Close()
		return nil, fmt.Errorf("failed to create validator: %w", err)
	}

	// 初始化 JWT 管理器
	jwtManager := auth.NewJWTManager(&cfg.JWT)

	// 初始化权限检查器
	permChecker := permission.NewChecker(db.Client)

	// 初始化审计日志记录器
	entLogger := logger.NewEntLogger(db.Client)
	asyncLogger := logger.NewAsyncLogger(entLogger, entLogger, slogger, nil)

	// 初始化服务层
	authService := service.NewAuthService(db.Client, jwtManager)
	userService := service.NewUserService(db.Client)
	roleService := service.NewRoleService(db.Client)
	auditLogService := service.NewAuditLogService(asyncLogger)
	systemSettingService := service.NewSystemSettingService(db.Client)
	casAuthService := service.NewCASAuthService(db.Client, jwtManager)

	// 初始化默认系统设置
	if err := systemSettingService.InitDefaultSettings(context.Background()); err != nil {
		db.Close()
		return nil, fmt.Errorf("failed to init system settings: %w", err)
	}

	// 初始化处理器
	authHandler := handler.NewAuthHandler(validator, authService, jwtManager)
	userHandler := handler.NewUserHandler(validator, userService)
	roleHandler := handler.NewRoleHandler(validator, roleService)
	auditLogHandler := handler.NewAuditLogHandler(validator, auditLogService)
	systemSettingHandler := handler.NewSystemSettingHandler(validator, systemSettingService)
	uploadHandler := handler.NewUploadHandler(localStorage, &cfg.Static, jwtManager, permChecker, systemSettingService)
	casAuthHandler := handler.NewCASAuthHandler(validator, casAuthService, jwtManager)

	// 创建权限拦截器（替代原来的认证拦截器）
	permInterceptor := middleware.NewPermissionInterceptor(jwtManager, permChecker)

	// 创建维护模式拦截器
	maintenanceInterceptor := middleware.NewMaintenanceInterceptor(db.Client)

	// 创建审计日志拦截器
	auditLogInterceptor := middleware.NewAuditLogInterceptor(asyncLogger)

	// 创建 Gin 引擎
	// 根据环境设置 Gin 模式
	if cfg.Log.Environment == "production" {
		gin.SetMode(gin.ReleaseMode)
	}
	engine := gin.New()

	// 注册中间件
	// 1. OpenTelemetry 追踪中间件（如果启用）
	if otelProvider != nil && otelProvider.IsEnabled() {
		engine.Use(telemetry.OtelGinMiddleware(otelProvider, otelLoggerSet))
	}
	// 2. 追踪中间件（生成 TraceID，保持向后兼容）
	engine.Use(middleware.TraceMiddleware())
	// 3. CORS 中间件
	engine.Use(middleware.CORS())
	// 4. 恢复中间件
	engine.Use(gin.Recovery())
	// 注意：RPC 请求日志由 LoggingInterceptor 记录，避免重复

	// 创建拦截器列表
	var interceptorList []connect.Interceptor

	// 1. OpenTelemetry 追踪拦截器（如果启用）
	if otelProvider != nil && otelProvider.IsEnabled() {
		otelTraceInterceptor := telemetry.NewOtelTraceInterceptor(otelProvider, otelLoggerSet)
		interceptorList = append(interceptorList, otelTraceInterceptor)
	}

	// 2. 追踪拦截器（保持向后兼容）
	traceInterceptor := middleware.NewTraceInterceptor()
	interceptorList = append(interceptorList, traceInterceptor)

	// 3. 日志拦截器
	loggingInterceptor := middleware.NewLoggingInterceptor()
	interceptorList = append(interceptorList, loggingInterceptor)

	// 4. 权限拦截器
	interceptorList = append(interceptorList, permInterceptor)

	// 5. 维护模式拦截器
	interceptorList = append(interceptorList, maintenanceInterceptor)

	// 6. 审计日志拦截器
	interceptorList = append(interceptorList, auditLogInterceptor)

	// 创建拦截器链
	interceptors := connect.WithInterceptors(interceptorList...)

	// 注册认证服务路由
	authPath, authH := baseconnect.NewAuthServiceHandler(
		authHandler,
		interceptors,
	)
	engine.Any(authPath+"*action", gin.WrapH(authH))

	// 注册用户管理服务路由
	userPath, userH := baseconnect.NewUserServiceHandler(
		userHandler,
		interceptors,
	)
	engine.Any(userPath+"*action", gin.WrapH(userH))

	// 注册角色管理服务路由
	rolePath, roleH := baseconnect.NewRoleServiceHandler(
		roleHandler,
		interceptors,
	)
	engine.Any(rolePath+"*action", gin.WrapH(roleH))

	// 注册审计日志服务路由
	auditLogPath, auditLogH := baseconnect.NewAuditLogServiceHandler(
		auditLogHandler,
		interceptors,
	)
	engine.Any(auditLogPath+"*action", gin.WrapH(auditLogH))

	// 注册系统设置服务路由
	systemSettingPath, systemSettingH := baseconnect.NewSystemSettingServiceHandler(
		systemSettingHandler,
		interceptors,
	)
	engine.Any(systemSettingPath+"*action", gin.WrapH(systemSettingH))

	// 注册 CAS 认证服务路由
	casAuthPath, casAuthH := baseconnect.NewCASAuthServiceHandler(
		casAuthHandler,
		interceptors,
	)
	engine.Any(casAuthPath+"*action", gin.WrapH(casAuthH))

	// 注册本地静态资源路由 (用于 Logo 等上传文件)
	engine.Static("/uploads/static", cfg.Static.UploadsDir)

	// 注册上传 API 路由
	api := engine.Group("/api")
	api.POST("/upload/logo", uploadHandler.UploadLogo)
	api.DELETE("/upload/logo", uploadHandler.DeleteLogo)

	// 注册 SPA 静态资源（生产环境）
	// 开发环境下 dist 目录可能不存在或为空，会优雅降级
	if frontendFS, err := static.GetFrontendFS(); err == nil {
		if err := static.RegisterSPA(engine, "/", frontendFS); err != nil {
			logger.Warn("failed to register SPA", "error", err)
		}
	}

	logger.Info("server initialized successfully")

	return &Server{
		config:        cfg,
		engine:        engine,
		db:            db,
		storage:       storageClient,
		localStorage:  localStorage,
		auditLogger:   asyncLogger,
		globalLogger:  globalLogger,
		otelProvider:  otelProvider,
		otelLoggerSet: otelLoggerSet,
	}, nil
}

// Run 启动服务器
func (s *Server) Run() error {
	addr := fmt.Sprintf("%s:%d", s.config.Server.Host, s.config.Server.Port)
	logger.Info("server starting",
		"address", addr,
		"host", s.config.Server.Host,
		"port", s.config.Server.Port,
	)
	return s.engine.Run(addr)
}

// Close 关闭服务器资源
func (s *Server) Close() error {
	logger.Info("shutting down server")

	// 关闭 OpenTelemetry 提供者
	if s.otelProvider != nil {
		ctx := context.Background()
		if err := s.otelProvider.Shutdown(ctx); err != nil {
			logger.Warn("failed to shutdown OpenTelemetry", "error", err)
		}
	}

	// 关闭审计日志记录器
	if s.auditLogger != nil {
		if err := s.auditLogger.Close(); err != nil {
			logger.Warn("failed to close audit logger", "error", err)
		}
	}

	// 关闭存储服务
	if s.storage != nil {
		if err := s.storage.Close(); err != nil {
			logger.Warn("failed to close storage", "error", err)
		}
	}

	// 关闭全局日志
	if s.globalLogger != nil {
		if err := s.globalLogger.Close(); err != nil {
			// 这里用 fmt 因为日志系统可能已经关闭
			fmt.Printf("Warning: failed to close global logger: %v\n", err)
		}
	}

	if s.db != nil {
		return s.db.Close()
	}
	return nil
}
