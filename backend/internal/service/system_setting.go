package service

import (
	"context"
	"strconv"
	"time"

	"zera/ent"
	"zera/ent/systemsetting"
	"zera/gen/base"
)

// 系统设置键名常量
const (
	// 通用设置
	SettingKeySiteName        = "site_name"
	SettingKeySiteDescription = "site_description"
	SettingKeySiteLogoType    = "site_logo_type" // Logo 类型: "default" | "custom"
	SettingKeySiteLogoPath    = "site_logo_path" // 自定义 Logo 相对路径

	// 功能开关
	SettingKeyEnableRegistration  = "enable_registration"
	SettingKeyMaintenanceMode     = "maintenance_mode"
	SettingKeyDefaultRegisterRole = "default_register_role"

	// 安全设置
	SettingKeyMaxLoginAttempts         = "max_login_attempts"
	SettingKeyLockoutDuration          = "lockout_duration"
	SettingKeySessionTimeout           = "session_timeout"
	SettingKeyPasswordMinLength        = "password_min_length"
	SettingKeyPasswordRequireUppercase = "password_require_uppercase"
	SettingKeyPasswordRequireNumber    = "password_require_number"
	SettingKeyPasswordRequireSpecial   = "password_require_special"
)

// 设置分组常量
const (
	SettingGroupGeneral  = "general"
	SettingGroupFeature  = "feature"
	SettingGroupSecurity = "security"
)

// 默认设置值
var defaultSettings = map[string]struct {
	Value       string
	Type        string
	Group       string
	Description string
}{
	SettingKeySiteName:            {"Zera", "string", SettingGroupGeneral, "站点名称"},
	SettingKeySiteDescription:     {"Zera 管理系统", "string", SettingGroupGeneral, "站点描述"},
	SettingKeySiteLogoType:        {"default", "string", SettingGroupGeneral, "Logo 类型: default 或 custom"},
	SettingKeySiteLogoPath:        {"", "string", SettingGroupGeneral, "自定义 Logo 相对路径"},
	SettingKeyEnableRegistration:  {"true", "bool", SettingGroupFeature, "允许新用户自行注册账号"},
	SettingKeyMaintenanceMode:     {"false", "bool", SettingGroupFeature, "开启后普通用户将无法访问系统"},
	SettingKeyDefaultRegisterRole: {"user", "string", SettingGroupFeature, "新注册用户的默认角色"},
	// 安全设置
	SettingKeyMaxLoginAttempts:         {"5", "int", SettingGroupSecurity, "超过此次数后账号将被临时锁定"},
	SettingKeyLockoutDuration:          {"30", "int", SettingGroupSecurity, "账号锁定时长（分钟）"},
	SettingKeySessionTimeout:           {"60", "int", SettingGroupSecurity, "会话超时时间（分钟）"},
	SettingKeyPasswordMinLength:        {"8", "int", SettingGroupSecurity, "密码最小长度"},
	SettingKeyPasswordRequireUppercase: {"true", "bool", SettingGroupSecurity, "密码必须包含至少一个大写字母"},
	SettingKeyPasswordRequireNumber:    {"true", "bool", SettingGroupSecurity, "密码必须包含至少一个数字"},
	SettingKeyPasswordRequireSpecial:   {"false", "bool", SettingGroupSecurity, "密码必须包含至少一个特殊字符"},
}

// SystemSettingService 系统设置服务
type SystemSettingService struct {
	client *ent.Client
}

// NewSystemSettingService 创建系统设置服务
func NewSystemSettingService(client *ent.Client) *SystemSettingService {
	return &SystemSettingService{
		client: client,
	}
}

// InitDefaultSettings 初始化默认设置
func (s *SystemSettingService) InitDefaultSettings(ctx context.Context) error {
	for key, def := range defaultSettings {
		exists, err := s.client.SystemSetting.Query().
			Where(systemsetting.Key(key)).
			Exist(ctx)
		if err != nil {
			return err
		}

		if !exists {
			_, err = s.client.SystemSetting.Create().
				SetKey(key).
				SetValue(def.Value).
				SetType(def.Type).
				SetGroup(def.Group).
				SetDescription(def.Description).
				Save(ctx)
			if err != nil {
				return err
			}
		}
	}
	return nil
}

