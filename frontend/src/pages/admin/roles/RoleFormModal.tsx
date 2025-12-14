/**
 * 角色表单模态框组件
 * 用于创建和编辑角色
 */

import { useEffect } from 'react'
import {
  Modal,
  Form,
  Input,
  InputNumber,
  Collapse,
  Checkbox,
  Spin,
  Empty,
} from 'antd'
import { Shield, Code, SortAsc } from 'lucide-react'
import { useResponsive, usePermissions, useRoleActions, useRolePermissions } from '@/hooks'
import type { RoleInfo, PermissionGroup } from '@/api'

export interface RoleFormModalProps {
  /** 是否显示模态框 */
  open: boolean
  /** 编辑的角色数据，为 null 时表示创建 */
  role: RoleInfo | null
  /** 关闭模态框回调 */
  onClose: () => void
  /** 成功回调 */
  onSuccess: () => void
}

interface RoleFormValues {
  code: string
  name: string
  description: string
  sortOrder: number
  permissions: string[]
}

/**
 * 权限分组选择器组件
 */
function PermissionGroupSelector({
  groups,
  selectedPermissions,
  onChange,
}: {
  groups: PermissionGroup[]
  selectedPermissions: string[]
  onChange: (permissions: string[]) => void
}) {
  // 处理单个权限变化
  const handlePermissionChange = (code: string, checked: boolean) => {
    if (checked) {
      onChange([...selectedPermissions, code])
    } else {
      onChange(selectedPermissions.filter((p) => p !== code))
    }
  }

  // 处理分组全选
  const handleGroupSelectAll = (group: PermissionGroup, checked: boolean) => {
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
      </div>
    ),
    children: (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-6">
        {group.permissions.map((permission) => (
          <Checkbox
            key={permission.code}
            checked={selectedPermissions.includes(permission.code)}
            onChange={(e) => handlePermissionChange(permission.code, e.target.checked)}
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
 * 角色表单模态框
 */
export function RoleFormModal({ open, role, onClose, onSuccess }: RoleFormModalProps) {
  const { isMobile } = useResponsive()
  const [form] = Form.useForm<RoleFormValues>()
  const { createRole, updateRole, loading } = useRoleActions()
  const { groups, loading: permissionsLoading } = usePermissions()
  
  // 编辑模式时获取角色权限
  const { permissions: rolePermissions, loading: rolePermissionsLoading } = useRolePermissions(
    role?.id
  )

  const isEdit = !!role

  // 重置表单
  useEffect(() => {
    if (open) {
      if (role) {
        form.setFieldsValue({
          code: role.code,
          name: role.name,
          description: role.description || '',
          sortOrder: role.sortOrder || 0,
          permissions: rolePermissions,
        })
      } else {
        form.resetFields()
        form.setFieldsValue({
          sortOrder: 0,
          permissions: [],
        })
      }
    }
  }, [open, role, rolePermissions, form])

  // 当角色权限加载完成时更新表单
  useEffect(() => {
    if (open && role && rolePermissions.length > 0) {
      form.setFieldValue('permissions', rolePermissions)
    }
  }, [open, role, rolePermissions, form])

  // 提交表单
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()

      if (isEdit && role) {
        // 更新角色
        await updateRole({
          id: role.id,
          name: values.name,
          description: values.description,
          sortOrder: values.sortOrder,
          permissions: values.permissions,
        })
      } else {
        // 创建角色
        await createRole({
          code: values.code,
          name: values.name,
          description: values.description,
          sortOrder: values.sortOrder,
          permissions: values.permissions,
        })
      }

      onSuccess()
      onClose()
    } catch (error) {
      // 表单验证失败或 API 错误，useRoleActions 已处理错误提示
      console.error('Form submit error:', error)
    }
  }

  const isLoading = permissionsLoading || rolePermissionsLoading

  return (
    <Modal
      title={
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-blue-500" />
          <span>{isEdit ? '编辑角色' : '创建角色'}</span>
        </div>
      }
      open={open}
      onCancel={onClose}
      onOk={handleSubmit}
      confirmLoading={loading}
      okText={isEdit ? '保存' : '创建'}
      cancelText="取消"
      width={isMobile ? '100%' : 680}
      destroyOnHidden
      className="role-form-modal"
      styles={{
        body: { paddingTop: 16, maxHeight: '70vh', overflowY: 'auto' },
      }}
    >
      <Spin spinning={isLoading}>
        <Form
          form={form}
          layout="vertical"
          autoComplete="off"
          requiredMark="optional"
        >
          {/* 角色代码 - 创建时必填，编辑时禁用 */}
          <Form.Item
            name="code"
            label="角色代码"
            rules={[
              { required: !isEdit, message: '请输入角色代码' },
              { min: 1, max: 50, message: '角色代码长度应在 1-50 个字符之间' },
              { pattern: /^[a-zA-Z][a-zA-Z0-9_]*$/, message: '角色代码必须以字母开头，只能包含字母、数字和下划线' },
            ]}
            tooltip="唯一标识符，用于系统内部识别，创建后不可修改"
          >
            <Input
              prefix={<Code className="w-4 h-4 text-gray-400" />}
              placeholder="请输入角色代码，如: admin、editor"
              disabled={isEdit}
              className="!rounded-lg"
            />
          </Form.Item>

          {/* 角色名称 */}
          <Form.Item
            name="name"
            label="角色名称"
            rules={[
              { required: true, message: '请输入角色名称' },
              { min: 1, max: 100, message: '角色名称长度应在 1-100 个字符之间' },
            ]}
          >
            <Input
              prefix={<Shield className="w-4 h-4 text-gray-400" />}
              placeholder="请输入角色名称，如: 管理员、编辑者"
              className="!rounded-lg"
            />
          </Form.Item>

          {/* 角色描述 */}
          <Form.Item
            name="description"
            label="描述"
            rules={[
              { max: 500, message: '描述长度不能超过 500 个字符' },
            ]}
          >
            <Input.TextArea
              placeholder="请输入角色描述"
              rows={3}
              showCount
              maxLength={500}
              className="!rounded-lg"
            />
          </Form.Item>

          {/* 排序顺序 */}
          <Form.Item
            name="sortOrder"
            label="排序顺序"
            tooltip="数值越小排序越靠前"
          >
            <InputNumber
              prefix={<SortAsc className="w-4 h-4 text-gray-400" />}
              placeholder="排序顺序"
              min={0}
              max={9999}
              className="!w-full !rounded-lg"
            />
          </Form.Item>

          {/* 权限配置 */}
          <Form.Item
            name="permissions"
            label={
              <div className="flex items-center gap-2">
                <span>权限配置</span>
                <Form.Item noStyle shouldUpdate>
                  {({ getFieldValue }) => {
                    const permissions = getFieldValue('permissions') || []
                    return (
                      <span className="text-xs text-gray-400">
                        (已选择 {permissions.length} 个权限)
                      </span>
                    )
                  }}
                </Form.Item>
              </div>
            }
          >
            <Form.Item noStyle shouldUpdate>
              {({ getFieldValue, setFieldValue }) => (
                <PermissionGroupSelector
                  groups={groups}
                  selectedPermissions={getFieldValue('permissions') || []}
                  onChange={(permissions) => setFieldValue('permissions', permissions)}
                />
              )}
            </Form.Item>
          </Form.Item>
        </Form>
      </Spin>
    </Modal>
  )
}
