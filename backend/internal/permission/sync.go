package permission

import (
	"context"
	"log/slog"

	"zera/ent"
	entPermission "zera/ent/permission"
)

// Syncer 权限同步器 - 负责将代码中定义的权限同步到数据库
type Syncer struct {
	client *ent.Client
	logger *slog.Logger
}

// NewSyncer 创建权限同步器
func NewSyncer(client *ent.Client, logger *slog.Logger) *Syncer {
	return &Syncer{
		client: client,
		logger: logger,
	}
}

// SyncResult 同步结果
type SyncResult struct {
	Created int
	Updated int
	Skipped int
}

// SyncPermissions 同步权限到数据库
// 策略：
// 1. 遍历代码中定义的所有权限
// 2. 如果数据库中不存在，则创建
// 3. 如果已存在，则更新名称和描述（权限代码不变）
// 4. 不删除数据库中多余的权限（避免意外删除已分配的权限）
func (s *Syncer) SyncPermissions(ctx context.Context) (*SyncResult, error) {
	s.logger.Info("开始同步权限到数据库")

	permissions := GetUniquePermissions()
	result := &SyncResult{}

	for _, p := range permissions {
		if p.Code == "" {
			continue
		}

		// 检查权限是否已存在
		existing, err := s.client.Permission.
			Query().
			Where(entPermission.CodeEQ(p.Code)).
			Only(ctx)

		if ent.IsNotFound(err) {
			// 创建新权限
			_, err = s.client.Permission.
				Create().
				SetCode(p.Code).
				SetName(p.Name).
				SetDescription(p.Description).
				SetResource(p.Resource).
				SetAction(p.Action).
				Save(ctx)

			if err != nil {
				s.logger.Error("创建权限失败", "code", p.Code, "error", err)
				return nil, err
			}
			result.Created++
			s.logger.Debug("创建权限", "code", p.Code, "name", p.Name)

		} else if err != nil {
			s.logger.Error("查询权限失败", "code", p.Code, "error", err)
			return nil, err

		} else {
			// 检查是否需要更新
			needUpdate := existing.Name != p.Name ||
				existing.Description != p.Description ||
				existing.Resource != p.Resource ||
				existing.Action != p.Action

			if needUpdate {
				_, err = existing.Update().
					SetName(p.Name).
					SetDescription(p.Description).
					SetResource(p.Resource).
					SetAction(p.Action).
					Save(ctx)

				if err != nil {
					s.logger.Error("更新权限失败", "code", p.Code, "error", err)
					return nil, err
				}
				result.Updated++
				s.logger.Debug("更新权限", "code", p.Code, "name", p.Name)
			} else {
				result.Skipped++
			}
		}
	}

	s.logger.Info("权限同步完成",
		"created", result.Created,
		"updated", result.Updated,
		"skipped", result.Skipped,
	)
	return result, nil
}

// ListOrphanPermissions 列出孤立权限（数据库中存在但代码中未定义的权限）
// 用于审计和清理
func (s *Syncer) ListOrphanPermissions(ctx context.Context) ([]string, error) {
	// 获取代码中定义的所有权限代码
	validCodes := make(map[string]bool)
	for _, p := range GetUniquePermissions() {
		if p.Code != "" {
			validCodes[p.Code] = true
		}
	}

	// 获取数据库中所有权限
	dbPermissions, err := s.client.Permission.Query().All(ctx)
	if err != nil {
		return nil, err
	}

	var orphans []string
	for _, dbP := range dbPermissions {
		if !validCodes[dbP.Code] {
			orphans = append(orphans, dbP.Code)
			s.logger.Warn("发现孤立权限", "code", dbP.Code, "name", dbP.Name)
		}
	}

	return orphans, nil
}

// CleanOrphanPermissions 清理孤立权限（谨慎使用）
// 这会删除数据库中存在但代码中未定义的权限
// 注意：这可能会影响已分配了这些权限的角色
func (s *Syncer) CleanOrphanPermissions(ctx context.Context) (int, error) {
	orphans, err := s.ListOrphanPermissions(ctx)
	if err != nil {
		return 0, err
	}

	if len(orphans) == 0 {
		return 0, nil
	}

	deleted, err := s.client.Permission.
		Delete().
		Where(entPermission.CodeIn(orphans...)).
		Exec(ctx)

	if err != nil {
		return 0, err
	}

	s.logger.Info("清理孤立权限完成", "deleted", deleted)
	return deleted, nil
}

// ValidateRolePermissions 验证角色的权限是否都有效
// 返回角色拥有的无效权限代码
func (s *Syncer) ValidateRolePermissions(ctx context.Context, roleID int) ([]string, error) {
	role, err := s.client.Role.
		Query().
		Where().
		WithPermissions().
		Only(ctx)

	if err != nil {
		return nil, err
	}

	validCodes := make(map[string]bool)
	for _, p := range GetUniquePermissions() {
		if p.Code != "" {
			validCodes[p.Code] = true
		}
	}

	var invalid []string
	for _, p := range role.Edges.Permissions {
		if !validCodes[p.Code] {
			invalid = append(invalid, p.Code)
		}
	}

	return invalid, nil
}
