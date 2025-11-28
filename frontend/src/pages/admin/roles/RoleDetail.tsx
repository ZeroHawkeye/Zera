import { createLazyRoute, useParams } from '@tanstack/react-router'
import { Card, Descriptions, Tag, Button, Space, Table, Checkbox } from 'antd'
import { ArrowLeft, Edit, Save } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import type { ColumnsType } from 'antd/es/table'

export const Route = createLazyRoute('/admin/roles/$roleId')({  
  component: RoleDetail,
})

interface Permission {
  id: string
  name: string
  code: string
  module: string
  enabled: boolean
}

/**
 * 角色详情页面
 */
function RoleDetail() {
  const { roleId } = useParams({ strict: false })

  // TODO: 从 API 获取角色详情
  const role = {
    id: roleId,
    name: '管理员',
    description: '拥有大部分管理权限',
    createdAt: '2024-01-15',
    updatedAt: '2024-11-20',
  }

  // TODO: 从 API 获取权限列表
  const permissions: Permission[] = [
    { id: '1', name: '查看用户', code: 'user:read', module: '用户管理', enabled: true },
    { id: '2', name: '编辑用户', code: 'user:write', module: '用户管理', enabled: true },
    { id: '3', name: '删除用户', code: 'user:delete', module: '用户管理', enabled: false },
    { id: '4', name: '查看角色', code: 'role:read', module: '角色管理', enabled: true },
    { id: '5', name: '编辑角色', code: 'role:write', module: '角色管理', enabled: false },
  ]

  const columns: ColumnsType<Permission> = [
    {
      title: '权限名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '权限代码',
      dataIndex: 'code',
      key: 'code',
      render: (code: string) => <Tag>{code}</Tag>,
    },
    {
      title: '所属模块',
      dataIndex: 'module',
      key: 'module',
    },
    {
      title: '启用',
      dataIndex: 'enabled',
      key: 'enabled',
      render: (enabled: boolean) => (
        <Checkbox checked={enabled} onChange={() => {/* TODO: 实现权限切换 */}} />
      ),
    },
  ]

  return (
    <div className="space-y-6">
      {/* 返回按钮和标题 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/admin/roles">
            <Button type="text" icon={<ArrowLeft className="w-4 h-4" />}>
              返回
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">角色详情</h1>
          </div>
        </div>
        <Space>
          <Button icon={<Edit className="w-4 h-4" />}>编辑</Button>
          <Button type="primary" icon={<Save className="w-4 h-4" />}>
            保存权限
          </Button>
        </Space>
      </div>

      {/* 角色基本信息 */}
      <Card title="基本信息">
        <Descriptions column={2}>
          <Descriptions.Item label="角色ID">{role.id}</Descriptions.Item>
          <Descriptions.Item label="角色名称">{role.name}</Descriptions.Item>
          <Descriptions.Item label="描述" span={2}>{role.description}</Descriptions.Item>
          <Descriptions.Item label="创建时间">{role.createdAt}</Descriptions.Item>
          <Descriptions.Item label="更新时间">{role.updatedAt}</Descriptions.Item>
        </Descriptions>
      </Card>

      {/* 权限配置 */}
      <Card title="权限配置">
        <Table
          columns={columns}
          dataSource={permissions}
          rowKey="id"
          pagination={false}
        />
      </Card>
    </div>
  )
}
