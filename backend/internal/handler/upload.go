package handler

import (
	"fmt"
	"io"
	"net/http"
	"path/filepath"
	"strings"

	"zera/internal/auth"
	"zera/internal/config"
	"zera/internal/logger"
	"zera/internal/permission"
	"zera/internal/service"
	"zera/internal/static"

	"github.com/gin-gonic/gin"
)

// 支持的图片 MIME 类型
var allowedMimeTypes = map[string]string{
	"image/png":     ".png",
	"image/jpeg":    ".jpg",
	"image/svg+xml": ".svg",
	"image/webp":    ".webp",
}

// UploadResponse 上传响应
type UploadResponse struct {
	Success  bool   `json:"success"`
	URL      string `json:"url,omitempty"`
	Filename string `json:"filename,omitempty"`
	Size     int64  `json:"size,omitempty"`
	Error    string `json:"error,omitempty"`
}

// DeleteLogoResponse 删除 Logo 响应
type DeleteLogoResponse struct {
	Success bool   `json:"success"`
	Error   string `json:"error,omitempty"`
}

// UploadHandler Logo 上传处理器
type UploadHandler struct {
	storage        *static.LocalStorage
	config         *config.StaticConfig
	jwtManager     *auth.JWTManager
	permChecker    *permission.Checker
	settingService *service.SystemSettingService
}

// NewUploadHandler 创建上传处理器
func NewUploadHandler(
	storage *static.LocalStorage,
	cfg *config.StaticConfig,
	jwtManager *auth.JWTManager,
	permChecker *permission.Checker,
	settingService *service.SystemSettingService,
) *UploadHandler {
	return &UploadHandler{
		storage:        storage,
		config:         cfg,
		jwtManager:     jwtManager,
		permChecker:    permChecker,
		settingService: settingService,
	}
}

// UploadLogo 处理 Logo 上传
// POST /api/upload/logo
func (h *UploadHandler) UploadLogo(c *gin.Context) {
	ctx := c.Request.Context()

	// 1. 验证认证和权限
	claims, err := h.validateAuth(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, UploadResponse{
			Success: false,
			Error:   "未授权访问",
		})
		return
	}

	// 检查权限：需要 system_setting:update 权限
	if !h.hasPermission(claims, "system_setting:update") {
		c.JSON(http.StatusForbidden, UploadResponse{
			Success: false,
			Error:   "缺少权限: system_setting:update",
		})
		return
	}

	// 2. 获取上传文件
	file, header, err := c.Request.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, UploadResponse{
			Success: false,
			Error:   "请选择文件",
		})
		return
	}
	defer file.Close()

	// 3. 验证文件大小
	if header.Size > h.config.MaxUploadSize {
		c.JSON(http.StatusRequestEntityTooLarge, UploadResponse{
			Success: false,
			Error:   fmt.Sprintf("图片大小不能超过 %dMB", h.config.MaxUploadSize/(1024*1024)),
		})
		return
	}

	// 4. 读取文件内容进行 MIME 类型验证
	// 读取前 512 字节用于检测 MIME 类型
	buffer := make([]byte, 512)
	n, err := file.Read(buffer)
	if err != nil && err != io.EOF {
		c.JSON(http.StatusInternalServerError, UploadResponse{
			Success: false,
			Error:   "读取文件失败",
		})
		return
	}
	buffer = buffer[:n]

	// 检测 MIME 类型
	mimeType := http.DetectContentType(buffer)
	// SVG 文件可能被检测为 text/xml 或 text/plain
	if strings.Contains(header.Filename, ".svg") {
		mimeType = "image/svg+xml"
	}

	ext, ok := allowedMimeTypes[mimeType]
	if !ok {
		c.JSON(http.StatusBadRequest, UploadResponse{
			Success: false,
			Error:   "仅支持 PNG、JPG、SVG、WebP 格式",
		})
		return
	}

	// 5. 重置文件读取位置
	if _, err := file.Seek(0, 0); err != nil {
		c.JSON(http.StatusInternalServerError, UploadResponse{
			Success: false,
			Error:   "处理文件失败",
		})
		return
	}

	// 6. 删除旧的 Logo 文件
	if err := h.storage.DeleteLogoFiles(); err != nil {
		logger.WarnContext(ctx, "failed to delete old logo files", "error", err)
	}

	// 7. 保存新文件
	filename := "logo" + ext
	subPath := filepath.Join("logo", filename)

	if err := h.storage.SaveFileFromReader(subPath, file); err != nil {
		logger.ErrorContext(ctx, "failed to save logo file", "error", err)
		c.JSON(http.StatusInternalServerError, UploadResponse{
			Success: false,
			Error:   "保存文件失败",
		})
		return
	}

	// 8. 更新系统设置
	// 使用正斜杠作为 URL 路径分隔符（跨平台兼容）
	urlPath := "logo/" + filename
	logoURL := "/uploads/static/" + urlPath
	if err := h.settingService.UpdateLogoSettings(ctx, "custom", urlPath); err != nil {
		logger.ErrorContext(ctx, "failed to update logo settings", "error", err)
		// 不返回错误，文件已保存成功
	}

	logger.InfoContext(ctx, "logo uploaded successfully",
		"filename", filename,
		"size", header.Size,
		"user", claims.Username,
	)

	c.JSON(http.StatusOK, UploadResponse{
		Success:  true,
		URL:      logoURL,
		Filename: filename,
		Size:     header.Size,
	})
}

