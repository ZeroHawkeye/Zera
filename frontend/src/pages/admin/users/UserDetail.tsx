import { createLazyRoute, useParams, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { Card, Descriptions, Tag, Button, Space, Avatar, Spin, Empty, Modal } from 'antd'
import { ArrowLeft, Edit, Trash2, Key, Mail, Calendar, Clock, User } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { useUser, useUserActions, UserStatus, useResponsive } from '@/hooks'
import { UserFormModal } from './UserFormModal'
import { ResetPasswordModal } from './ResetPasswordModal'

export const Route = createLazyRoute('/admin/users/$userId')({  
  component: UserDetailPage,
})

/**
 * 用户状态配置
 */
const STATUS_CONFIG = {
  [UserStatus.ACTIVE]: { color: 'green', text: '活跃' },
  [UserStatus.INACTIVE]: { color: 'default', text: '未激活' },
  [UserStatus.BANNED]: { color: 'red', text: '已禁用' },
  [UserStatus.UNSPECIFIED]: { color: 'default', text: '未知' },
}

/**
 * 用户详情页面
 */
function UserDetailPage() {
  const { isMobile } = useResponsive()
  const navigate = useNavigate()
  const { userId } = useParams({ strict: false })
  const { user, loading, error, refresh } = useUser(userId)
  const { deleteUser, loading: actionLoading } = useUserActions()

  // 模态框状态
  const [formModalOpen, setFormModalOpen] = useState(false)
  const [resetPasswordModalOpen, setResetPasswordModalOpen] = useState(false)

  // 编辑用户
  const handleEdit = () => {
    setFormModalOpen(true)
  }

  // 删除用户
  const handleDelete = () => {
    if (!user) return

    Modal.confirm({
      title: '确认删除',
      content: `确定要删除用户「${user.nickname || user.username}」吗？此操作不可恢复。`,
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      okButtonProps: { loading: actionLoading },
      onOk: async () => {
        try {
          await deleteUser(user.id)
          navigate({ to: '/admin/users' })
        } catch {
          // 错误已在 hook 中处理
        }
      },
    })
  }

  // 重置密码
  const handleResetPassword = () => {
    setResetPasswordModalOpen(true)
  }

  // 表单提交成功
  const handleFormSuccess = () => {
    refresh()
  }

  // 加载状态
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spin size="large" tip="加载中..." />
      </div>
    )
  }

  // 错误状态
  if (error || !user) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link to="/admin/users">
            <Button type="text" icon={<ArrowLeft className="w-4 h-4" />}>
              返回
            </Button>
          </Link>
        </div>
        <Empty
          description={error || '用户不存在'}
          className="!my-16"
        />
      </div>
    )
  }

  const statusConfig = STATUS_CONFIG[user.status] || STATUS_CONFIG[UserStatus.UNSPECIFIED]

  return (
    <div className="space-y-6">
      {/* 返回按钮和标题 */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Link to="/admin/users">
            <Button type="text" icon={<ArrowLeft className="w-4 h-4" />}>
              返回
            </Button>
          </Link>
          <div>
            <h1 className="text-xl md:text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
              用户详情
            </h1>
          </div>
        </div>
        <Space wrap className={isMobile ? 'w-full' : ''}>
          <Button 
            icon={<Key className="w-4 h-4" />} 
            onClick={handleResetPassword}
            className={isMobile ? 'flex-1' : ''}
          >
            重置密码
          </Button>
          <Button 
            icon={<Edit className="w-4 h-4" />} 
            onClick={handleEdit}
            className={isMobile ? 'flex-1' : ''}
          >
            编辑
          </Button>
          <Button 
            danger 
            icon={<Trash2 className="w-4 h-4" />}
            onClick={handleDelete}
            loading={actionLoading}
            className={isMobile ? 'flex-1' : ''}
          >
            删除
          </Button>
        </Space>
      </div>

      {/* 用户信息卡片 */}
      <Card className="overflow-hidden !rounded-2xl !border-white/50 !bg-white/70 backdrop-blur-sm shadow-sm">
        {/* 用户头部信息 */}
        <div className="flex flex-col items-center gap-6 mb-8 sm:flex-row sm:items-start">
          <Avatar 
            size={80} 
            src={user.avatar}
            className="bg-gradient-to-br from-blue-500 to-blue-600 text-2xl shadow-lg shadow-blue-500/20"
          >
            {user.nickname?.charAt(0) || user.username?.charAt(0) || <User className="w-8 h-8" />}
          </Avatar>
          <div className="text-center sm:text-left">
            <h2 className="text-xl font-semibold text-gray-900">
              {user.nickname || user.username}
            </h2>
            <p className="text-gray-500 flex items-center justify-center gap-1 mt-1 sm:justify-start">
              <User className="w-4 h-4" />
              @{user.username}
            </p>
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              <Tag color={statusConfig.color}>{statusConfig.text}</Tag>
              {user.roles?.map((role) => (
                <Tag key={role} color="blue">{role}</Tag>
              ))}
            </div>
          </div>
        </div>

        {/* 详细信息 */}
        <Descriptions 
          column={{ xs: 1, sm: 2, md: 2 }} 
          bordered
          size={isMobile ? 'small' : 'default'}
          className="user-detail-descriptions"
        >
          <Descriptions.Item 
            label={
              <span className="flex items-center gap-1">
                <User className="w-4 h-4 text-gray-400" />
                用户ID
              </span>
            }
          >
            <code className="px-2 py-0.5 bg-gray-100 rounded text-sm">{user.id}</code>
          </Descriptions.Item>
          <Descriptions.Item 
            label={
              <span className="flex items-center gap-1">
                <Mail className="w-4 h-4 text-gray-400" />
                邮箱
              </span>
            }
          >
            {user.email || '-'}
          </Descriptions.Item>
          <Descriptions.Item 
            label={
              <span className="flex items-center gap-1">
                <Calendar className="w-4 h-4 text-gray-400" />
                创建时间
              </span>
            }
          >
            {user.createdAt ? new Date(user.createdAt).toLocaleString() : '-'}
          </Descriptions.Item>
          <Descriptions.Item 
            label={
              <span className="flex items-center gap-1">
                <Clock className="w-4 h-4 text-gray-400" />
                更新时间
              </span>
            }
          >
            {user.updatedAt ? new Date(user.updatedAt).toLocaleString() : '-'}
          </Descriptions.Item>
          <Descriptions.Item 
            label={
              <span className="flex items-center gap-1">
                <Clock className="w-4 h-4 text-gray-400" />
                最后登录
              </span>
            }
          >
            {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : '-'}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      {/* 用户表单模态框 */}
      <UserFormModal
        open={formModalOpen}
        user={user}
        onClose={() => setFormModalOpen(false)}
        onSuccess={handleFormSuccess}
      />

      {/* 重置密码模态框 */}
      <ResetPasswordModal
        open={resetPasswordModalOpen}
        userId={user.id}
        userName={user.nickname || user.username}
        onClose={() => setResetPasswordModalOpen(false)}
      />
    </div>
  )
}

