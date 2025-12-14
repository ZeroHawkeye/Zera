/**
 * 用户表单模态框组件
 * 用于创建和编辑用户
 */

import { useEffect, useMemo } from 'react'
import {
  Modal,
  Form,
  Input,
  Select,
  Spin,
} from 'antd'
import { User, Mail, Lock, Shield } from 'lucide-react'
import { useResponsive, useRoles, UserStatus, useUserActions } from '@/hooks'
import type { UserDetail, CreateUserParams, UpdateUserParams } from '@/api'

export interface UserFormModalProps {
  /** 是否显示模态框 */
  open: boolean
  /** 编辑的用户数据，为 null 时表示创建 */
  user: UserDetail | null
  /** 关闭模态框回调 */
  onClose: () => void
  /** 成功回调 */
  onSuccess: () => void
}

interface UserFormValues {
  username: string
  password?: string
  nickname: string
  email: string
  roles: string[]
  status: UserStatus
}

/**
 * 状态选项
 */
const STATUS_OPTIONS = [
  { value: UserStatus.ACTIVE, label: '活跃', color: 'green' },
  { value: UserStatus.INACTIVE, label: '未激活', color: 'default' },
  { value: UserStatus.BANNED, label: '已禁用', color: 'red' },
]

/**
 * 用户表单模态框
 */
export function UserFormModal({ open, user, onClose, onSuccess }: UserFormModalProps) {
  const { isMobile } = useResponsive()
  const [form] = Form.useForm<UserFormValues>()
  const { createUser, updateUser, loading } = useUserActions()
  const { roles, loading: rolesLoading } = useRoles({ pageSize: 100 })

  const isEdit = !!user

  // 重置表单
  useEffect(() => {
    if (open) {
      if (user) {
        form.setFieldsValue({
          username: user.username,
          nickname: user.nickname || '',
          email: user.email || '',
          roles: user.roles || [],
          status: user.status || UserStatus.ACTIVE,
        })
      } else {
        form.resetFields()
        form.setFieldsValue({
          status: UserStatus.ACTIVE,
          roles: [],
        })
      }
    }
  }, [open, user, form])

  // 角色选项
  const roleOptions = useMemo(() => {
    return roles.map((role) => ({
      label: role.name,
      value: role.code,
    }))
  }, [roles])

  // 提交表单
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      
      if (isEdit && user) {
        // 更新用户
        const params: UpdateUserParams = {
          id: user.id,
          nickname: values.nickname,
          email: values.email,
          roles: values.roles,
          status: values.status,
        }
        await updateUser(params)
      } else {
        // 创建用户
        const params: CreateUserParams = {
          username: values.username,
          password: values.password || '',
          email: values.email,
          nickname: values.nickname,
          roles: values.roles,
          status: values.status,
        }
        await createUser(params)
      }

      onSuccess()
      onClose()
    } catch (error) {
      // 表单验证失败或 API 错误，useUserActions 已处理错误提示
      console.error('Form submit error:', error)
    }
  }

  return (
    <Modal
      title={
        <div className="flex items-center gap-2">
          <User className="w-5 h-5 text-blue-500" />
          <span>{isEdit ? '编辑用户' : '创建用户'}</span>
        </div>
      }
      open={open}
      onCancel={onClose}
      onOk={handleSubmit}
      confirmLoading={loading}
      okText={isEdit ? '保存' : '创建'}
      cancelText="取消"
      width={isMobile ? '100%' : 520}
      destroyOnHidden
      className="user-form-modal"
      styles={{
        body: { paddingTop: 16 },
      }}
    >
      <Spin spinning={rolesLoading}>
        <Form
          form={form}
          layout="vertical"
          autoComplete="off"
          requiredMark="optional"
        >
          {/* 用户名 - 创建时必填，编辑时禁用 */}
          <Form.Item
            name="username"
            label="用户名"
            rules={[
              { required: !isEdit, message: '请输入用户名' },
              { min: 3, max: 50, message: '用户名长度应在 3-50 个字符之间' },
              { pattern: /^[a-zA-Z0-9_]+$/, message: '用户名只能包含字母、数字和下划线' },
            ]}
          >
            <Input
              prefix={<User className="w-4 h-4 text-gray-400" />}
              placeholder="请输入用户名"
              disabled={isEdit}
              className="!rounded-lg"
            />
          </Form.Item>

          {/* 密码 - 仅创建时显示 */}
          {!isEdit && (
            <Form.Item
              name="password"
              label="密码"
              rules={[
                { required: true, message: '请输入密码' },
                { min: 6, max: 128, message: '密码长度应在 6-128 个字符之间' },
              ]}
            >
              <Input.Password
                prefix={<Lock className="w-4 h-4 text-gray-400" />}
                placeholder="请输入密码"
                className="!rounded-lg"
              />
            </Form.Item>
          )}

          {/* 昵称 */}
          <Form.Item
            name="nickname"
            label="昵称"
            rules={[
              { max: 100, message: '昵称长度不能超过 100 个字符' },
            ]}
          >
            <Input
              prefix={<User className="w-4 h-4 text-gray-400" />}
              placeholder="请输入昵称"
              className="!rounded-lg"
            />
          </Form.Item>

          {/* 邮箱 */}
          <Form.Item
            name="email"
            label="邮箱"
            rules={[
              { required: true, message: '请输入邮箱' },
              { type: 'email', message: '请输入有效的邮箱地址' },
            ]}
          >
            <Input
              prefix={<Mail className="w-4 h-4 text-gray-400" />}
              placeholder="请输入邮箱"
              className="!rounded-lg"
            />
          </Form.Item>

          {/* 角色 */}
          <Form.Item
            name="roles"
            label="角色"
          >
            <Select
              mode="multiple"
              placeholder="请选择角色"
              options={roleOptions}
              optionFilterProp="label"
              className="!rounded-lg"
              suffixIcon={<Shield className="w-4 h-4 text-gray-400" />}
            />
          </Form.Item>

          {/* 状态 */}
          <Form.Item
            name="status"
            label="状态"
            rules={[{ required: true, message: '请选择用户状态' }]}
          >
            <Select
              placeholder="请选择用户状态"
              options={STATUS_OPTIONS}
              className="!rounded-lg"
            />
          </Form.Item>
        </Form>
      </Spin>
    </Modal>
  )
}
