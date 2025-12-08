package service

import (
	"context"
	"encoding/json"
	"encoding/xml"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"zera/ent"
	"zera/ent/role"
	"zera/ent/systemsetting"
	"zera/ent/user"
	"zera/gen/base"
	"zera/internal/auth"
	"zera/internal/permission"
)

// CAS 配置键名常量
const (
	SettingKeyCASConfig = "cas.config"
)

// CAS 相关错误
var (
	ErrCASNotEnabled       = errors.New("CAS authentication is not enabled")
	ErrCASTicketInvalid    = errors.New("CAS ticket validation failed")
	ErrCASUserCreateFailed = errors.New("failed to create user from CAS")
	ErrCASConfigInvalid    = errors.New("CAS configuration is invalid")
	ErrCASConnectionFailed = errors.New("failed to connect to CAS server")
)

// CASConfig CAS 配置结构
type CASConfig struct {
	Enabled        bool   `json:"enabled"`
	ServerURL      string `json:"serverUrl"`
	Organization   string `json:"organization"`
	Application    string `json:"application"`
	ServiceURL     string `json:"serviceUrl"`
	DefaultRole    string `json:"defaultRole"`
	AutoCreateUser bool   `json:"autoCreateUser"`
}

// CAS XML 响应结构体 (CAS 3.0 协议)

// CASServiceResponse CAS 服务验证响应
type CASServiceResponse struct {
	XMLName               xml.Name                  `xml:"serviceResponse"`
	AuthenticationSuccess *CASAuthenticationSuccess `xml:"authenticationSuccess"`
	AuthenticationFailure *CASAuthenticationFailure `xml:"authenticationFailure"`
}

// CASAuthenticationSuccess CAS 认证成功响应
type CASAuthenticationSuccess struct {
	User       string        `xml:"user"`
	Attributes CASAttributes `xml:"attributes"`
}

// CASAttributes CAS 用户属性
type CASAttributes struct {
	Email       string `xml:"email"`
	DisplayName string `xml:"displayName"`
	Name        string `xml:"name"`
	ID          string `xml:"id"`
}

// CASAuthenticationFailure CAS 认证失败响应
type CASAuthenticationFailure struct {
	Code    string `xml:"code,attr"`
	Message string `xml:",chardata"`
}

// CASUserInfo CAS 用户信息 (从 CAS 响应解析)
type CASUserInfo struct {
	Username    string
	Email       string
	DisplayName string
	ExternalID  string
}

// CASAuthService CAS 认证服务
type CASAuthService struct {
	client            *ent.Client
	jwtManager        *auth.JWTManager
	permissionChecker *permission.Checker
	httpClient        *http.Client
}

