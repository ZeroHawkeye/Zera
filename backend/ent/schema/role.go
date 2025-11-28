package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

// Role holds the schema definition for the Role entity.
type Role struct {
	ent.Schema
}

// Fields of the Role.
func (Role) Fields() []ent.Field {
	return []ent.Field{
		field.String("code").
			Unique().
			NotEmpty().
			MaxLen(50).
			Comment("角色代码，如 admin、user、editor"),
		field.String("name").
			NotEmpty().
			MaxLen(100).
			Comment("角色显示名称"),
		field.String("description").
			Optional().
			MaxLen(500).
			Comment("角色描述"),
		field.Bool("is_system").
			Default(false).
			Comment("是否为系统内置角色，内置角色不可删除"),
		field.Int("sort_order").
			Default(0).
			Comment("排序顺序"),
		field.Time("created_at").
			Default(time.Now).
			Immutable().
			Comment("创建时间"),
		field.Time("updated_at").
			Default(time.Now).
			UpdateDefault(time.Now).
			Comment("更新时间"),
	}
}

// Edges of the Role.
func (Role) Edges() []ent.Edge {
	return []ent.Edge{
		// 角色属于多个用户（反向边）
		edge.From("users", User.Type).
			Ref("roles"),
		// 角色拥有多个权限
		edge.To("permissions", Permission.Type),
	}
}

// Indexes of the Role.
func (Role) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("code"),
		index.Fields("is_system"),
	}
}
