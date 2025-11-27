package static

import (
	"embed"
	"io/fs"
)

//go:embed all:dist
var frontendFS embed.FS

// GetFrontendFS 返回前端静态资源文件系统
// 返回的是去掉 dist 前缀的文件系统
func GetFrontendFS() (fs.FS, error) {
	return fs.Sub(frontendFS, "dist")
}