// NewCASAuthService 创建 CAS 认证服务
func NewCASAuthService(client *ent.Client, jwtManager *auth.JWTManager) *CASAuthService {
	return &CASAuthService{
		client:            client,
		jwtManager:        jwtManager,
		permissionChecker: permission.NewChecker(client),
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

// ============================================
// CAS 配置管理
// ============================================

// GetCASConfig 获取 CAS 配置
func (s *CASAuthService) GetCASConfig(ctx context.Context) (*CASConfig, error) {
	setting, err := s.client.SystemSetting.Query().
		Where(systemsetting.Key(SettingKeyCASConfig)).
		Only(ctx)
	if err != nil {
		if ent.IsNotFound(err) {
			// 返回默认配置
			return &CASConfig{
				Enabled:        false,
				ServerURL:      "",
				Organization:   "built-in",
				Application:    "zera",
				ServiceURL:     "",
				DefaultRole:    "user",
				AutoCreateUser: true,
			}, nil
		}
		return nil, err
	}

	var config CASConfig
	if err := json.Unmarshal([]byte(setting.Value), &config); err != nil {
		return nil, fmt.Errorf("failed to parse CAS config: %w", err)
	}

	return &config, nil
}

// UpdateCASConfig 更新 CAS 配置
func (s *CASAuthService) UpdateCASConfig(ctx context.Context, config *CASConfig) error {
	configJSON, err := json.Marshal(config)
	if err != nil {
		return fmt.Errorf("failed to serialize CAS config: %w", err)
	}

	// 尝试更新
	n, err := s.client.SystemSetting.Update().
		Where(systemsetting.Key(SettingKeyCASConfig)).
		SetValue(string(configJSON)).
		Save(ctx)
	if err != nil {
		return err
	}

	// 如果没有更新任何记录，则创建新记录
	if n == 0 {
		_, err = s.client.SystemSetting.Create().
			SetKey(SettingKeyCASConfig).
			SetValue(string(configJSON)).
			SetType("json").
			SetGroup(SettingGroupSecurity).
			SetDescription("CAS 认证配置").
			Save(ctx)
		if err != nil {
			return err
		}
	}

	return nil
}

// IsCASEnabled 检查 CAS 是否启用
func (s *CASAuthService) IsCASEnabled(ctx context.Context) (bool, error) {
	config, err := s.GetCASConfig(ctx)
	if err != nil {
		return false, err
	}
	return config.Enabled, nil
}

// ============================================
// CAS 认证流程
// ============================================

// GetCASLoginURL 获取 CAS 登录 URL
func (s *CASAuthService) GetCASLoginURL(ctx context.Context, redirectURL string) (*base.GetCASLoginURLResponse, error) {
	config, err := s.GetCASConfig(ctx)
	if err != nil {
		return nil, err
	}

	if !config.Enabled {
		return &base.GetCASLoginURLResponse{
			LoginUrl:   "",
			CasEnabled: false,
		}, nil
	}

	// 构建服务 URL (回调地址)
	serviceURL := config.ServiceURL
	if redirectURL != "" {
		// 将原始重定向 URL 附加到 service URL
		parsedURL, err := url.Parse(serviceURL)
		if err == nil {
			q := parsedURL.Query()
			q.Set("redirect", redirectURL)
			parsedURL.RawQuery = q.Encode()
			serviceURL = parsedURL.String()
		}
	}

	// 去除 ServerURL 末尾的斜杠，避免生成双斜杠 URL
	serverURL := strings.TrimSuffix(config.ServerURL, "/")

	// 构建 CAS 登录 URL
	// 格式: {serverUrl}/cas/{organization}/{application}/login?service={serviceUrl}
	loginURL := fmt.Sprintf("%s/cas/%s/%s/login?service=%s",
		serverURL,
		config.Organization,
		config.Application,
		url.QueryEscape(serviceURL),
	)

	return &base.GetCASLoginURLResponse{
		LoginUrl:   loginURL,
		CasEnabled: true,
	}, nil
}

// ValidateTicket 验证 CAS 服务票据
func (s *CASAuthService) ValidateTicket(ctx context.Context, ticket, service string) (*CASUserInfo, error) {
	config, err := s.GetCASConfig(ctx)
	if err != nil {
		return nil, err
	}

	if !config.Enabled {
		return nil, ErrCASNotEnabled
	}

	// 去除 ServerURL 末尾的斜杠
	serverURL := strings.TrimSuffix(config.ServerURL, "/")

	// 构建验证 URL (使用 CAS 3.0 的 p3/serviceValidate 端点)
	validateURL := fmt.Sprintf("%s/cas/%s/%s/p3/serviceValidate?ticket=%s&service=%s",
		serverURL,
		config.Organization,
		config.Application,
		url.QueryEscape(ticket),
		url.QueryEscape(service),
	)

	// 发送验证请求
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, validateURL, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create CAS validation request: %w", err)
	}

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("CAS validation request failed: %w", err)
	}
	defer resp.Body.Close()

	// 读取响应
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read CAS response: %w", err)
	}

	// 解析 XML 响应
	var result CASServiceResponse
	if err := xml.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("failed to parse CAS response: %w", err)
	}

	// 检查认证结果
	if result.AuthenticationFailure != nil {
		return nil, fmt.Errorf("%w: %s - %s", ErrCASTicketInvalid, result.AuthenticationFailure.Code, result.AuthenticationFailure.Message)
	}

	if result.AuthenticationSuccess == nil {
		return nil, ErrCASTicketInvalid
	}

	// 提取用户信息
	attrs := result.AuthenticationSuccess.Attributes
	displayName := attrs.DisplayName
	if displayName == "" {
		displayName = attrs.Name
	}
	if displayName == "" {
		displayName = result.AuthenticationSuccess.User
	}

	externalID := attrs.ID
	if externalID == "" {
		externalID = result.AuthenticationSuccess.User
	}

	return &CASUserInfo{
		Username:    result.AuthenticationSuccess.User,
		Email:       attrs.Email,
		DisplayName: displayName,
		ExternalID:  externalID,
	}, nil
}

