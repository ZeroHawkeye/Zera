package server

import (
	"fmt"
	"log"

	"zera/gen/greet/v1/greetv1connect"
	"zera/internal/config"
	"zera/internal/handler"
	"zera/internal/middleware"
	"zera/internal/service"
	"zera/internal/static"

	"buf.build/go/protovalidate"
	"github.com/gin-gonic/gin"
)

// Server HTTP 服务器
type Server struct {
	config *config.Config
	engine *gin.Engine
}

// New 创建服务器实例
func New(cfg *config.Config) (*Server, error) {
	// 创建验证器
	validator, err := protovalidate.New()
	if err != nil {
		return nil, fmt.Errorf("failed to create validator: %w", err)
	}

	// 初始化服务层
	greetService := service.NewGreetService()

	// 初始化处理器
	greetHandler := handler.NewGreetHandler(validator, greetService)

	// 创建 Gin 引擎
	engine := gin.Default()

	// 注册中间件
	engine.Use(middleware.CORS())

	// 注册路由
	path, h := greetv1connect.NewGreetServiceHandler(greetHandler)
	engine.Any(path+"*action", gin.WrapH(h))

	// 注册 SPA 静态资源（生产环境）
	// 开发环境下 dist 目录可能不存在或为空，会优雅降级
	if frontendFS, err := static.GetFrontendFS(); err == nil {
		if err := static.RegisterSPA(engine, "/", frontendFS); err != nil {
			log.Printf("Warning: failed to register SPA: %v", err)
		}
	}

	return &Server{
		config: cfg,
		engine: engine,
	}, nil
}

// Run 启动服务器
func (s *Server) Run() error {
	addr := fmt.Sprintf("%s:%d", s.config.Server.Host, s.config.Server.Port)
	log.Printf("Server starting on %s", addr)
	return s.engine.Run(addr)
}
