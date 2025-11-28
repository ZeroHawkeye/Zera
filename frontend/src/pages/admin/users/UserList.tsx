import { createLazyRoute } from '@tanstack/react-router'
import { useState, useMemo } from 'react'
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
import { useResponsive } from '@/hooks'

export const Route = createLazyRoute('/admin/users/')({  
  component: UserList,
})

interface User {
  id: string
  name: string
  email: string
  role: string
  status: 'active' | 'inactive'
  avatar?: string
  createdAt: string
}

/**
 * 用户状态配置
 */
const STATUS_CONFIG = {
  active: { color: 'green', text: '活跃', dotClass: 'bg-green-500' },
  inactive: { color: 'default', text: '未激活', dotClass: 'bg-gray-400' },
} as const

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
  user: User
  onEdit: (user: User) => void
  onDelete: (user: User) => void 
}) {
  const statusConfig = STATUS_CONFIG[user.status]
  
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
            {user.name.charAt(0)}
          </Avatar>
          {/* 状态指示点 */}
          <div 
            className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white ${statusConfig.dotClass}`}
          />
        </div>
        
        {/* 用户信息 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-900 truncate">{user.name}</span>
            <Tag 
              color={ROLE_COLORS[user.role] || 'default'} 
              className="!mr-0 !text-xs"
            >
              {user.role}
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
          <span>{user.createdAt}</span>
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
  const [loading] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 10
  
  // TODO: 从 API 获取用户数据
  const users: User[] = [
    {
      id: '1',
      name: '张三',
      email: 'zhangsan@example.com',
      role: '管理员',
      status: 'active',
      createdAt: '2024-01-15',
    },
    {
      id: '2',
      name: '李四',
      email: 'lisi@example.com',
      role: '普通用户',
      status: 'active',
      createdAt: '2024-02-20',
    },
    {
      id: '3',
      name: '王五',
      email: 'wangwu@example.com',
      role: '编辑',
      status: 'inactive',
      createdAt: '2024-03-10',
    },
    {
      id: '4',
      name: '赵六',
      email: 'zhaoliu@example.com',
      role: '普通用户',
      status: 'active',
      createdAt: '2024-04-05',
    },
  ]

  // 过滤用户
  const filteredUsers = useMemo(() => {
    if (!searchValue) return users
    const search = searchValue.toLowerCase()
    return users.filter(
      user => 
        user.name.toLowerCase().includes(search) || 
        user.email.toLowerCase().includes(search)
    )
  }, [users, searchValue])

  // 桌面端表格列配置
  const columns: ColumnsType<User> = [
    {
      title: '用户',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record) => (
        <div className="flex items-center gap-3">
          <div className="relative">
            <Avatar 
              src={record.avatar}
              className="bg-gradient-to-br from-indigo-500 to-purple-600 shadow-md shadow-indigo-500/20"
            >
              {name.charAt(0)}
            </Avatar>
            <div 
              className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white ${STATUS_CONFIG[record.status].dotClass}`}
            />
          </div>
          <div className="min-w-0">
            <div className="font-medium text-gray-900">{name}</div>
            <div className="text-sm text-gray-500">{record.email}</div>
          </div>
        </div>
      ),
    },
    {
      title: '角色',
      dataIndex: 'role',
      key: 'role',
      width: 120,
      render: (role: string) => (
        <Tag color={ROLE_COLORS[role] || 'default'}>{role}</Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: 'active' | 'inactive') => {
        const config = STATUS_CONFIG[status]
        return <Tag color={config.color}>{config.text}</Tag>
      },
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 120,
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

  const handleEdit = (user: User) => {
    // TODO: 实现编辑功能
    console.log('Edit user:', user)
  }

  const handleDelete = (user: User) => {
    // TODO: 实现删除确认弹窗
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除用户「${user.name}」吗？此操作不可恢复。`,
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

  // 加载状态
  if (loading) {
    return (
      <div className="space-y-4 md:space-y-6">
        <PageHeader onAdd={handleAddUser} isMobile={isMobile} />
        <UserListSkeleton isMobile={isMobile} />
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
          placeholder="搜索用户名或邮箱..."
          prefix={<Search className="w-4 h-4 text-gray-400" />}
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          allowClear
          className="w-full sm:max-w-xs !rounded-xl"
        />
        {/* TODO: 添加筛选器 */}
      </div>

      {/* 用户列表 */}
      {filteredUsers.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={searchValue ? '没有找到匹配的用户' : '暂无用户数据'}
          className="!my-16"
        />
      ) : isMobile ? (
        /* 移动端：卡片列表 */
        <div className="space-y-3">
          {filteredUsers.map((user) => (
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
              current={currentPage}
              total={filteredUsers.length}
              pageSize={pageSize}
              onChange={setCurrentPage}
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
            dataSource={filteredUsers}
            rowKey="id"
            scroll={{ x: 800 }}
            pagination={{
              current: currentPage,
              total: filteredUsers.length,
              pageSize,
              onChange: setCurrentPage,
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