// CASCallback 处理 CAS 回调
func (s *CASAuthService) CASCallback(ctx context.Context, ticket, service string) (*base.CASCallbackResponse, error) {
	// 验证票据
	casUser, err := s.ValidateTicket(ctx, ticket, service)
	if err != nil {
		return nil, err
	}

	// 创建或更新用户
	u, isNewUser, err := s.CreateOrUpdateUser(ctx, casUser)
	if err != nil {
		return nil, err
	}

	// 获取安全设置
	settingService := NewSystemSettingService(s.client)
	securitySettings, err := s.getSecuritySettings(ctx, settingService)
	if err != nil {
		return nil, err
	}

	// 获取用户角色和权限
	roles, permissions := s.extractRolesAndPermissions(u)

	// 生成令牌
	accessToken, err := s.jwtManager.GenerateAccessTokenWithExpire(u.ID, u.Username, roles, permissions, securitySettings.sessionTimeout)
	if err != nil {
		return nil, err
	}

	refreshToken, err := s.jwtManager.GenerateRefreshToken(u.ID, u.Username)
	if err != nil {
		return nil, err
	}

	// 更新最后登录时间
	_, err = u.Update().
		SetLastLoginAt(time.Now()).
		Save(ctx)
	if err != nil {
		// 非致命错误，继续
	}

	// 构建用户信息
	userInfo := s.buildUserInfo(u, permissions)

	return &base.CASCallbackResponse{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		ExpiresIn:    int64(securitySettings.sessionTimeout * 60),
		User:         userInfo,
		IsNewUser:    isNewUser,
	}, nil
}

