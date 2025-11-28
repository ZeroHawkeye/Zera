import { createLazyRoute, useParams } from '@tanstack/react-router'
import { Card, Descriptions, Tag, Button, Space, Avatar } from 'antd'
import { ArrowLeft, Edit, Trash2 } from 'lucide-react'
import { Link } from '@tanstack/react-router'

export const Route = createLazyRoute('/admin/users/$userId')({  
  component: UserDetail,
})

/**
 * 用户详情页面
 */
function UserDetail() {
  // TODO: 从路由参数获取用户 ID 并从 API 获取用户详情
  const { userId } = useParams({ strict: false })

  // TODO: 使用真实数据替换
  const user = {
    id: userId,
    name: '张三',
    email: 'zhangsan@example.com',
    phone: '13800138000',
    role: '管理员',
    status: 'active' as const,
    createdAt: '2024-01-15',
    lastLoginAt: '2024-11-28 10:30:00',
    department: '技术部',
  }

  return (
    <div className="space-y-6">
      {/* 返回按钮和标题 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/admin/users">
            <Button type="text" icon={<ArrowLeft className="w-4 h-4" />}>
              返回
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">用户详情</h1>
          </div>
        </div>
        <Space>
          <Button icon={<Edit className="w-4 h-4" />}>编辑</Button>
          <Button danger icon={<Trash2 className="w-4 h-4" />}>
            删除
          </Button>
        </Space>
      </div>

      {/* 用户信息卡片 */}
      <Card>
        <div className="flex items-start gap-6 mb-6">
          <Avatar size={80} className="bg-gradient-to-br from-blue-500 to-purple-600 text-2xl">
            {user.name.charAt(0)}
          </Avatar>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">{user.name}</h2>
            <p className="text-gray-500">{user.email}</p>
            <div className="mt-2">
              <Tag color={user.status === 'active' ? 'green' : 'default'}>
                {user.status === 'active' ? '活跃' : '未激活'}
              </Tag>
              <Tag color="blue">{user.role}</Tag>
            </div>
          </div>
        </div>

        <Descriptions column={2} bordered>
          <Descriptions.Item label="用户ID">{user.id}</Descriptions.Item>
          <Descriptions.Item label="手机号">{user.phone}</Descriptions.Item>
          <Descriptions.Item label="部门">{user.department}</Descriptions.Item>
          <Descriptions.Item label="角色">{user.role}</Descriptions.Item>
          <Descriptions.Item label="创建时间">{user.createdAt}</Descriptions.Item>
          <Descriptions.Item label="最后登录">{user.lastLoginAt}</Descriptions.Item>
        </Descriptions>
      </Card>

      {/* TODO: 添加用户活动日志、权限列表等 */}
    </div>
  )
}
