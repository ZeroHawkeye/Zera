package auth

import (
	"errors"
	"strconv"
	"time"

	"zera/internal/config"

	"github.com/golang-jwt/jwt/v5"
)

// TokenType 令牌类型
type TokenType string

const (
	// AccessToken 访问令牌
	AccessToken TokenType = "access"
	// RefreshToken 刷新令牌
	RefreshToken TokenType = "refresh"
)

// Claims JWT 声明
type Claims struct {
	UserID      int       `json:"uid"`
	Username    string    `json:"username"`
	Roles       []string  `json:"roles,omitempty"`
	Permissions []string  `json:"permissions,omitempty"`
	Type        TokenType `json:"type"`
	jwt.RegisteredClaims
}

// JWTManager JWT 管理器
type JWTManager struct {
	secret             []byte
	accessTokenExpire  time.Duration
	refreshTokenExpire time.Duration
}

// NewJWTManager 创建 JWT 管理器
func NewJWTManager(cfg *config.JWTConfig) *JWTManager {
	return &JWTManager{
		secret:             []byte(cfg.Secret),
		accessTokenExpire:  time.Duration(cfg.AccessTokenExpire) * time.Second,
		refreshTokenExpire: time.Duration(cfg.RefreshTokenExpire) * time.Second,
	}
}

// GenerateAccessToken 生成访问令牌
func (m *JWTManager) GenerateAccessToken(userID int, username string, roles []string, permissions []string) (string, error) {
	return m.generateToken(userID, username, roles, permissions, AccessToken, m.accessTokenExpire)
}

// GenerateRefreshToken 生成刷新令牌
func (m *JWTManager) GenerateRefreshToken(userID int, username string) (string, error) {
	// 刷新令牌不包含角色和权限信息
	return m.generateToken(userID, username, nil, nil, RefreshToken, m.refreshTokenExpire)
}

// generateToken 生成令牌
func (m *JWTManager) generateToken(userID int, username string, roles []string, permissions []string, tokenType TokenType, expire time.Duration) (string, error) {
	now := time.Now()
	claims := Claims{
		UserID:      userID,
		Username:    username,
		Roles:       roles,
		Permissions: permissions,
		Type:        tokenType,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(now.Add(expire)),
			IssuedAt:  jwt.NewNumericDate(now),
			NotBefore: jwt.NewNumericDate(now),
			Subject:   strconv.Itoa(userID),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(m.secret)
}

// ParseToken 解析令牌
func (m *JWTManager) ParseToken(tokenString string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("unexpected signing method")
		}
		return m.secret, nil
	})

	if err != nil {
		return nil, err
	}

	if claims, ok := token.Claims.(*Claims); ok && token.Valid {
		return claims, nil
	}

	return nil, errors.New("invalid token")
}

// ValidateAccessToken 验证访问令牌
func (m *JWTManager) ValidateAccessToken(tokenString string) (*Claims, error) {
	claims, err := m.ParseToken(tokenString)
	if err != nil {
		return nil, err
	}

	if claims.Type != AccessToken {
		return nil, errors.New("invalid token type")
	}

	return claims, nil
}

// ValidateRefreshToken 验证刷新令牌
func (m *JWTManager) ValidateRefreshToken(tokenString string) (*Claims, error) {
	claims, err := m.ParseToken(tokenString)
	if err != nil {
		return nil, err
	}

	if claims.Type != RefreshToken {
		return nil, errors.New("invalid token type")
	}

	return claims, nil
}

// GetAccessTokenExpire 获取访问令牌过期时间（秒）
func (m *JWTManager) GetAccessTokenExpire() int64 {
	return int64(m.accessTokenExpire.Seconds())
}
