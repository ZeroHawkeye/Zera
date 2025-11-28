package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

// Permission holds the schema definition for the Permission entity.
type Permission struct {
	ent.Schema
}

// Fields of the Permission.
func (Permission) Fields() []ent.Field {
	return []ent.Field{
		field.String("code").
			Unique().
			NotEmpty().
			MaxLen(100).
			Comment("权限代码，如 user:create、user:read、user:update、user:delete"),
		field.String("name").
			NotEmpty().
			MaxLen(100).
			Comment("权限显示名称"),
		field.String("description").
			Optional().
			MaxLen(500).
			Comment("权限描述"),
		field.String("resource").
			NotEmpty().
			MaxLen(50).
			Comment("资源类型，如 user、role、article"),
		field.String("action").
			NotEmpty().
			MaxLen(50).
			Comment("操作类型，如 create、read、update、delete"),
		field.Time("created_at").
			Default(time.Now).
			Immutable().
			Comment("创建时间"),
	}
}

// Edges of the Permission.
func (Permission) Edges() []ent.Edge {
	return []ent.Edge{
		// 权限属于多个角色（反向边）
		edge.From("roles", Role.Type).
			Ref("permissions"),
	}
}

// Indexes of the Permission.
func (Permission) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("code"),
		index.Fields("resource"),
		index.Fields("action"),
		index.Fields("resource", "action"),
	}
}
