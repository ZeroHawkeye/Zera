import { createLazyRoute } from '@tanstack/react-router'
import { useState } from 'react'
import {
  Table,
  Button,
  Space,
  Input,
  Card,
  Tag,
  Avatar,
  Dropdown,
  Modal,
  Empty,
  Skeleton,
  Pagination
} from 'antd'
import {
  Plus,
  Search,
  Edit,
  Trash2,
  MoreVertical,
  Mail,
  Calendar
} from 'lucide-react'
import type { ColumnsType } from 'antd/es/table'
import type { MenuProps } from 'antd'
import { useResponsive, useUsers, UserStatus } from '@/hooks'

export const Route = createLazyRoute('/admin/users/')({
  component: UserList,
})

import type { UserDetail } from '@/api/user'

// 兼容后端 UserStatus 枚举
const STATUS_MAP = {
  1: 'active', // ACTIVE
  2: 'inactive', // INACTIVE
  3: 'inactive', // BANNED
} as const

/**
 * 用户状态配置
 */
const STATUS_CONFIG = {
  active: { color: 'green', text: '活跃', dotClass: 'bg-green-500' },
  inactive: { color: 'default', text: '未激活', dotClass: 'bg-gray-400' },
}

/**
 * 角色颜色配置
 */
const ROLE_COLORS: Record<string, string> = {
  '管理员': 'blue',
  '编辑': 'purple',
  '普通用户': 'default',
}

/**
 * 移动端用户卡片组件
 * 优化了触摸体验和信息展示
 */
