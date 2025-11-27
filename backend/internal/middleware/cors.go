package middleware

import (
	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

// CORS 返回 CORS 中间件配置
func CORS() gin.HandlerFunc {
	return cors.New(cors.Config{
		AllowOrigins:  []string{"*"},
		AllowMethods:  []string{"POST", "GET", "OPTIONS", "PUT", "DELETE"},
		AllowHeaders:  []string{"Content-Type", "Connect-Protocol-Version", "Authorization"},
		ExposeHeaders: []string{"Connect-Protocol-Version"},
	})
}