// DeleteLogo 处理 Logo 删除
// DELETE /api/upload/logo
func (h *UploadHandler) DeleteLogo(c *gin.Context) {
	ctx := c.Request.Context()

	// 1. 验证认证和权限
	claims, err := h.validateAuth(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, DeleteLogoResponse{
			Success: false,
			Error:   "未授权访问",
		})
		return
	}

	// 检查权限
	if !h.hasPermission(claims, "system_setting:update") {
		c.JSON(http.StatusForbidden, DeleteLogoResponse{
			Success: false,
			Error:   "缺少权限: system_setting:update",
		})
		return
	}

	// 2. 检查是否存在自定义 Logo
	_, exists := h.storage.FindLogoFile()
	if !exists {
		c.JSON(http.StatusNotFound, DeleteLogoResponse{
			Success: false,
			Error:   "自定义 Logo 不存在",
		})
		return
	}

	// 3. 删除 Logo 文件
	if err := h.storage.DeleteLogoFiles(); err != nil {
		logger.ErrorContext(ctx, "failed to delete logo files", "error", err)
		c.JSON(http.StatusInternalServerError, DeleteLogoResponse{
			Success: false,
			Error:   "删除文件失败",
		})
		return
	}

	// 4. 更新系统设置为默认
	if err := h.settingService.UpdateLogoSettings(ctx, "default", ""); err != nil {
		logger.ErrorContext(ctx, "failed to update logo settings", "error", err)
	}

	logger.InfoContext(ctx, "logo deleted successfully", "user", claims.Username)

	c.JSON(http.StatusOK, DeleteLogoResponse{
		Success: true,
	})
}

// validateAuth 验证认证令牌
func (h *UploadHandler) validateAuth(c *gin.Context) (*auth.Claims, error) {
	authHeader := c.GetHeader("Authorization")
	if authHeader == "" {
		return nil, fmt.Errorf("missing authorization header")
	}

	parts := strings.SplitN(authHeader, " ", 2)
	if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
		return nil, fmt.Errorf("invalid authorization header format")
	}

	token := parts[1]
	claims, err := h.jwtManager.ValidateAccessToken(token)
	if err != nil {
		return nil, fmt.Errorf("invalid token: %w", err)
	}

	return claims, nil
}

// hasPermission 检查用户是否拥有指定权限
func (h *UploadHandler) hasPermission(claims *auth.Claims, requiredPerm string) bool {
	// 管理员拥有所有权限
	for _, role := range claims.Roles {
		if role == "admin" {
			return true
		}
	}

	// 检查具体权限
	for _, p := range claims.Permissions {
		if p == "*" || p == requiredPerm {
			return true
		}
		// 支持通配符权限
		if strings.HasSuffix(p, ":*") {
			prefix := strings.TrimSuffix(p, "*")
			if strings.HasPrefix(requiredPerm, prefix) {
				return true
			}
		}
	}

	return false
}
