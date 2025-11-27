package static

import (
	"io/fs"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

// SPAHandler 创建一个 SPA 处理器
// 对于静态资源直接返回，对于其他路由返回 index.html
type SPAHandler struct {
	fileSystem  fs.FS
	fileServer  http.Handler
	indexHTML   []byte
	staticPaths []string // 静态资源路径前缀，如 /assets, /static 等
}

// NewSPAHandler 创建 SPA 处理器
// staticPaths: 静态资源路径前缀列表，这些路径下的请求会直接查找文件
// 如果不传入 staticPaths，将自动扫描文件系统根目录下的所有目录作为静态资源路径
func NewSPAHandler(fileSystem fs.FS, staticPaths ...string) (*SPAHandler, error) {
	// 读取 index.html
	indexHTML, err := fs.ReadFile(fileSystem, "index.html")
	if err != nil {
		return nil, err
	}

	// 如果没有指定静态资源路径，自动扫描文件系统根目录
	if len(staticPaths) == 0 {
		staticPaths, err = scanStaticPaths(fileSystem)
		if err != nil {
			return nil, err
		}
	}

	return &SPAHandler{
		fileSystem:  fileSystem,
		fileServer:  http.FileServer(http.FS(fileSystem)),
		indexHTML:   indexHTML,
		staticPaths: staticPaths,
	}, nil
}

// scanStaticPaths 扫描文件系统根目录，获取所有目录作为静态资源路径
func scanStaticPaths(fileSystem fs.FS) ([]string, error) {
	var paths []string

	entries, err := fs.ReadDir(fileSystem, ".")
	if err != nil {
		return nil, err
	}

	for _, entry := range entries {
		if entry.IsDir() {
			// 目录添加为静态资源路径前缀
			paths = append(paths, "/"+entry.Name())
		}
	}

	return paths, nil
}

// ServeHTTP 实现 http.Handler 接口
func (h *SPAHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	path := r.URL.Path

	// 检查是否是静态资源请求
	if h.isStaticPath(path) {
		// 尝试直接提供文件
		h.fileServer.ServeHTTP(w, r)
		return
	}

	// 检查文件是否存在（用于处理根目录下的文件，如 favicon.ico）
	if path != "/" {
		cleanPath := strings.TrimPrefix(path, "/")
		if _, err := fs.Stat(h.fileSystem, cleanPath); err == nil {
			h.fileServer.ServeHTTP(w, r)
			return
		}
	}

	// 其他所有请求返回 index.html（SPA 路由）
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	w.Write(h.indexHTML)
}

// isStaticPath 检查路径是否为静态资源路径
func (h *SPAHandler) isStaticPath(path string) bool {
	for _, prefix := range h.staticPaths {
		if strings.HasPrefix(path, prefix) {
			return true
		}
	}
	return false
}

// RegisterSPA 注册 SPA 到 Gin 路由
// basePath: SPA 的基础路径，如 "/" 或 "/app"
func RegisterSPA(engine *gin.Engine, basePath string, fileSystem fs.FS) error {
	handler, err := NewSPAHandler(fileSystem)
	if err != nil {
		return err
	}

	// 确保 basePath 以 / 开头
	if !strings.HasPrefix(basePath, "/") {
		basePath = "/" + basePath
	}

	// 注册路由
	if basePath == "/" {
		engine.NoRoute(gin.WrapH(handler))
	} else {
		engine.GET(basePath+"/*filepath", gin.WrapH(handler))
	}

	return nil
}