// GetAllSettings 获取所有设置
func (s *SystemSettingService) GetAllSettings(ctx context.Context) (*base.GetSystemSettingsResponse, error) {
	// 确保默认设置已初始化
	if err := s.InitDefaultSettings(ctx); err != nil {
		return nil, err
	}

	settings, err := s.client.SystemSetting.Query().All(ctx)
	if err != nil {
		return nil, err
	}

	// 构建设置映射
	settingsMap := make(map[string]string)
	items := make([]*base.SystemSettingItem, 0, len(settings))
	for _, setting := range settings {
		settingsMap[setting.Key] = setting.Value
		items = append(items, &base.SystemSettingItem{
			Key:         setting.Key,
			Value:       setting.Value,
			Type:        setting.Type,
			Group:       setting.Group,
			Description: setting.Description,
			UpdatedAt:   setting.UpdatedAt.Format(time.RFC3339),
		})
	}

	// 构建 Logo URL
	logoType := getOrDefault(settingsMap, SettingKeySiteLogoType, "default")
	logoPath := getOrDefault(settingsMap, SettingKeySiteLogoPath, "")
	logoURL := ""
	if logoType == "custom" && logoPath != "" {
		logoURL = "/uploads/static/" + logoPath
	}

	return &base.GetSystemSettingsResponse{
		Settings: &base.SystemSettings{
			General: &base.GeneralSettings{
				SiteName:        getOrDefault(settingsMap, SettingKeySiteName, "Zera"),
				SiteDescription: getOrDefault(settingsMap, SettingKeySiteDescription, "Zera 管理系统"),
				SiteLogoType:    logoType,
				SiteLogoUrl:     logoURL,
			},
			Features: &base.FeatureSettings{
				EnableRegistration:  parseBool(getOrDefault(settingsMap, SettingKeyEnableRegistration, "true")),
				MaintenanceMode:     parseBool(getOrDefault(settingsMap, SettingKeyMaintenanceMode, "false")),
				DefaultRegisterRole: getOrDefault(settingsMap, SettingKeyDefaultRegisterRole, "user"),
			},
			Security: &base.SecuritySettings{
				MaxLoginAttempts:         parseInt32(getOrDefault(settingsMap, SettingKeyMaxLoginAttempts, "5")),
				LockoutDuration:          parseInt32(getOrDefault(settingsMap, SettingKeyLockoutDuration, "30")),
				SessionTimeout:           parseInt32(getOrDefault(settingsMap, SettingKeySessionTimeout, "60")),
				PasswordMinLength:        parseInt32(getOrDefault(settingsMap, SettingKeyPasswordMinLength, "8")),
				PasswordRequireUppercase: parseBool(getOrDefault(settingsMap, SettingKeyPasswordRequireUppercase, "true")),
				PasswordRequireNumber:    parseBool(getOrDefault(settingsMap, SettingKeyPasswordRequireNumber, "true")),
				PasswordRequireSpecial:   parseBool(getOrDefault(settingsMap, SettingKeyPasswordRequireSpecial, "false")),
			},
		},
		Items: items,
	}, nil
}

