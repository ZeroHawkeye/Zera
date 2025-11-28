import { createLazyRoute } from '@tanstack/react-router'
import { Card, Form, InputNumber, Button, Switch, Select, message, Alert } from 'antd'
import { Save, Shield } from 'lucide-react'

export const Route = createLazyRoute('/admin/settings/security')({  
  component: SecuritySettings,
})

/**
 * 安全设置页面
 */
function SecuritySettings() {
  const [form] = Form.useForm()

  const handleSave = async (values: Record<string, unknown>) => {
    // TODO: 调用 API 保存设置
    console.log('Save security settings:', values)
    message.success('安全设置已保存')
  }

  return (
    <div className="space-y-4 md:space-y-6 min-w-0">
      <Alert
        message="安全提示"
        description="修改安全设置可能会影响系统的安全性，请谨慎操作。"
        type="warning"
        showIcon
        icon={<Shield className="w-4 h-4" />}
      />

      <Card title="登录安全" className="overflow-hidden">
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            maxLoginAttempts: 5,
            lockoutDuration: 30,
            sessionTimeout: 60,
            passwordMinLength: 8,
          }}
          onFinish={handleSave}
        >
          <Form.Item
            name="maxLoginAttempts"
            label="最大登录尝试次数"
            tooltip="超过此次数后账号将被临时锁定"
          >
            <InputNumber min={1} max={10} className="w-full" />
          </Form.Item>

          <Form.Item
            name="lockoutDuration"
            label="账号锁定时长（分钟）"
          >
            <InputNumber min={5} max={1440} className="w-full" />
          </Form.Item>

          <Form.Item
            name="sessionTimeout"
            label="会话超时时间（分钟）"
          >
            <InputNumber min={5} max={1440} className="w-full" />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" icon={<Save className="w-4 h-4" />}>
              保存设置
            </Button>
          </Form.Item>
        </Form>
      </Card>

      <Card title="密码策略" className="overflow-hidden">
        <Form layout="vertical">
          <Form.Item
            name="passwordMinLength"
            label="密码最小长度"
          >
            <InputNumber min={6} max={32} defaultValue={8} className="w-full" />
          </Form.Item>

          <div className="space-y-4">
            <div className="flex items-start sm:items-center justify-between gap-4 flex-col sm:flex-row">
              <div className="min-w-0">
                <div className="font-medium text-gray-900">要求包含大写字母</div>
                <div className="text-sm text-gray-500">密码必须包含至少一个大写字母</div>
              </div>
              <Switch defaultChecked className="flex-shrink-0" />
            </div>
            <div className="flex items-start sm:items-center justify-between gap-4 flex-col sm:flex-row">
              <div className="min-w-0">
                <div className="font-medium text-gray-900">要求包含数字</div>
                <div className="text-sm text-gray-500">密码必须包含至少一个数字</div>
              </div>
              <Switch defaultChecked className="flex-shrink-0" />
            </div>
            <div className="flex items-start sm:items-center justify-between gap-4 flex-col sm:flex-row">
              <div className="min-w-0">
                <div className="font-medium text-gray-900">要求包含特殊字符</div>
                <div className="text-sm text-gray-500">密码必须包含至少一个特殊字符</div>
              </div>
              <Switch className="flex-shrink-0" />
            </div>
          </div>
        </Form>
      </Card>

      <Card title="双因素认证" className="overflow-hidden">
        <div className="space-y-4">
          <div className="flex items-start sm:items-center justify-between gap-4 flex-col sm:flex-row">
            <div className="min-w-0">
              <div className="font-medium text-gray-900">启用双因素认证</div>
              <div className="text-sm text-gray-500">要求用户使用双因素认证登录</div>
            </div>
            <Switch className="flex-shrink-0" />
          </div>
          <Form.Item label="认证方式">
            <Select
              mode="multiple"
              placeholder="选择支持的认证方式"
              options={[
                { value: 'totp', label: 'TOTP (时间验证码)' },
                { value: 'sms', label: '短信验证码' },
                { value: 'email', label: '邮箱验证码' },
              ]}
            />
          </Form.Item>
        </div>
      </Card>
    </div>
  )
}
