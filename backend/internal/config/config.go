package config

import (
	"log"
	"os"
	"strconv"

	"github.com/pelletier/go-toml/v2"
)

// Config 应用配置
type Config struct {
	Server ServerConfig `toml:"server"`
	// Database DatabaseConfig `toml:"database"` // 预留数据库配置
}

// ServerConfig 服务器配置
type ServerConfig struct {
	Host string `toml:"host"`
	Port int    `toml:"port"`
}

// 默认配置
func defaultConfig() *Config {
	return &Config{
		Server: ServerConfig{
			Host: "0.0.0.0",
			Port: 8080,
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
