/**
 * 重置密码模态框组件
 */

import { Modal, Form, Input } from 'antd'
import { Lock } from 'lucide-react'
import { useUserActions } from '@/hooks'
import { useResponsive } from '@/hooks'

export interface ResetPasswordModalProps {
  /** 是否显示模态框 */
  open: boolean
  /** 用户 ID */
  userId: string | null
  /** 用户名称（用于显示） */
  userName?: string
  /** 关闭模态框回调 */
  onClose: () => void
  /** 成功回调 */
  onSuccess?: () => void
}

interface ResetPasswordFormValues {
  newPassword: string
  confirmPassword: string
}

/**
 * 重置密码模态框
 */
export function ResetPasswordModal({
  open,
  userId,
  userName,
  onClose,
  onSuccess,
}: ResetPasswordModalProps) {
  const { isMobile } = useResponsive()
  const [form] = Form.useForm<ResetPasswordFormValues>()
  const { resetPassword, loading } = useUserActions()

  // 提交表单
  const handleSubmit = async () => {
    if (!userId) return

    try {
      const values = await form.validateFields()
      await resetPassword(userId, values.newPassword)
      form.resetFields()
      onSuccess?.()
      onClose()
    } catch (error) {
      // 表单验证失败或 API 错误
      console.error('Reset password error:', error)
    }
  }

  // 关闭时重置表单
  const handleClose = () => {
    form.resetFields()
    onClose()
  }

  return (
    <Modal
      title={
        <div className="flex items-center gap-2">
          <Lock className="w-5 h-5 text-orange-500" />
          <span>重置密码</span>
        </div>
      }
      open={open}
      onCancel={handleClose}
      onOk={handleSubmit}
      confirmLoading={loading}
      okText="确认重置"
      cancelText="取消"
      width={isMobile ? '100%' : 420}
      destroyOnHidden
    >
      {userName && (
        <p className="mb-4 text-gray-600">
          正在为用户 <span className="font-semibold text-gray-900">{userName}</span> 重置密码
        </p>
      )}

      <Form
        form={form}
        layout="vertical"
        autoComplete="off"
        requiredMark="optional"
      >
        <Form.Item
          name="newPassword"
          label="新密码"
          rules={[
            { required: true, message: '请输入新密码' },
            { min: 6, max: 128, message: '密码长度应在 6-128 个字符之间' },
          ]}
        >
          <Input.Password
            prefix={<Lock className="w-4 h-4 text-gray-400" />}
            placeholder="请输入新密码"
            className="!rounded-lg"
          />
        </Form.Item>

        <Form.Item
          name="confirmPassword"
          label="确认密码"
          dependencies={['newPassword']}
          rules={[
            { required: true, message: '请确认密码' },
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value || getFieldValue('newPassword') === value) {
                  return Promise.resolve()
                }
                return Promise.reject(new Error('两次输入的密码不一致'))
              },
            }),
          ]}
        >
          <Input.Password
            prefix={<Lock className="w-4 h-4 text-gray-400" />}
            placeholder="请再次输入新密码"
            className="!rounded-lg"
          />
        </Form.Item>
      </Form>
    </Modal>
  )
}