// UpdateSettings 更新系统设置
func (s *SystemSettingService) UpdateSettings(ctx context.Context, settings *base.SystemSettings) (*base.UpdateSystemSettingsResponse, error) {
	// 确保默认设置已初始化
	if err := s.InitDefaultSettings(ctx); err != nil {
		return nil, err
	}

	// 更新通用设置
	if settings.General != nil {
		if err := s.updateSetting(ctx, SettingKeySiteName, settings.General.SiteName, "string", SettingGroupGeneral); err != nil {
			return nil, err
		}
		if err := s.updateSetting(ctx, SettingKeySiteDescription, settings.General.SiteDescription, "string", SettingGroupGeneral); err != nil {
			return nil, err
		}
	}

	// 更新功能开关
	if settings.Features != nil {
		if err := s.updateSetting(ctx, SettingKeyEnableRegistration, strconv.FormatBool(settings.Features.EnableRegistration), "bool", SettingGroupFeature); err != nil {
			return nil, err
		}
		if err := s.updateSetting(ctx, SettingKeyMaintenanceMode, strconv.FormatBool(settings.Features.MaintenanceMode), "bool", SettingGroupFeature); err != nil {
			return nil, err
		}
		if settings.Features.DefaultRegisterRole != "" {
			if err := s.updateSetting(ctx, SettingKeyDefaultRegisterRole, settings.Features.DefaultRegisterRole, "string", SettingGroupFeature); err != nil {
				return nil, err
			}
		}
	}

	// 更新安全设置
	if settings.Security != nil {
		if err := s.updateSetting(ctx, SettingKeyMaxLoginAttempts, strconv.FormatInt(int64(settings.Security.MaxLoginAttempts), 10), "int", SettingGroupSecurity); err != nil {
			return nil, err
		}
		if err := s.updateSetting(ctx, SettingKeyLockoutDuration, strconv.FormatInt(int64(settings.Security.LockoutDuration), 10), "int", SettingGroupSecurity); err != nil {
			return nil, err
		}
		if err := s.updateSetting(ctx, SettingKeySessionTimeout, strconv.FormatInt(int64(settings.Security.SessionTimeout), 10), "int", SettingGroupSecurity); err != nil {
			return nil, err
		}
		if err := s.updateSetting(ctx, SettingKeyPasswordMinLength, strconv.FormatInt(int64(settings.Security.PasswordMinLength), 10), "int", SettingGroupSecurity); err != nil {
			return nil, err
		}
		if err := s.updateSetting(ctx, SettingKeyPasswordRequireUppercase, strconv.FormatBool(settings.Security.PasswordRequireUppercase), "bool", SettingGroupSecurity); err != nil {
			return nil, err
		}
		if err := s.updateSetting(ctx, SettingKeyPasswordRequireNumber, strconv.FormatBool(settings.Security.PasswordRequireNumber), "bool", SettingGroupSecurity); err != nil {
			return nil, err
		}
		if err := s.updateSetting(ctx, SettingKeyPasswordRequireSpecial, strconv.FormatBool(settings.Security.PasswordRequireSpecial), "bool", SettingGroupSecurity); err != nil {
			return nil, err
		}
	}

	// 返回更新后的设置
	resp, err := s.GetAllSettings(ctx)
	if err != nil {
		return nil, err
	}

	return &base.UpdateSystemSettingsResponse{
		Success:  true,
		Settings: resp.Settings,
	}, nil
}

// GetPublicSettings 获取公开设置
func (s *SystemSettingService) GetPublicSettings(ctx context.Context) (*base.GetPublicSettingsResponse, error) {
	// 确保默认设置已初始化
	if err := s.InitDefaultSettings(ctx); err != nil {
		return nil, err
	}

	settings, err := s.client.SystemSetting.Query().All(ctx)
	if err != nil {
		return nil, err
	}

	settingsMap := make(map[string]string)
	for _, setting := range settings {
		settingsMap[setting.Key] = setting.Value
	}

	// 构建 Logo URL
	logoType := getOrDefault(settingsMap, SettingKeySiteLogoType, "default")
	logoPath := getOrDefault(settingsMap, SettingKeySiteLogoPath, "")
	logoURL := ""
	if logoType == "custom" && logoPath != "" {
		logoURL = "/uploads/static/" + logoPath
	}

	return &base.GetPublicSettingsResponse{
		SiteName:           getOrDefault(settingsMap, SettingKeySiteName, "Zera"),
		SiteDescription:    getOrDefault(settingsMap, SettingKeySiteDescription, "Zera 管理系统"),
		EnableRegistration: parseBool(getOrDefault(settingsMap, SettingKeyEnableRegistration, "true")),
		MaintenanceMode:    parseBool(getOrDefault(settingsMap, SettingKeyMaintenanceMode, "false")),
		SiteLogoUrl:        logoURL,
	}, nil
}

// IsMaintenanceMode 检查是否处于维护模式
func (s *SystemSettingService) IsMaintenanceMode(ctx context.Context) (bool, error) {
	setting, err := s.client.SystemSetting.Query().
		Where(systemsetting.Key(SettingKeyMaintenanceMode)).
		Only(ctx)
	if err != nil {
		if ent.IsNotFound(err) {
			return false, nil
		}
		return false, err
	}
	return parseBool(setting.Value), nil
}

