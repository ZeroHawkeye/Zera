// Package static 提供本地静态资源存储服务
package static

import (
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"

	"zera/internal/config"
)

// LocalStorage 本地文件存储服务
type LocalStorage struct {
	basePath      string
	maxUploadSize int64
}

// NewLocalStorage 创建本地存储服务实例
func NewLocalStorage(cfg *config.StaticConfig) (*LocalStorage, error) {
	// 确保基础目录存在
	if err := os.MkdirAll(cfg.UploadsDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create uploads directory: %w", err)
	}

	return &LocalStorage{
		basePath:      cfg.UploadsDir,
		maxUploadSize: cfg.MaxUploadSize,
	}, nil
}

// EnsureLogoDir 确保 Logo 目录存在
func (s *LocalStorage) EnsureLogoDir() error {
	logoDir := filepath.Join(s.basePath, "logo")
	return os.MkdirAll(logoDir, 0755)
}

// SaveFile 保存文件到指定子路径
// subPath: 相对于 basePath 的路径，如 "logo/logo.png"
func (s *LocalStorage) SaveFile(subPath string, data []byte) error {
	fullPath := filepath.Join(s.basePath, subPath)
	dir := filepath.Dir(fullPath)

	// 确保目录存在
	if err := os.MkdirAll(dir, 0755); err != nil {
		return fmt.Errorf("failed to create directory: %w", err)
	}

	// 写入文件
	if err := os.WriteFile(fullPath, data, 0644); err != nil {
		return fmt.Errorf("failed to write file: %w", err)
	}

	return nil
}

// SaveFileFromReader 从 Reader 保存文件
func (s *LocalStorage) SaveFileFromReader(subPath string, reader io.Reader) error {
	fullPath := filepath.Join(s.basePath, subPath)
	dir := filepath.Dir(fullPath)

	// 确保目录存在
	if err := os.MkdirAll(dir, 0755); err != nil {
		return fmt.Errorf("failed to create directory: %w", err)
	}

	// 创建目标文件
	file, err := os.Create(fullPath)
	if err != nil {
		return fmt.Errorf("failed to create file: %w", err)
	}
	defer file.Close()

	// 复制数据
	if _, err := io.Copy(file, reader); err != nil {
		return fmt.Errorf("failed to write file: %w", err)
	}

	return nil
}

// DeleteFile 删除指定文件
func (s *LocalStorage) DeleteFile(subPath string) error {
	fullPath := filepath.Join(s.basePath, subPath)

	// 检查文件是否存在
	if _, err := os.Stat(fullPath); os.IsNotExist(err) {
		return nil // 文件不存在，视为删除成功
	}

	if err := os.Remove(fullPath); err != nil {
		return fmt.Errorf("failed to delete file: %w", err)
	}

	return nil
}

// DeleteLogoFiles 删除 logo 目录下所有文件
func (s *LocalStorage) DeleteLogoFiles() error {
	logoDir := filepath.Join(s.basePath, "logo")

	entries, err := os.ReadDir(logoDir)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return fmt.Errorf("failed to read logo directory: %w", err)
	}

	for _, entry := range entries {
		if !entry.IsDir() {
			filePath := filepath.Join(logoDir, entry.Name())
			if err := os.Remove(filePath); err != nil {
				return fmt.Errorf("failed to delete file %s: %w", entry.Name(), err)
			}
		}
	}

	return nil
}

// FileExists 检查文件是否存在
func (s *LocalStorage) FileExists(subPath string) bool {
	fullPath := filepath.Join(s.basePath, subPath)
	_, err := os.Stat(fullPath)
	return err == nil
}

// GetFilePath 获取文件完整路径
func (s *LocalStorage) GetFilePath(subPath string) string {
	return filepath.Join(s.basePath, subPath)
}

// GetBasePath 获取基础路径
func (s *LocalStorage) GetBasePath() string {
	return s.basePath
}

// GetMaxUploadSize 获取最大上传大小
func (s *LocalStorage) GetMaxUploadSize() int64 {
	return s.maxUploadSize
}

// FindLogoFile 查找 logo 目录下的 logo 文件
// 返回文件相对路径（如 "logo/logo.png"）和是否找到
func (s *LocalStorage) FindLogoFile() (string, bool) {
	logoDir := filepath.Join(s.basePath, "logo")

	entries, err := os.ReadDir(logoDir)
	if err != nil {
		return "", false
	}

	// 支持的扩展名
	supportedExts := map[string]bool{
		".png":  true,
		".jpg":  true,
		".jpeg": true,
		".svg":  true,
		".webp": true,
	}

	for _, entry := range entries {
		if !entry.IsDir() {
			name := entry.Name()
			ext := strings.ToLower(filepath.Ext(name))
			// 查找以 "logo" 开头的文件
			if strings.HasPrefix(strings.ToLower(name), "logo") && supportedExts[ext] {
				// 使用正斜杠作为 URL 路径分隔符（跨平台兼容）
				return "logo/" + name, true
			}
		}
	}

	return "", false
}
