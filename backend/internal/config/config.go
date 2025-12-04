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
	Storage  StorageConfig  `toml:"storage"`
	Log      LogConfig      `toml:"log"`
}

// LogConfig 日志配置
type LogConfig struct {
	// Level 日志级别: debug, info, warn, error
	Level string `toml:"level"`
	// Format 日志格式: json, text
	Format string `toml:"format"`
	// Output 输出目标: stdout, stderr, 或文件路径
	Output string `toml:"output"`
	// AddSource 是否添加源代码位置（文件名和行号）
	AddSource bool `toml:"add_source"`
	// ServiceName 服务名称，用于日志标识
	ServiceName string `toml:"service_name"`
	// ServiceVersion 服务版本
	ServiceVersion string `toml:"service_version"`
	// Environment 运行环境: development, staging, production
	Environment string `toml:"environment"`
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

// StorageConfig 对象存储配置（S3 兼容）
type StorageConfig struct {
	Enabled      bool   `toml:"enabled"`        // 是否启用存储服务
	Endpoint     string `toml:"endpoint"`       // 存储服务端点
	AccessKey    string `toml:"access_key"`     // 访问密钥
	SecretKey    string `toml:"secret_key"`     // 密钥
	Bucket       string `toml:"bucket"`         // 默认存储桶
	Region       string `toml:"region"`         // 区域（S3 兼容需要）
	UsePathStyle bool   `toml:"use_path_style"` // 是否使用路径样式（非虚拟主机样式）
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
		Storage: StorageConfig{
			Enabled:      false,
			Endpoint:     "http://localhost:9000",
			AccessKey:    "zera",
			SecretKey:    "zera",
			Bucket:       "zera",
			Region:       "us-east-1",
			UsePathStyle: true,
		},
		Log: LogConfig{
			Level:          "info",
			Format:         "text",
			Output:         "stdout",
			AddSource:      true,
			ServiceName:    "zera",
			ServiceVersion: "1.0.0",
			Environment:    "development",
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

	// Storage 配置
	if enabled := os.Getenv("STORAGE_ENABLED"); enabled != "" {
		cfg.Storage.Enabled = enabled == "true" || enabled == "1"
	}
	if endpoint := os.Getenv("STORAGE_ENDPOINT"); endpoint != "" {
		cfg.Storage.Endpoint = endpoint
	}
	if accessKey := os.Getenv("STORAGE_ACCESS_KEY"); accessKey != "" {
		cfg.Storage.AccessKey = accessKey
	}
	if secretKey := os.Getenv("STORAGE_SECRET_KEY"); secretKey != "" {
		cfg.Storage.SecretKey = secretKey
	}
	if bucket := os.Getenv("STORAGE_BUCKET"); bucket != "" {
		cfg.Storage.Bucket = bucket
	}
	if region := os.Getenv("STORAGE_REGION"); region != "" {
		cfg.Storage.Region = region
	}
	if usePathStyle := os.Getenv("STORAGE_USE_PATH_STYLE"); usePathStyle != "" {
		cfg.Storage.UsePathStyle = usePathStyle == "true" || usePathStyle == "1"
	}

	// Log 配置
	if level := os.Getenv("LOG_LEVEL"); level != "" {
		cfg.Log.Level = level
	}
	if format := os.Getenv("LOG_FORMAT"); format != "" {
		cfg.Log.Format = format
	}
	if output := os.Getenv("LOG_OUTPUT"); output != "" {
		cfg.Log.Output = output
	}
	if addSource := os.Getenv("LOG_ADD_SOURCE"); addSource != "" {
		cfg.Log.AddSource = addSource == "true" || addSource == "1"
	}
	if serviceName := os.Getenv("LOG_SERVICE_NAME"); serviceName != "" {
		cfg.Log.ServiceName = serviceName
	}
	if serviceVersion := os.Getenv("LOG_SERVICE_VERSION"); serviceVersion != "" {
		cfg.Log.ServiceVersion = serviceVersion
	}
	if environment := os.Getenv("LOG_ENVIRONMENT"); environment != "" {
		cfg.Log.Environment = environment
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