// IsRegistrationEnabled 检查是否启用注册
func (s *SystemSettingService) IsRegistrationEnabled(ctx context.Context) (bool, error) {
	setting, err := s.client.SystemSetting.Query().
		Where(systemsetting.Key(SettingKeyEnableRegistration)).
		Only(ctx)
	if err != nil {
		if ent.IsNotFound(err) {
			return true, nil // 默认启用注册
		}
		return false, err
	}
	return parseBool(setting.Value), nil
}

// GetSiteName 获取站点名称
func (s *SystemSettingService) GetSiteName(ctx context.Context) (string, error) {
	setting, err := s.client.SystemSetting.Query().
		Where(systemsetting.Key(SettingKeySiteName)).
		Only(ctx)
	if err != nil {
		if ent.IsNotFound(err) {
			return "Zera", nil
		}
		return "", err
	}
	return setting.Value, nil
}

// GetDefaultRegisterRole 获取默认注册角色
func (s *SystemSettingService) GetDefaultRegisterRole(ctx context.Context) (string, error) {
	setting, err := s.client.SystemSetting.Query().
		Where(systemsetting.Key(SettingKeyDefaultRegisterRole)).
		Only(ctx)
	if err != nil {
		if ent.IsNotFound(err) {
			return "user", nil // 默认使用 user 角色
		}
		return "", err
	}
	return setting.Value, nil
}

// UpdateLogoSettings 更新 Logo 设置
func (s *SystemSettingService) UpdateLogoSettings(ctx context.Context, logoType, logoPath string) error {
	// 更新 Logo 类型
	if err := s.updateSetting(ctx, SettingKeySiteLogoType, logoType, "string", SettingGroupGeneral); err != nil {
		return err
	}

	// 更新 Logo 路径
	if err := s.updateSetting(ctx, SettingKeySiteLogoPath, logoPath, "string", SettingGroupGeneral); err != nil {
		return err
	}

	return nil
}

// GetLogoSettings 获取 Logo 设置
func (s *SystemSettingService) GetLogoSettings(ctx context.Context) (logoType, logoPath string, err error) {
	settings, err := s.client.SystemSetting.Query().
		Where(
			systemsetting.KeyIn(SettingKeySiteLogoType, SettingKeySiteLogoPath),
		).
		All(ctx)
	if err != nil {
		return "", "", err
	}

	for _, setting := range settings {
		switch setting.Key {
		case SettingKeySiteLogoType:
			logoType = setting.Value
		case SettingKeySiteLogoPath:
			logoPath = setting.Value
		}
	}

	// 默认值
	if logoType == "" {
		logoType = "default"
	}

	return logoType, logoPath, nil
}

// updateSetting 更新单个设置
func (s *SystemSettingService) updateSetting(ctx context.Context, key, value, valueType, group string) error {
	// 尝试更新
	n, err := s.client.SystemSetting.Update().
		Where(systemsetting.Key(key)).
		SetValue(value).
		Save(ctx)
	if err != nil {
		return err
	}

	// 如果没有更新任何记录，则创建新记录
	if n == 0 {
		desc := ""
		if def, ok := defaultSettings[key]; ok {
			desc = def.Description
		}
		_, err = s.client.SystemSetting.Create().
			SetKey(key).
			SetValue(value).
			SetType(valueType).
			SetGroup(group).
			SetDescription(desc).
			Save(ctx)
		if err != nil {
			return err
		}
	}

	return nil
}

// getOrDefault 从 map 获取值，如果不存在则返回默认值
func getOrDefault(m map[string]string, key, defaultValue string) string {
	if v, ok := m[key]; ok {
		return v
	}
	return defaultValue
}

// parseBool 解析布尔值
func parseBool(s string) bool {
	return s == "true" || s == "1"
}

// parseInt32 解析 int32
func parseInt32(s string) int32 {
	v, err := strconv.ParseInt(s, 10, 32)
	if err != nil {
		return 0
	}
	return int32(v)
}