// CreateOrUpdateUser 根据 CAS 用户信息创建或更新本地用户
func (s *CASAuthService) CreateOrUpdateUser(ctx context.Context, casUser *CASUserInfo) (*ent.User, bool, error) {
	config, err := s.GetCASConfig(ctx)
	if err != nil {
		return nil, false, err
	}

	// 先尝试通过 external_id 查找 CAS 用户
	u, err := s.client.User.Query().
		Where(
			user.AuthProviderEQ(user.AuthProviderCas),
			user.ExternalIDEQ(casUser.ExternalID),
		).
		WithRoles(func(q *ent.RoleQuery) {
			q.WithPermissions()
		}).
		Only(ctx)

	if err == nil {
		// 用户已存在，更新信息
		update := u.Update()
		if casUser.Email != "" && casUser.Email != u.Email {
			// 检查邮箱是否被其他用户使用
			exists, _ := s.client.User.Query().
				Where(user.Email(casUser.Email), user.IDNEQ(u.ID)).
				Exist(ctx)
			if !exists {
				update = update.SetEmail(casUser.Email)
			}
		}
		if casUser.DisplayName != "" {
			update = update.SetNickname(casUser.DisplayName)
		}

		u, err = update.Save(ctx)
		if err != nil {
			return nil, false, err
		}

		// 重新加载用户（带角色和权限）
		u, err = s.client.User.Query().
			Where(user.ID(u.ID)).
			WithRoles(func(q *ent.RoleQuery) {
				q.WithPermissions()
			}).
			Only(ctx)
		if err != nil {
			return nil, false, err
		}

		return u, false, nil
	}

	if !ent.IsNotFound(err) {
		return nil, false, err
	}

	// 用户不存在，检查是否允许自动创建
	if !config.AutoCreateUser {
		return nil, false, errors.New("user does not exist and auto-creation is disabled")
	}

	// 检查用户名冲突
	username := casUser.Username
	existingUser, err := s.client.User.Query().
		Where(user.Username(username)).
		Only(ctx)
	if err == nil {
		// 用户名已存在，添加 CAS 前缀和外部 ID 后缀以区分
		// 无论是本地用户还是其他 CAS 用户，都使用唯一用户名
		externalIDSuffix := casUser.ExternalID
		if len(externalIDSuffix) > 8 {
			externalIDSuffix = externalIDSuffix[:8]
		}
		if existingUser.AuthProvider == user.AuthProviderLocal {
			// 本地用户已使用该用户名，为 CAS 用户添加前缀
			username = fmt.Sprintf("cas_%s_%s", casUser.Username, externalIDSuffix)
		} else {
			// 其他 CAS 用户已使用该用户名，添加后缀
			username = fmt.Sprintf("%s_%s", casUser.Username, externalIDSuffix)
		}
	} else if !ent.IsNotFound(err) {
		return nil, false, err
	}

	// 检查邮箱冲突
	email := casUser.Email
	if email == "" {
		email = fmt.Sprintf("%s@cas.local", username)
	} else {
		exists, _ := s.client.User.Query().
			Where(user.Email(email)).
			Exist(ctx)
		if exists {
			// 邮箱已被使用，生成一个唯一的邮箱
			email = fmt.Sprintf("%s_%s@cas.local", username, casUser.ExternalID[:8])
		}
	}

	// 创建新用户
	userCreate := s.client.User.Create().
		SetUsername(username).
		SetEmail(email).
		SetPasswordHash("CAS_USER_NO_PASSWORD"). // CAS 用户没有本地密码
		SetNickname(casUser.DisplayName).
		SetStatus(user.StatusActive).
		SetAuthProvider(user.AuthProviderCas).
		SetExternalID(casUser.ExternalID)

	// 分配默认角色
	if config.DefaultRole != "" {
		defaultRole, err := s.client.Role.Query().
			Where(role.Code(config.DefaultRole)).
			Only(ctx)
		if err == nil {
			userCreate = userCreate.AddRoles(defaultRole)
		}
	}

	u, err = userCreate.Save(ctx)
	if err != nil {
		return nil, false, fmt.Errorf("%w: %v", ErrCASUserCreateFailed, err)
	}

	// 重新加载用户（带角色和权限）
	u, err = s.client.User.Query().
		Where(user.ID(u.ID)).
		WithRoles(func(q *ent.RoleQuery) {
			q.WithPermissions()
		}).
		Only(ctx)
	if err != nil {
		return nil, false, err
	}

	return u, true, nil
}

// GetPublicCASSettings 获取公开的 CAS 设置
func (s *CASAuthService) GetPublicCASSettings(ctx context.Context) (*base.GetPublicCASSettingsResponse, error) {
	config, err := s.GetCASConfig(ctx)
	if err != nil {
		return nil, err
	}

	return &base.GetPublicCASSettingsResponse{
		CasEnabled:      config.Enabled,
		LoginButtonText: "使用企业账号登录",
	}, nil
}

// CASLogout CAS 登出
func (s *CASAuthService) CASLogout(ctx context.Context, accessToken string) (*base.CASLogoutResponse, error) {
	config, err := s.GetCASConfig(ctx)
	if err != nil {
		return nil, err
	}

	// 构建 CAS 登出 URL
	logoutURL := ""
	if config.Enabled {
		// 去除 ServerURL 末尾的斜杠
		serverURL := strings.TrimSuffix(config.ServerURL, "/")
		// CAS 登出后重定向回服务首页
		logoutURL = fmt.Sprintf("%s/cas/%s/%s/logout?service=%s",
			serverURL,
			config.Organization,
			config.Application,
			url.QueryEscape(config.ServiceURL),
		)
	}

	return &base.CASLogoutResponse{
		Success:   true,
		LogoutUrl: logoutURL,
	}, nil
}

