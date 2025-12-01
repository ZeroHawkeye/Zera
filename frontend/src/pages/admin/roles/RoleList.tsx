import { createLazyRoute } from '@tanstack/react-router'
import { useState } from 'react'
import {
  Table,
  Button,
  Space,
  Card,
  Tag,
  Modal,
  Input,
  Empty,
  Skeleton,
  Pagination,
  Tooltip,
  Dropdown,
} from 'antd'
import {
  Plus,
  Edit,
  Trash2,
  Shield,
  Search,
  MoreVertical,
  Users,
  Lock,
  Calendar,
} from 'lucide-react'
import type { ColumnsType } from 'antd/es/table'
import type { MenuProps } from 'antd'
import { useResponsive, useRoles, useRoleActions } from '@/hooks'
import { RoleFormModal } from './RoleFormModal'
import type { RoleInfo } from '@/api'

export const Route = createLazyRoute('/admin/roles/')({
  component: RoleList,
})

/**
 * 移动端角色卡片组件
 */
function RoleCard({
  role,
  onEdit,
  onDelete,
}: {
  role: RoleInfo
  onEdit: (role: RoleInfo) => void
  onDelete: (role: RoleInfo) => void
}) {
  const menuItems: MenuProps['items'] = [
    {
      key: 'edit',
      icon: <Edit className="w-4 h-4" />,
      label: '编辑',
      onClick: () => onEdit(role),
    },
    {
      type: 'divider',
    },
    {
      key: 'delete',
      icon: <Trash2 className="w-4 h-4" />,
      label: '删除',
      danger: true,
      disabled: role.isSystem,
      onClick: () => onDelete(role),
    },
  ]

  return (
    <div className="p-4 rounded-2xl bg-white/70 backdrop-blur-sm border border-white/50 shadow-sm hover:shadow-md transition-all duration-300">
      {/* 头部：角色信息 + 操作 */}
      <div className="flex items-start gap-3">
        {/* 图标 */}
        <div className="relative flex-shrink-0">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Shield className="w-6 h-6 text-white" />
          </div>
          {role.isSystem && (
            <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-orange-500 flex items-center justify-center">
              <Lock className="w-3 h-3 text-white" />
            </div>
          )}
        </div>

        {/* 角色信息 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-900 truncate">{role.name}</span>
            {role.isSystem && (
              <Tag color="orange" className="!mr-0 !text-xs">
                系统
              </Tag>
            )}
          </div>
          <div className="text-sm text-gray-500 truncate mt-0.5">
            {role.description || '暂无描述'}
          </div>
          <div className="flex items-center gap-1.5 mt-1 text-xs text-gray-400">
            <code className="px-1.5 py-0.5 bg-gray-100 rounded">{role.code}</code>
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
          <Users className="w-3.5 h-3.5" />
          <span>{role.userCount} 个用户</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-gray-400">
          <Lock className="w-3.5 h-3.5" />
          <span>{role.isAllPermissions ? '全部权限' : `${role.permissions.length} 个权限`}</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-gray-400 ml-auto">
          <Calendar className="w-3.5 h-3.5" />
          <span>{role.createdAt ? new Date(role.createdAt).toLocaleDateString() : '-'}</span>
        </div>
      </div>
    </div>
  )
}

/**
 * 加载骨架屏组件
 */
function RoleListSkeleton({ isMobile }: { isMobile: boolean }) {
  if (isMobile) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="p-4 rounded-2xl bg-white/70 backdrop-blur-sm border border-white/50">
            <div className="flex items-start gap-3">
              <Skeleton.Avatar active size={48} shape="square" />
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
 * 页面标题组件
 */
function PageHeader({
  onAdd,
  isMobile,
}: {
  onAdd: () => void
  isMobile: boolean
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-xl md:text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
          角色管理
        </h1>
        <p className="mt-1 text-sm text-gray-500">管理系统角色和权限配置</p>
      </div>
      <Button
        type="primary"
        icon={<Plus className="w-4 h-4" />}
        onClick={onAdd}
        className={`${isMobile ? 'w-full' : 'self-start sm:self-auto'}`}
      >
        添加角色
      </Button>
    </div>
  )
}

/**
 * 角色列表页面
 */
function RoleList() {
  const { isMobile } = useResponsive()
  const [searchValue, setSearchValue] = useState('')

  // 模态框状态
  const [formModalOpen, setFormModalOpen] = useState(false)
  const [editingRole, setEditingRole] = useState<RoleInfo | null>(null)

  // 使用 Hooks 获取数据
  const {
    roles,
    total,
    loading,
    pagination,
    updatePagination,
    search,
    error,
    refresh,
  } = useRoles()

  const { deleteRole, loading: actionLoading } = useRoleActions()

  // 桌面端表格列配置
  const columns: ColumnsType<RoleInfo> = [
    {
      title: '角色',
      dataIndex: 'name',
      key: 'name',
      render: (_: string, record: RoleInfo) => (
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-md shadow-blue-500/20">
              <Shield className="w-5 h-5 text-white" />
            </div>
            {record.isSystem && (
              <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-orange-500 flex items-center justify-center">
                <Lock className="w-2.5 h-2.5 text-white" />
              </div>
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-gray-900">{record.name}</span>
              {record.isSystem && (
                <Tag color="orange" className="!text-xs">
                  系统
                </Tag>
              )}
            </div>
            <div className="text-xs text-gray-400">
              <code>{record.code}</code>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      width: 200,
      ellipsis: true,
      render: (description: string) => (
        <span className="text-gray-500">{description || '-'}</span>
      ),
    },
    {
      title: '权限',
      key: 'permissions',
      width: 100,
      render: (_: unknown, record: RoleInfo) => (
        record.isAllPermissions 
          ? <Tag color="gold">全部权限</Tag>
          : <Tag color="blue">{record.permissions?.length || 0} 个权限</Tag>
      ),
    },
    {
      title: '用户数',
      dataIndex: 'userCount',
      key: 'userCount',
      width: 100,
      render: (count: number) => (
        <div className="flex items-center gap-1.5 text-gray-600">
          <Users className="w-4 h-4" />
          <span>{count || 0}</span>
        </div>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 120,
      render: (createdAt: string) =>
        createdAt ? new Date(createdAt).toLocaleDateString() : '-',
    },
    {
      title: '操作',
      key: 'actions',
      width: 120,
      fixed: 'right',
      render: (_: unknown, record: RoleInfo) => {
        const menuItems: MenuProps['items'] = [
          {
            key: 'delete',
            icon: <Trash2 className="w-4 h-4" />,
            label: '删除',
            danger: true,
            disabled: record.isSystem,
            onClick: () => handleDelete(record),
          },
        ]

        return (
          <Space size="small">
            <Tooltip title="编辑">
              <Button
                type="text"
                size="small"
                icon={<Edit className="w-4 h-4" />}
                onClick={() => handleEdit(record)}
                className="!text-gray-500 hover:!text-indigo-600 hover:!bg-indigo-50"
              />
            </Tooltip>
            <Dropdown menu={{ items: menuItems }} trigger={['click']} placement="bottomRight">
              <Button
                type="text"
                size="small"
                icon={<MoreVertical className="w-4 h-4" />}
                className="!text-gray-400 hover:!text-gray-600"
              />
            </Dropdown>
          </Space>
        )
      },
    },
  ]

  // 编辑角色
  const handleEdit = (role: RoleInfo) => {
    setEditingRole(role)
    setFormModalOpen(true)
  }

  // 删除角色
  const handleDelete = (role: RoleInfo) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除角色「${role.name}」吗？此操作不可恢复。`,
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      okButtonProps: { loading: actionLoading },
      onOk: async () => {
        try {
          await deleteRole(role.id)
          refresh()
        } catch {
          // 错误已在 hook 中处理
        }
      },
    })
  }

  // 添加角色
  const handleAddRole = () => {
    setEditingRole(null)
    setFormModalOpen(true)
  }

  // 表单提交成功
  const handleFormSuccess = () => {
    refresh()
  }

  // 关闭表单模态框
  const handleFormClose = () => {
    setFormModalOpen(false)
    setEditingRole(null)
  }

  // 加载或错误状态
  if (loading) {
    return (
      <div className="space-y-4 md:space-y-6">
        <PageHeader onAdd={handleAddRole} isMobile={isMobile} />
        <RoleListSkeleton isMobile={isMobile} />
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-4 md:space-y-6">
        <PageHeader onAdd={handleAddRole} isMobile={isMobile} />
        <Card className="p-8 text-center text-red-500 bg-white/80">{error}</Card>
      </div>
    )
  }

  return (
    <div className="space-y-4 md:space-y-6">
      {/* 页面标题 */}
      <PageHeader onAdd={handleAddRole} isMobile={isMobile} />

      {/* 搜索 */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input
          placeholder="搜索角色名称/代码..."
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
      </div>

      {/* 角色列表 */}
      {roles.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={searchValue ? '没有找到匹配的角色' : '暂无角色数据'}
          className="!my-16"
        >
          <Button type="primary" onClick={handleAddRole}>
            创建第一个角色
          </Button>
        </Empty>
      ) : isMobile ? (
        /* 移动端：卡片列表 */
        <div className="space-y-3">
          {roles.map((role) => (
            <RoleCard key={role.id} role={role} onEdit={handleEdit} onDelete={handleDelete} />
          ))}
          {/* 移动端分页 */}
          <div className="flex justify-center pt-4">
            <Pagination
              current={pagination.page}
              total={Number(total)}
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
            dataSource={roles}
            rowKey="id"
            scroll={{ x: 800 }}
            pagination={{
              current: pagination.page,
              total: Number(total),
              pageSize: pagination.pageSize,
              onChange: updatePagination,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total) => `共 ${total} 条`,
            }}
          />
        </Card>
      )}

      {/* 角色表单模态框 */}
      <RoleFormModal
        open={formModalOpen}
        role={editingRole}
        onClose={handleFormClose}
        onSuccess={handleFormSuccess}
      />
    </div>
  )
}
