import { createLazyRoute, useParams, useNavigate } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import {
  Card,
  Descriptions,
  Tag,
  Button,
  Space,
  Collapse,
  Checkbox,
  Spin,
  Empty,
  Skeleton,
} from 'antd'
import { ArrowLeft, Edit, Save, Shield, Lock, Users, Calendar, Clock } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { useRole, useRolePermissions, useRoleActions, useResponsive } from '@/hooks'
import type { PermissionGroup } from '@/api'

export const Route = createLazyRoute('/admin/roles/$roleId')({
  component: RoleDetail,
})

/**
 * 权限分组展示组件
 */
function PermissionGroupDisplay({
  groups,
  selectedPermissions,
  onChange,
  readOnly = false,
}: {
  groups: PermissionGroup[]
  selectedPermissions: string[]
  onChange?: (permissions: string[]) => void
  readOnly?: boolean
}) {
  // 处理单个权限变化
  const handlePermissionChange = (code: string, checked: boolean) => {
    if (readOnly || !onChange) return
    if (checked) {
      onChange([...selectedPermissions, code])
    } else {
      onChange(selectedPermissions.filter((p) => p !== code))
    }
  }

  // 处理分组全选
  const handleGroupSelectAll = (group: PermissionGroup, checked: boolean) => {
    if (readOnly || !onChange) return
    const groupCodes = group.permissions.map((p) => p.code)
    if (checked) {
      const newPermissions = [...new Set([...selectedPermissions, ...groupCodes])]
      onChange(newPermissions)
    } else {
      onChange(selectedPermissions.filter((p) => !groupCodes.includes(p)))
    }
  }

  // 检查分组是否全选
  const isGroupAllSelected = (group: PermissionGroup) => {
    return group.permissions.every((p) => selectedPermissions.includes(p.code))
  }

  // 检查分组是否部分选中
  const isGroupPartialSelected = (group: PermissionGroup) => {
    const selectedCount = group.permissions.filter((p) =>
      selectedPermissions.includes(p.code)
    ).length
    return selectedCount > 0 && selectedCount < group.permissions.length
  }

  if (groups.length === 0) {
    return <Empty description="暂无可用权限" className="!my-8" />
  }

  const collapseItems = groups.map((group) => ({
    key: group.resource,
    label: (
      <div className="flex items-center justify-between w-full pr-2">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-blue-500" />
          <span className="font-medium">{group.resourceName || group.resource}</span>
          <span className="text-xs text-gray-400">
            ({group.permissions.filter((p) => selectedPermissions.includes(p.code)).length}/
            {group.permissions.length})
          </span>
        </div>
        {!readOnly && (
          <Checkbox
            checked={isGroupAllSelected(group)}
            indeterminate={isGroupPartialSelected(group)}
            onChange={(e) => {
              e.stopPropagation()
              handleGroupSelectAll(group, e.target.checked)
            }}
            onClick={(e) => e.stopPropagation()}
          >
            全选
          </Checkbox>
        )}
      </div>
    ),
    children: (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pl-6">
        {group.permissions.map((permission) => (
          <Checkbox
            key={permission.code}
            checked={selectedPermissions.includes(permission.code)}
            onChange={(e) => handlePermissionChange(permission.code, e.target.checked)}
            disabled={readOnly}
            className="!flex items-start"
          >
            <div className="flex flex-col">
              <span className="text-sm">{permission.name}</span>
              <span className="text-xs text-gray-400">{permission.code}</span>
            </div>
          </Checkbox>
        ))}
      </div>
    ),
  }))

  return (
    <Collapse
      defaultActiveKey={groups.map((g) => g.resource)}
      ghost
      items={collapseItems}
      className="permission-collapse !bg-gray-50/50 !rounded-lg"
    />
  )
}

/**
 * 角色详情页面
 */
