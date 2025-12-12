package main

import (
	"fmt"
	"os"

	"zera/internal/config"
	"zera/internal/server"
)

func main() {
	// 加载配置
	cfg := config.Load()
	// 创建服务器
	srv, err := server.New(cfg)
	if err != nil {
		fmt.Fprintf(os.Stderr, "failed to create server: %v\n", err)
		os.Exit(1)
	}

	// 确保服务器资源被正确关闭
	defer srv.Close()

	// 启动服务器
	if err := srv.Run(); err != nil {
		fmt.Fprintf(os.Stderr, "failed to start server: %v\n", err)
		os.Exit(1)
	}
}
