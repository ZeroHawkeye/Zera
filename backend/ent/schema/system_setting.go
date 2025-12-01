package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

// SystemSetting 系统设置表，使用 key-value 形式存储配置
type SystemSetting struct {
	ent.Schema
}

// Fields of the SystemSetting.
func (SystemSetting) Fields() []ent.Field {
	return []ent.Field{
		field.String("key").
			Unique().
			NotEmpty().
			MaxLen(100).
			Comment("配置键名"),
		field.String("value").
			Optional().
			Comment("配置值（JSON格式存储复杂类型）"),
		field.String("type").
			Default("string").
			Comment("值类型: string, bool, int, json"),
		field.String("group").
			Default("general").
			Comment("配置分组: general, security, feature"),
		field.String("description").
			Optional().
			MaxLen(500).
			Comment("配置描述"),
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

// Edges of the SystemSetting.
func (SystemSetting) Edges() []ent.Edge {
	return nil
}

// Indexes of the SystemSetting.
func (SystemSetting) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("key"),
		index.Fields("group"),
	}
}