function RoleDetail() {
  const { roleId } = useParams({ strict: false })
  const navigate = useNavigate()
  const { isMobile } = useResponsive()
  
  // 获取角色详情
  const { role, loading: roleLoading, error: roleError, refresh: refreshRole } = useRole(roleId)
  
  // 获取角色权限
  const {
    permissions: rolePermissions,
    allGroups,
    loading: permissionsLoading,
    refresh: refreshPermissions,
  } = useRolePermissions(roleId)

  // 角色操作
  const { updateRolePermissions, loading: actionLoading } = useRoleActions()

  // 编辑模式状态
  const [isEditing, setIsEditing] = useState(false)
  const [editedPermissions, setEditedPermissions] = useState<string[]>([])

  // 同步权限到编辑状态
  useEffect(() => {
    setEditedPermissions(rolePermissions)
  }, [rolePermissions])

  // 开始编辑
  const handleStartEdit = () => {
    setIsEditing(true)
    setEditedPermissions([...rolePermissions])
  }

  // 取消编辑
  const handleCancelEdit = () => {
    setIsEditing(false)
    setEditedPermissions([...rolePermissions])
  }

  // 保存权限
  const handleSavePermissions = async () => {
    if (!roleId) return

    try {
      await updateRolePermissions(roleId, editedPermissions)
      setIsEditing(false)
      refreshPermissions()
      refreshRole()
    } catch {
      // 错误已在 hook 中处理
    }
  }

  // 加载状态
  const isLoading = roleLoading || permissionsLoading

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link to="/admin/roles">
            <Button type="text" icon={<ArrowLeft className="w-4 h-4" />}>
              返回
            </Button>
          </Link>
          <Skeleton.Input active size="large" className="!w-40" />
        </div>
        <Card className="!rounded-2xl">
          <Skeleton active paragraph={{ rows: 4 }} />
        </Card>
        <Card className="!rounded-2xl">
          <Skeleton active paragraph={{ rows: 6 }} />
        </Card>
      </div>
    )
  }

  if (roleError || !role) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link to="/admin/roles">
            <Button type="text" icon={<ArrowLeft className="w-4 h-4" />}>
              返回
            </Button>
          </Link>
        </div>
        <Empty
          description={roleError || '角色不存在'}
          className="!my-16"
        >
          <Button type="primary" onClick={() => navigate({ to: '/admin/roles' })}>
            返回角色列表
          </Button>
        </Empty>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 返回按钮和标题 */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Link to="/admin/roles">
            <Button type="text" icon={<ArrowLeft className="w-4 h-4" />}>
              返回
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl md:text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
                {role.name}
              </h1>
              {role.isSystem && (
                <Tag color="orange" className="!text-xs">
                  <Lock className="w-3 h-3 inline mr-1" />
                  系统角色
                </Tag>
              )}
            </div>
            <p className="mt-1 text-sm text-gray-500">{role.description || '暂无描述'}</p>
          </div>
        </div>
        <Space className={isMobile ? 'w-full' : ''}>
          {isEditing ? (
            <>
              <Button onClick={handleCancelEdit} className={isMobile ? 'flex-1' : ''}>
                取消
              </Button>
              <Button
                type="primary"
                icon={<Save className="w-4 h-4" />}
                onClick={handleSavePermissions}
                loading={actionLoading}
                className={isMobile ? 'flex-1' : ''}
              >
                保存权限
              </Button>
            </>
          ) : (
            <Button
              type="primary"
              icon={<Edit className="w-4 h-4" />}
              onClick={handleStartEdit}
              className={isMobile ? 'w-full' : ''}
            >
              编辑权限
            </Button>
          )}
        </Space>
      </div>

      {/* 角色基本信息 */}
      <Card
        title={
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-blue-500" />
            <span>基本信息</span>
          </div>
        }
        className="!rounded-2xl !border-white/50 !bg-white/70 backdrop-blur-sm shadow-sm"
      >
        <Descriptions column={isMobile ? 1 : 2} labelStyle={{ color: '#6b7280' }}>
          <Descriptions.Item label="角色ID">
            <code className="px-2 py-0.5 bg-gray-100 rounded text-sm">{role.id}</code>
          </Descriptions.Item>
          <Descriptions.Item label="角色代码">
            <code className="px-2 py-0.5 bg-gray-100 rounded text-sm">{role.code}</code>
          </Descriptions.Item>
          <Descriptions.Item label="角色名称">
            <span className="font-medium">{role.name}</span>
          </Descriptions.Item>
          <Descriptions.Item label="用户数量">
            <div className="flex items-center gap-1.5">
              <Users className="w-4 h-4 text-gray-400" />
              <span>{role.userCount || 0} 个用户</span>
            </div>
          </Descriptions.Item>
          <Descriptions.Item label="描述" span={2}>
            {role.description || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="创建时间">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-gray-400" />
              <span>{role.createdAt ? new Date(role.createdAt).toLocaleString() : '-'}</span>
            </div>
          </Descriptions.Item>
          <Descriptions.Item label="更新时间">
            <div className="flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-gray-400" />
              <span>{role.updatedAt ? new Date(role.updatedAt).toLocaleString() : '-'}</span>
            </div>
          </Descriptions.Item>
        </Descriptions>
      </Card>

      {/* 权限配置 */}
      <Card
        title={
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Lock className="w-5 h-5 text-blue-500" />
              <span>权限配置</span>
            </div>
            <Tag color="blue">
              已选择 {isEditing ? editedPermissions.length : rolePermissions.length} 个权限
            </Tag>
          </div>
        }
        className="!rounded-2xl !border-white/50 !bg-white/70 backdrop-blur-sm shadow-sm"
      >
        <Spin spinning={permissionsLoading}>
          <PermissionGroupDisplay
            groups={allGroups}
            selectedPermissions={isEditing ? editedPermissions : rolePermissions}
            onChange={isEditing ? setEditedPermissions : undefined}
            readOnly={!isEditing}
          />
        </Spin>
      </Card>
    </div>
  )
}
