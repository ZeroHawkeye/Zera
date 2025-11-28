import { createLazyRoute } from '@tanstack/react-router'
import { Card, Form, Input, Button, Switch, Select, message } from 'antd'
import { Save } from 'lucide-react'

export const Route = createLazyRoute('/admin/settings/general')({  
  component: GeneralSettings,
})

/**
 * 基础设置页面
 */
function GeneralSettings() {
  const [form] = Form.useForm()

  const handleSave = async (values: Record<string, unknown>) => {
    // TODO: 调用 API 保存设置
    console.log('Save settings:', values)
    message.success('设置已保存')
  }

  return (
    <div className="space-y-4 md:space-y-6 min-w-0">
      <Card title="站点信息" className="overflow-hidden">
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            siteName: 'Zera',
            siteDescription: 'Zera 管理系统',
            language: 'zh-CN',
            timezone: 'Asia/Shanghai',
          }}
          onFinish={handleSave}
        >
          <Form.Item
            name="siteName"
            label="站点名称"
            rules={[{ required: true, message: '请输入站点名称' }]}
          >
            <Input placeholder="请输入站点名称" />
          </Form.Item>

          <Form.Item
            name="siteDescription"
            label="站点描述"
          >
            <Input.TextArea rows={3} placeholder="请输入站点描述" />
          </Form.Item>

          <Form.Item
            name="language"
            label="默认语言"
          >
            <Select
              options={[
                { value: 'zh-CN', label: '简体中文' },
                { value: 'en-US', label: 'English' },
                { value: 'ja-JP', label: '日本語' },
              ]}
            />
          </Form.Item>

          <Form.Item
            name="timezone"
            label="时区"
          >
            <Select
              options={[
                { value: 'Asia/Shanghai', label: '中国标准时间 (UTC+8)' },
                { value: 'America/New_York', label: '美国东部时间 (UTC-5)' },
                { value: 'Europe/London', label: '英国时间 (UTC+0)' },
              ]}
            />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" icon={<Save className="w-4 h-4" />}>
              保存设置
            </Button>
          </Form.Item>
        </Form>
      </Card>

      <Card title="功能开关" className="overflow-hidden">
        <div className="space-y-4">
          <div className="flex items-start sm:items-center justify-between gap-4 flex-col sm:flex-row">
            <div className="min-w-0">
              <div className="font-medium text-gray-900">启用注册</div>
              <div className="text-sm text-gray-500">允许新用户自行注册账号</div>
            </div>
            <Switch defaultChecked className="flex-shrink-0" />
          </div>
          <div className="flex items-start sm:items-center justify-between gap-4 flex-col sm:flex-row">
            <div className="min-w-0">
              <div className="font-medium text-gray-900">维护模式</div>
              <div className="text-sm text-gray-500">开启后普通用户将无法访问系统</div>
            </div>
            <Switch className="flex-shrink-0" />
          </div>
          <div className="flex items-start sm:items-center justify-between gap-4 flex-col sm:flex-row">
            <div className="min-w-0">
              <div className="font-medium text-gray-900">开发者模式</div>
              <div className="text-sm text-gray-500">显示调试信息和开发工具</div>
            </div>
            <Switch className="flex-shrink-0" />
          </div>
        </div>
      </Card>
    </div>
  )
}
