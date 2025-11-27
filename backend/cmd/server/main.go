package main

import (
	"log"

	"zera/internal/config"
	"zera/internal/server"
)

func main() {
	// 加载配置
	cfg := config.Load()

	// 创建服务器
	srv, err := server.New(cfg)
	if err != nil {
		log.Fatalf("failed to create server: %v", err)
	}

	// 启动服务器
	if err := srv.Run(); err != nil {
		log.Fatalf("failed to start server: %v", err)
	}
}