function UserCard({ 
  user, 
  onEdit, 
  onDelete 
}: { 
  user: UserDetail
  onEdit: (user: UserDetail) => void
  onDelete: (user: UserDetail) => void 
}) {
  // 兼容后端 UserStatus 枚举
  const statusKey = STATUS_MAP[user.status as keyof typeof STATUS_MAP] || 'inactive'
  const statusConfig = STATUS_CONFIG[statusKey]

  const menuItems: MenuProps['items'] = [
    {
      key: 'edit',
      icon: <Edit className="w-4 h-4" />,
      label: '编辑',
      onClick: () => onEdit(user),
    },
    {
      type: 'divider',
    },
    {
      key: 'delete',
      icon: <Trash2 className="w-4 h-4" />,
      label: '删除',
      danger: true,
      onClick: () => onDelete(user),
    },
  ]

  return (
    <div className="p-4 rounded-2xl bg-white/70 backdrop-blur-sm border border-white/50 shadow-sm hover:shadow-md transition-all duration-300 active:scale-[0.99]">
      {/* 头部：用户信息 + 操作 */}
      <div className="flex items-start gap-3">
        {/* 头像 */}
        <div className="relative flex-shrink-0">
          <Avatar 
            size={48}
            src={user.avatar}
            className="bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/20"
          >
            {user.nickname?.charAt(0) || user.username?.charAt(0) || '-'}
          </Avatar>
          {/* 状态指示点 */}
          <div 
            className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white ${statusConfig.dotClass}`}
          />
        </div>
        
        {/* 用户信息 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-900 truncate">{user.nickname || user.username}</span>
            <Tag 
              color={ROLE_COLORS[user.roles?.[0]] || 'default'} 
              className="!mr-0 !text-xs"
            >
              {user.roles?.[0] || '-'}
            </Tag>
          </div>
          <div className="flex items-center gap-1.5 mt-1 text-sm text-gray-500">
            <Mail className="w-3.5 h-3.5" />
            <span className="truncate">{user.email}</span>
          </div>
        </div>
        
        {/* 更多操作 */}
        <Dropdown menu={{ items: menuItems }} trigger={['click']} placement="bottomRight">
          <Button
            type="text"
            size="small"
            icon={<MoreVertical className="w-4 h-4" />}
            className="!text-gray-400 hover:!text-gray-600 hover:!bg-gray-100/80"
          />
        </Dropdown>
      </div>
      
      {/* 底部：元信息 */}
      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-100">
        <div className="flex items-center gap-1.5 text-xs text-gray-400">
          <Calendar className="w-3.5 h-3.5" />
          <span>{user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '-'}</span>
        </div>
        <Tag 
          color={statusConfig.color} 
          className="!m-0 !text-xs ml-auto"
        >
          {statusConfig.text}
        </Tag>
      </div>
    </div>
  )
}

/**
 * 加载骨架屏组件
 */
function UserListSkeleton({ isMobile }: { isMobile: boolean }) {
  if (isMobile) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="p-4 rounded-2xl bg-white/70 backdrop-blur-sm border border-white/50">
            <div className="flex items-start gap-3">
              <Skeleton.Avatar active size={48} />
              <div className="flex-1">
                <Skeleton.Input active size="small" className="!w-32" />
                <Skeleton.Input active size="small" className="!w-48 !mt-2" />
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <Card className="overflow-hidden !rounded-2xl !border-white/50 !bg-white/70 backdrop-blur-sm">
      <Skeleton active paragraph={{ rows: 5 }} />
    </Card>
  )
}

/**
 * 用户列表页面
 * 支持移动端和桌面端自适应布局
 */
function UserList() {
  const { isMobile } = useResponsive()
  const [searchValue, setSearchValue] = useState('')
  const {
    users,
    total,
    loading,
    pagination,
    updatePagination,
    search,
    error,
  } = useUsers()

  // 桌面端表格列配置
  const columns: ColumnsType<any> = [
    {
      title: '用户',
      dataIndex: 'name',
      key: 'name',
      render: (_: string, record) => {
        // 兼容后端 UserStatus 枚举
        const statusKey = STATUS_MAP[record.status as keyof typeof STATUS_MAP] || 'inactive'
        const statusConfig = STATUS_CONFIG[statusKey]
        return (
          <div className="flex items-center gap-3">
            <div className="relative">
              <Avatar 
                src={record.avatar}
                className="bg-gradient-to-br from-indigo-500 to-purple-600 shadow-md shadow-indigo-500/20"
              >
                {record.nickname?.charAt(0) || record.username?.charAt(0) || '-'}
              </Avatar>
              <div 
                className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white ${statusConfig.dotClass}`}
              />
            </div>
            <div className="min-w-0">
              <div className="font-medium text-gray-900">{record.nickname || record.username}</div>
              <div className="text-sm text-gray-500">{record.email}</div>
            </div>
          </div>
        )
      },
    },
    {
      title: '角色',
      dataIndex: 'role',
      key: 'role',
      width: 120,
      render: (_: string, record) => (
        <Tag color={ROLE_COLORS[record.roles?.[0]] || 'default'}>{record.roles?.[0] || '-'}</Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (_: any, record) => {
        const status = record.status === UserStatus.ACTIVE ? 'active' : 'inactive'
        const config = STATUS_CONFIG[status]
        return <Tag color={config.color}>{config.text}</Tag>
      },
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 120,
      render: (createdAt: string) => createdAt ? new Date(createdAt).toLocaleDateString() : '-',
    },
    {
      title: '操作',
      key: 'actions',
      width: 100,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button
            type="text"
            size="small"
            icon={<Edit className="w-4 h-4" />}
            onClick={() => handleEdit(record)}
            className="!text-gray-500 hover:!text-indigo-600 hover:!bg-indigo-50"
          />
          <Button
            type="text"
            danger
            size="small"
            icon={<Trash2 className="w-4 h-4" />}
            onClick={() => handleDelete(record)}
          />
        </Space>
      ),
    },
  ]

  const handleEdit = (user: UserDetail) => {
    // TODO: 实现编辑功能
    console.log('Edit user:', user)
  }

  const handleDelete = (user: UserDetail) => {
    // TODO: 实现删除确认弹窗
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除用户「${user.nickname || user.username}」吗？此操作不可恢复。`,
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: () => {
        console.log('Delete user:', user)
      },
    })
  }

  const handleAddUser = () => {
    // TODO: 实现添加用户功能
    console.log('Add user')
  }

  // 加载或错误状态
  if (loading) {
    return (
      <div className="space-y-4 md:space-y-6">
        <PageHeader onAdd={handleAddUser} isMobile={isMobile} />
        <UserListSkeleton isMobile={isMobile} />
      </div>
    )
  }
  if (error) {
    return (
      <div className="space-y-4 md:space-y-6">
        <PageHeader onAdd={handleAddUser} isMobile={isMobile} />
        <Card className="p-8 text-center text-red-500 bg-white/80">{error}</Card>
      </div>
    )
  }

  return (
    <div className="space-y-4 md:space-y-6">
      {/* 页面标题 */}
      <PageHeader onAdd={handleAddUser} isMobile={isMobile} />

      {/* 搜索和过滤 */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input
          placeholder="搜索用户名/邮箱/昵称..."
          prefix={<Search className="w-4 h-4 text-gray-400" />}
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          onPressEnter={() => search(searchValue)}
          allowClear
          className="w-full sm:max-w-xs !rounded-xl"
        />
        <Button type="default" onClick={() => search(searchValue)}>
          <Search className="w-4 h-4" /> 查询
        </Button>
        {/* TODO: 添加筛选器 */}
      </div>

      {/* 用户列表 */}
      {users.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={searchValue ? '没有找到匹配的用户' : '暂无用户数据'}
          className="!my-16"
        />
      ) : isMobile ? (
        /* 移动端：卡片列表 */
        <div className="space-y-3">
          {users.map((user) => (
            <UserCard
              key={user.id}
              user={user}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}
          {/* 移动端分页 */}
          <div className="flex justify-center pt-4">
            <Pagination
              current={pagination.page}
              total={total}
              pageSize={pagination.pageSize}
              onChange={(page, pageSize) => updatePagination(page, pageSize)}
              simple
              showSizeChanger={false}
            />
          </div>
        </div>
      ) : (
        /* 桌面端：表格 */
        <Card className="overflow-hidden !rounded-2xl !border-white/50 !bg-white/70 backdrop-blur-sm shadow-sm">
          <Table
            columns={columns}
            dataSource={users}
            rowKey="id"
            scroll={{ x: 800 }}
            pagination={{
              current: pagination.page,
              total,
              pageSize: pagination.pageSize,
              onChange: updatePagination,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total) => `共 ${total} 条`,
            }}
          />
        </Card>
      )}
    </div>
  )
}

/**
 * 页面标题组件
 */
function PageHeader({
  onAdd,
  isMobile
}: {
  onAdd: () => void
  isMobile: boolean
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-xl md:text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
          用户管理
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          管理系统中的所有用户账户
        </p>
      </div>
      <Button
        type="primary"
        icon={<Plus className="w-4 h-4" />}
        onClick={onAdd}
        className={`
          !rounded-xl !h-10 !px-5 !font-medium
          !bg-gradient-to-r !from-indigo-500 !to-purple-600 
          hover:!from-indigo-600 hover:!to-purple-700
          !border-0 !shadow-lg !shadow-indigo-500/25
          ${isMobile ? 'w-full' : 'self-start sm:self-auto'}
        `}
      >
        添加用户
      </Button>
    </div>
  )
}
