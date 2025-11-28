package config

import (
	"fmt"
	"log"
	"os"
	"strconv"

	"github.com/pelletier/go-toml/v2"
)

// Config 应用配置
type Config struct {
	Server   ServerConfig   `toml:"server"`
	Database DatabaseConfig `toml:"database"`
	App      AppConfig      `toml:"app"`
	Admin    AdminConfig    `toml:"admin"`
	JWT      JWTConfig      `toml:"jwt"`
}

// ServerConfig 服务器配置
type ServerConfig struct {
	Host string `toml:"host"`
	Port int    `toml:"port"`
}

// DatabaseConfig 数据库配置
type DatabaseConfig struct {
	Host     string `toml:"host"`
	Port     int    `toml:"port"`
	User     string `toml:"user"`
	Password string `toml:"password"`
	DBName   string `toml:"dbname"`
	SSLMode  string `toml:"sslmode"`
}

// AppConfig 应用配置
type AppConfig struct {
	DevMode bool `toml:"dev_mode"`
}

// AdminConfig 初始管理员配置
type AdminConfig struct {
	Username string `toml:"username"`
	Email    string `toml:"email"`
	Password string `toml:"password"`
}

// JWTConfig JWT 配置
type JWTConfig struct {
	Secret             string `toml:"secret"`
	AccessTokenExpire  int64  `toml:"access_token_expire"`
	RefreshTokenExpire int64  `toml:"refresh_token_expire"`
}

// DSN 返回 PostgreSQL 连接字符串
func (d *DatabaseConfig) DSN() string {
	return fmt.Sprintf(
		"host=%s port=%d user=%s password=%s dbname=%s sslmode=%s",
		d.Host, d.Port, d.User, d.Password, d.DBName, d.SSLMode,
	)
}

// 默认配置
func defaultConfig() *Config {
	return &Config{
		Server: ServerConfig{
			Host: "0.0.0.0",
			Port: 8080,
		},
		Database: DatabaseConfig{
			Host:     "localhost",
			Port:     5432,
			User:     "postgres",
			Password: "",
			DBName:   "zera",
			SSLMode:  "disable",
		},
		App: AppConfig{
			DevMode: false,
		},
		Admin: AdminConfig{
			Username: "admin",
			Email:    "admin@zera.local",
			Password: "admin123",
		},
		JWT: JWTConfig{
			Secret:             "your-super-secret-key-please-change-in-production",
			AccessTokenExpire:  3600,   // 1 小时
			RefreshTokenExpire: 604800, // 7 天
		},
	}
}

// Load 加载配置
// 优先级: 环境变量 > 配置文件 > 默认值
func Load() *Config {
	cfg := defaultConfig()

	// 尝试从配置文件加载
	if err := loadFromFile(cfg); err != nil {
		log.Printf("Warning: failed to load config file: %v, using defaults", err)
	}

	// 环境变量覆盖配置文件
	applyEnvOverrides(cfg)

	return cfg
}

// LoadFromPath 从指定路径加载配置
func LoadFromPath(path string) *Config {
	cfg := defaultConfig()

	if err := loadFromFilePath(cfg, path); err != nil {
		log.Printf("Warning: failed to load config file from %s: %v, using defaults", path, err)
	}

	applyEnvOverrides(cfg)

	return cfg
}

// loadFromFile 从默认配置文件加载配置
func loadFromFile(cfg *Config) error {
	// 按优先级尝试不同路径
	paths := []string{
		"config.toml",           // 当前目录
		"./config.toml",         // 当前目录 (显式)
		"../config.toml",        // 上级目录
		"/etc/zera/config.toml", // Linux 系统配置目录
	}

	// 如果设置了 CONFIG_PATH 环境变量，优先使用
	if envPath := os.Getenv("CONFIG_PATH"); envPath != "" {
		paths = append([]string{envPath}, paths...)
	}

	for _, path := range paths {
		if err := loadFromFilePath(cfg, path); err == nil {
			log.Printf("Loaded config from: %s", path)
			return nil
		}
	}

	return nil // 如果没有找到配置文件，使用默认配置
}

// loadFromFilePath 从指定路径加载配置
func loadFromFilePath(cfg *Config, path string) error {
	data, err := os.ReadFile(path)
	if err != nil {
		return err
	}

	if err := toml.Unmarshal(data, cfg); err != nil {
		return err
	}

	return nil
}

// applyEnvOverrides 应用环境变量覆盖
func applyEnvOverrides(cfg *Config) {
	// Server 配置
	if host := os.Getenv("SERVER_HOST"); host != "" {
		cfg.Server.Host = host
	}
	if port := getEnvInt("SERVER_PORT"); port != 0 {
		cfg.Server.Port = port
	}

	// Database 配置
	if host := os.Getenv("DB_HOST"); host != "" {
		cfg.Database.Host = host
	}
	if port := getEnvInt("DB_PORT"); port != 0 {
		cfg.Database.Port = port
	}
	if user := os.Getenv("DB_USER"); user != "" {
		cfg.Database.User = user
	}
	if password := os.Getenv("DB_PASSWORD"); password != "" {
		cfg.Database.Password = password
	}
	if dbname := os.Getenv("DB_NAME"); dbname != "" {
		cfg.Database.DBName = dbname
	}
	if sslmode := os.Getenv("DB_SSLMODE"); sslmode != "" {
		cfg.Database.SSLMode = sslmode
	}

	// App 配置
	if devMode := os.Getenv("DEV_MODE"); devMode != "" {
		cfg.App.DevMode = devMode == "true" || devMode == "1"
	}

	// Admin 配置
	if username := os.Getenv("ADMIN_USERNAME"); username != "" {
		cfg.Admin.Username = username
	}
	if email := os.Getenv("ADMIN_EMAIL"); email != "" {
		cfg.Admin.Email = email
	}
	if password := os.Getenv("ADMIN_PASSWORD"); password != "" {
		cfg.Admin.Password = password
	}

	// JWT 配置
	if secret := os.Getenv("JWT_SECRET"); secret != "" {
		cfg.JWT.Secret = secret
	}
	if expire := getEnvInt64("JWT_ACCESS_TOKEN_EXPIRE"); expire != 0 {
		cfg.JWT.AccessTokenExpire = expire
	}
	if expire := getEnvInt64("JWT_REFRESH_TOKEN_EXPIRE"); expire != 0 {
		cfg.JWT.RefreshTokenExpire = expire
	}
}

// getEnvInt 获取整型环境变量，如果不存在或解析失败返回 0
func getEnvInt(key string) int {
	if value := os.Getenv(key); value != "" {
		if intValue, err := strconv.Atoi(value); err == nil {
			return intValue
		}
	}
	return 0
}

// getEnvInt64 获取 int64 类型环境变量，如果不存在或解析失败返回 0
func getEnvInt64(key string) int64 {
	if value := os.Getenv(key); value != "" {
		if intValue, err := strconv.ParseInt(value, 10, 64); err == nil {
			return intValue
		}
	}
	return 0
}
