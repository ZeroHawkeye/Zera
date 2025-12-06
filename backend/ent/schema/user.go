package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

// User holds the schema definition for the User entity.
type User struct {
	ent.Schema
}

// Fields of the User.
func (User) Fields() []ent.Field {
	return []ent.Field{
		field.String("username").
			Unique().
			NotEmpty().
			MaxLen(50).
			Comment("用户名"),
		field.String("email").
			Unique().
			NotEmpty().
			MaxLen(255).
			Comment("邮箱地址"),
		field.String("password_hash").
			Sensitive().
			NotEmpty().
			Comment("密码哈希"),
		field.String("nickname").
			Optional().
			MaxLen(100).
			Comment("昵称"),
		field.String("avatar").
			Optional().
			MaxLen(500).
			Comment("头像URL"),
		field.Enum("status").
			Values("active", "inactive", "banned").
			Default("active").
			Comment("用户状态"),
		field.Enum("auth_provider").
			Values("local", "cas").
			Default("local").
			Comment("认证来源: local(本地), cas(CAS单点登录)"),
		field.String("external_id").
			Optional().
			Nillable().
			MaxLen(255).
			Comment("外部系统用户ID (CAS user id)"),
		field.Time("created_at").
			Default(time.Now).
			Immutable().
			Comment("创建时间"),
		field.Time("updated_at").
			Default(time.Now).
			UpdateDefault(time.Now).
			Comment("更新时间"),
		field.Time("last_login_at").
			Optional().
			Nillable().
			Comment("最后登录时间"),
		field.Int("login_attempts").
			Default(0).
			Comment("登录失败次数"),
		field.Time("locked_until").
			Optional().
			Nillable().
			Comment("账号锁定截止时间"),
	}
}

// Edges of the User.
func (User) Edges() []ent.Edge {
	return []ent.Edge{
		// 用户可以拥有多个角色
		edge.To("roles", Role.Type),
	}
}

// Indexes of the User.
func (User) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("username"),
		index.Fields("email"),
		index.Fields("status"),
		index.Fields("created_at"),
		index.Fields("auth_provider"),
		index.Fields("external_id"),
		index.Fields("auth_provider", "external_id").Unique(),
	}
}