// TestCASConnection 测试 CAS 连接
func (s *CASAuthService) TestCASConnection(ctx context.Context, config *CASConfig) (*base.TestCASConnectionResponse, error) {
	if config == nil {
		var err error
		config, err = s.GetCASConfig(ctx)
		if err != nil {
			return nil, err
		}
	}

	if config.ServerURL == "" {
		return &base.TestCASConnectionResponse{
			Success:      false,
			ErrorMessage: "CAS server URL is not configured",
		}, nil
	}

	// 去除 ServerURL 末尾的斜杠
	serverURL := strings.TrimSuffix(config.ServerURL, "/")

	// 尝试访问 CAS 服务器
	testURL := fmt.Sprintf("%s/cas/%s/%s/login",
		serverURL,
		config.Organization,
		config.Application,
	)

	req, err := http.NewRequestWithContext(ctx, http.MethodHead, testURL, nil)
	if err != nil {
		return &base.TestCASConnectionResponse{
			Success:      false,
			ErrorMessage: fmt.Sprintf("failed to create request: %v", err),
		}, nil
	}

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return &base.TestCASConnectionResponse{
			Success:      false,
			ErrorMessage: fmt.Sprintf("failed to connect: %v", err),
		}, nil
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		return &base.TestCASConnectionResponse{
			Success:      false,
			ErrorMessage: fmt.Sprintf("server returned status %d", resp.StatusCode),
		}, nil
	}

	return &base.TestCASConnectionResponse{
		Success:       true,
		ServerVersion: "Casdoor CAS",
	}, nil
}

// ============================================
// 辅助方法
// ============================================

// securitySettingsData 安全设置数据 (复用)
type casSecuritySettingsData struct {
	sessionTimeout int
}

// getSecuritySettings 获取安全设置
func (s *CASAuthService) getSecuritySettings(ctx context.Context, settingService *SystemSettingService) (*casSecuritySettingsData, error) {
	resp, err := settingService.GetAllSettings(ctx)
	if err != nil {
		return &casSecuritySettingsData{
			sessionTimeout: 60,
		}, nil
	}

	settings := &casSecuritySettingsData{
		sessionTimeout: 60,
	}

	if resp.Settings != nil && resp.Settings.Security != nil {
		if resp.Settings.Security.SessionTimeout > 0 {
			settings.sessionTimeout = int(resp.Settings.Security.SessionTimeout)
		}
	}

	return settings, nil
}

// extractRolesAndPermissions 从用户实体中提取角色和权限
func (s *CASAuthService) extractRolesAndPermissions(u *ent.User) ([]string, []string) {
	roles := make([]string, 0, len(u.Edges.Roles))
	permissionSet := make(map[string]bool)
	isAdmin := false

	for _, r := range u.Edges.Roles {
		roles = append(roles, r.Code)
		if r.Code == "admin" || r.Code == "super_admin" {
			isAdmin = true
		}
		for _, p := range r.Edges.Permissions {
			permissionSet[p.Code] = true
		}
	}

	if isAdmin {
		return roles, []string{"*"}
	}

	permissions := make([]string, 0, len(permissionSet))
	for code := range permissionSet {
		permissions = append(permissions, code)
	}

	return roles, permissions
}

// buildUserInfo 构建用户信息
func (s *CASAuthService) buildUserInfo(u *ent.User, permissions []string) *base.UserInfo {
	roles := make([]string, 0, len(u.Edges.Roles))
	for _, r := range u.Edges.Roles {
		roles = append(roles, r.Code)
	}

	return &base.UserInfo{
		Id:          strconv.Itoa(u.ID),
		Username:    u.Username,
		Nickname:    u.Nickname,
		Avatar:      u.Avatar,
		Email:       u.Email,
		Roles:       roles,
		Permissions: permissions,
	}
}

// ConvertToCASConfigProto 转换 CASConfig 为 Proto 消息
func ConvertToCASConfigProto(config *CASConfig) *base.CASConfig {
	return &base.CASConfig{
		Enabled:        config.Enabled,
		ServerUrl:      config.ServerURL,
		Organization:   config.Organization,
		Application:    config.Application,
		ServiceUrl:     config.ServiceURL,
		DefaultRole:    config.DefaultRole,
		AutoCreateUser: config.AutoCreateUser,
	}
}

// ConvertFromCASConfigProto 从 Proto 消息转换为 CASConfig
func ConvertFromCASConfigProto(proto *base.CASConfig) *CASConfig {
	return &CASConfig{
		Enabled:        proto.Enabled,
		ServerURL:      proto.ServerUrl,
		Organization:   proto.Organization,
		Application:    proto.Application,
		ServiceURL:     proto.ServiceUrl,
		DefaultRole:    proto.DefaultRole,
		AutoCreateUser: proto.AutoCreateUser,
	}
}
