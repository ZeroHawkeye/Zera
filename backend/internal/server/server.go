package server

import (
	"context"
	"fmt"
	"log"
	"log/slog"
	"os"

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

	"buf.build/go/protovalidate"
	"connectrpc.com/connect"
	"github.com/gin-gonic/gin"
)

// Server HTTP 服务器
type Server struct {
	config      *config.Config
	engine      *gin.Engine
	db          *database.Database
	storage     *storage.Storage
	auditLogger *logger.AsyncLogger
}

// New 创建服务器实例
func New(cfg *config.Config) (*Server, error) {
	// 创建日志器
	slogger := slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelDebug,
	}))

	// 初始化数据库连接
	db, err := database.New(cfg)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to database: %w", err)
	}

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

	// 创建权限拦截器（替代原来的认证拦截器）
	permInterceptor := middleware.NewPermissionInterceptor(jwtManager, permChecker)

	// 创建维护模式拦截器
	maintenanceInterceptor := middleware.NewMaintenanceInterceptor(db.Client)

	// 创建审计日志拦截器
	auditLogInterceptor := middleware.NewAuditLogInterceptor(asyncLogger)

	// 创建 Gin 引擎
	engine := gin.Default()

	// 注册中间件
	engine.Use(middleware.CORS())

	// 创建拦截器链：权限拦截器 -> 维护模式拦截器 -> 审计日志拦截器
	interceptors := connect.WithInterceptors(permInterceptor, maintenanceInterceptor, auditLogInterceptor)

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

	// 注册 SPA 静态资源（生产环境）
	// 开发环境下 dist 目录可能不存在或为空，会优雅降级
	if frontendFS, err := static.GetFrontendFS(); err == nil {
		if err := static.RegisterSPA(engine, "/", frontendFS); err != nil {
			log.Printf("Warning: failed to register SPA: %v", err)
		}
	}

	return &Server{
		config:      cfg,
		engine:      engine,
		db:          db,
		storage:     storageClient,
		auditLogger: asyncLogger,
	}, nil
}

// Run 启动服务器
func (s *Server) Run() error {
	addr := fmt.Sprintf("%s:%d", s.config.Server.Host, s.config.Server.Port)
	log.Printf("Server starting on %s", addr)
	return s.engine.Run(addr)
}

// Close 关闭服务器资源
func (s *Server) Close() error {
	// 关闭审计日志记录器
	if s.auditLogger != nil {
		if err := s.auditLogger.Close(); err != nil {
			log.Printf("Warning: failed to close audit logger: %v", err)
		}
	}

	// 关闭存储服务
	if s.storage != nil {
		if err := s.storage.Close(); err != nil {
			log.Printf("Warning: failed to close storage: %v", err)
		}
	}

	if s.db != nil {
		return s.db.Close()
	}
	return nil
}
