package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

// AuditLog holds the schema definition for the AuditLog entity.
type AuditLog struct {
	ent.Schema
}

// Fields of the AuditLog.
func (AuditLog) Fields() []ent.Field {
	return []ent.Field{
		field.Enum("level").
			Values("info", "warning", "error", "debug").
			Default("info").
			Comment("日志级别"),
		field.String("module").
			MaxLen(100).
			Comment("模块名称"),
		field.String("action").
			MaxLen(100).
			Comment("操作名称"),
		field.String("resource").
			Optional().
			MaxLen(100).
			Comment("资源类型"),
		field.String("resource_id").
			Optional().
			MaxLen(100).
			Comment("资源ID"),
		field.Int("user_id").
			Optional().
			Nillable().
			Comment("操作用户ID"),
		field.String("username").
			Optional().
			MaxLen(100).
			Comment("操作用户名"),
		field.String("ip").
			Optional().
			MaxLen(50).
			Comment("客户端IP地址"),
		field.String("user_agent").
			Optional().
			MaxLen(500).
			Comment("用户代理"),
		field.String("method").
			Optional().
			MaxLen(20).
			Comment("请求方法"),
		field.String("path").
			Optional().
			MaxLen(500).
			Comment("请求路径"),
		field.Int("status_code").
			Optional().
			Nillable().
			Comment("响应状态码"),
		field.Int64("duration_ms").
			Optional().
			Nillable().
			Comment("请求耗时(毫秒)"),
		field.String("error_message").
			Optional().
			MaxLen(2000).
			Comment("错误信息"),
		field.Text("request_body").
			Optional().
			Comment("请求体(敏感信息已脱敏)"),
		field.Text("response_body").
			Optional().
			Comment("响应体(可选)"),
		field.Text("details").
			Optional().
			Comment("详细信息(JSON格式)"),
		field.Time("created_at").
			Default(time.Now).
			Immutable().
			Comment("创建时间"),
	}
}

// Edges of the AuditLog.
func (AuditLog) Edges() []ent.Edge {
	return nil
}

// Indexes of the AuditLog.
func (AuditLog) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("level"),
		index.Fields("module"),
		index.Fields("action"),
		index.Fields("user_id"),
		index.Fields("username"),
		index.Fields("ip"),
		index.Fields("created_at"),
		index.Fields("resource", "resource_id"),
	}
}
