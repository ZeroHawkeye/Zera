import { createLazyRoute } from '@tanstack/react-router'
import { Table, Button, Space, Card, Tag, Modal } from 'antd'
import { Plus, Edit, Trash2, Shield } from 'lucide-react'
import type { ColumnsType } from 'antd/es/table'
import { useState } from 'react'

export const Route = createLazyRoute('/admin/roles/')({  
  component: RoleList,
})

interface Role {
  id: string
  name: string
  description: string
  permissions: string[]
  userCount: number
  createdAt: string
}

/**
 * 角色列表页面
 */
function RoleList() {
  const [isModalOpen, setIsModalOpen] = useState(false)

  // TODO: 从 API 获取角色数据
  const roles: Role[] = [
    {
      id: '1',
      name: '超级管理员',
      description: '拥有系统所有权限',
      permissions: ['*'],
      userCount: 2,
      createdAt: '2024-01-01',
    },
    {
      id: '2',
      name: '管理员',
      description: '拥有大部分管理权限',
      permissions: ['user:read', 'user:write', 'role:read'],
      userCount: 5,
      createdAt: '2024-01-15',
    },
    {
      id: '3',
      name: '普通用户',
      description: '基础访问权限',
      permissions: ['user:read'],
      userCount: 100,
      createdAt: '2024-02-01',
    },
  ]

  const columns: ColumnsType<Role> = [
    {
      title: '角色名称',
      dataIndex: 'name',
      key: 'name',
      render: (name: string) => (
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-blue-500" />
          <span className="font-medium">{name}</span>
        </div>
      ),
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      className: 'text-gray-500',
    },
    {
      title: '权限数',
      dataIndex: 'permissions',
      key: 'permissions',
      render: (permissions: string[]) => (
        <Tag color="blue">{permissions.length} 个权限</Tag>
      ),
    },
    {
      title: '用户数',
      dataIndex: 'userCount',
      key: 'userCount',
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
    },
    {
      title: '操作',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button
            type="text"
            icon={<Edit className="w-4 h-4" />}
            onClick={() => handleEdit(record)}
          />
          <Button
            type="text"
            danger
            icon={<Trash2 className="w-4 h-4" />}
            onClick={() => handleDelete(record)}
            disabled={record.name === '超级管理员'}
          />
        </Space>
      ),
    },
  ]

  const handleEdit = (role: Role) => {
    // TODO: 实现编辑功能
    console.log('Edit role:', role)
  }

  const handleDelete = (role: Role) => {
    // TODO: 实现删除功能
    console.log('Delete role:', role)
  }

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">角色管理</h1>
          <p className="mt-1 text-sm text-gray-500">
            管理系统角色和权限配置
          </p>
        </div>
        <Button
          type="primary"
          icon={<Plus className="w-4 h-4" />}
          onClick={() => setIsModalOpen(true)}
        >
          添加角色
        </Button>
      </div>

      {/* 角色表格 */}
      <Card>
        <Table
          columns={columns}
          dataSource={roles}
          rowKey="id"
          pagination={{
            total: roles.length,
            pageSize: 10,
            showTotal: (total) => `共 ${total} 条记录`,
          }}
        />
      </Card>

      {/* 添加角色弹窗 */}
      <Modal
        title="添加角色"
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        footer={null}
      >
        {/* TODO: 实现角色表单 */}
        <p className="text-gray-500 text-center py-8">角色表单开发中...</p>
      </Modal>
    </div>
  )
}
