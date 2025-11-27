package handler

import (
	"context"
	"log"

	greetv1 "zera/gen/greet/v1"
	"zera/internal/service"

	"buf.build/go/protovalidate"
	"connectrpc.com/connect"
)

// GreetHandler 问候服务处理器
type GreetHandler struct {
	validator    protovalidate.Validator
	greetService *service.GreetService
}

// NewGreetHandler 创建问候处理器
func NewGreetHandler(validator protovalidate.Validator, greetService *service.GreetService) *GreetHandler {
	return &GreetHandler{
		validator:    validator,
		greetService: greetService,
	}
}

// Greet 问候接口实现
func (h *GreetHandler) Greet(
	ctx context.Context,
	req *connect.Request[greetv1.GreetRequest],
) (*connect.Response[greetv1.GreetResponse], error) {
	// 验证请求
	if err := h.validator.Validate(req.Msg); err != nil {
		return nil, connect.NewError(connect.CodeInvalidArgument, err)
	}

	log.Printf("Received request from: %s", req.Msg.Name)

	// 调用业务逻辑层
	greeting := h.greetService.Greet(req.Msg.Name)

	res := connect.NewResponse(&greetv1.GreetResponse{
		Greeting: greeting,
	})
	return res, nil
}
