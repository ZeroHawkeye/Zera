package service

import "fmt"

// GreetService 问候业务逻辑服务
type GreetService struct {
	// 可以注入 repository 等依赖
}

// NewGreetService 创建问候服务
func NewGreetService() *GreetService {
	return &GreetService{}
}

// Greet 问候业务逻辑
func (s *GreetService) Greet(name string) string {
	return fmt.Sprintf("Hello, %s!", name)
}
