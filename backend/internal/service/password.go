package service

import (
	"context"
	"errors"
	"unicode"
)

// 密码验证错误
var (
	ErrPasswordTooShort      = errors.New("密码长度不足")
	ErrPasswordNoUppercase   = errors.New("密码必须包含至少一个大写字母")
	ErrPasswordNoNumber      = errors.New("密码必须包含至少一个数字")
	ErrPasswordNoSpecialChar = errors.New("密码必须包含至少一个特殊字符")
	ErrRegistrationDisabled  = errors.New("系统当前未开放注册")
)

// PasswordPolicy 密码策略配置
type PasswordPolicy struct {
	MinLength        int
	RequireUppercase bool
	RequireNumber    bool
	RequireSpecial   bool
}

// PasswordValidator 密码验证器
type PasswordValidator struct {
	client interface {
		SystemSettingClient() interface{}
	}
}

// GetPasswordPolicy 从系统设置获取密码策略
func GetPasswordPolicy(ctx context.Context, settingService *SystemSettingService) (*PasswordPolicy, error) {
	resp, err := settingService.GetAllSettings(ctx)
	if err != nil {
		// 使用默认策略
		return &PasswordPolicy{
			MinLength:        8,
			RequireUppercase: true,
			RequireNumber:    true,
			RequireSpecial:   false,
		}, nil
	}

	policy := &PasswordPolicy{
		MinLength:        8,
		RequireUppercase: true,
		RequireNumber:    true,
		RequireSpecial:   false,
	}

	if resp.Settings != nil && resp.Settings.Security != nil {
		if resp.Settings.Security.PasswordMinLength > 0 {
			policy.MinLength = int(resp.Settings.Security.PasswordMinLength)
		}
		policy.RequireUppercase = resp.Settings.Security.PasswordRequireUppercase
		policy.RequireNumber = resp.Settings.Security.PasswordRequireNumber
		policy.RequireSpecial = resp.Settings.Security.PasswordRequireSpecial
	}

	return policy, nil
}

// ValidatePassword 根据策略验证密码
func ValidatePassword(password string, policy *PasswordPolicy) error {
	// 检查长度
	if len(password) < policy.MinLength {
		return ErrPasswordTooShort
	}

	var hasUppercase, hasNumber, hasSpecial bool

	for _, char := range password {
		switch {
		case unicode.IsUpper(char):
			hasUppercase = true
		case unicode.IsDigit(char):
			hasNumber = true
		case unicode.IsPunct(char) || unicode.IsSymbol(char):
			hasSpecial = true
		}
	}

	// 检查大写字母
	if policy.RequireUppercase && !hasUppercase {
		return ErrPasswordNoUppercase
	}

	// 检查数字
	if policy.RequireNumber && !hasNumber {
		return ErrPasswordNoNumber
	}

	// 检查特殊字符
	if policy.RequireSpecial && !hasSpecial {
		return ErrPasswordNoSpecialChar
	}

	return nil
}
