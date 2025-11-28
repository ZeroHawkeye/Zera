import { createLazyRoute, useNavigate, useSearch } from '@tanstack/react-router'
import { useState } from 'react'
import { Card, Form, Input, Button, Checkbox, message } from 'antd'
import { Mail, Lock, Sparkles } from 'lucide-react'
import { useAuthStore } from '@/stores'

export const Route = createLazyRoute('/login')({
  component: LoginPage,
})

/**
 * 登录页面
 * 现代 AI 产品风格
 */
function LoginPage() {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const search = useSearch({ from: '/login' })
  const login = useAuthStore((state) => state.login)

  const handleLogin = async (values: { username: string; password: string; rememberMe?: boolean }) => {
    setLoading(true)
    try {
      await login(values.username, values.password, values.rememberMe)
      message.success('登录成功')
      
      // 重定向到目标页面或首页
      const redirect = (search as { redirect?: string }).redirect || '/admin'
      navigate({ to: redirect })
    } catch (err) {
      // 错误已在 store 中处理
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-indigo-50/30 to-purple-50/30 p-4">
      {/* 背景装饰 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-indigo-400/20 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-purple-400/20 rounded-full blur-3xl" />
      </div>

      {/* 登录卡片 */}
      <Card className="w-full max-w-md relative z-10 !rounded-3xl !border-white/50 !bg-white/70 backdrop-blur-xl shadow-2xl shadow-indigo-500/10">
        {/* Logo 和标题 */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl shadow-lg shadow-indigo-500/30 mb-4">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
            欢迎回来
          </h1>
          <p className="mt-2 text-gray-500">登录到 Zera 管理系统</p>
        </div>

        {/* 登录表单 */}
        <Form
          form={form}
          layout="vertical"
          onFinish={handleLogin}
          initialValues={{
            username: '',
            password: '',
            rememberMe: true,
          }}
          requiredMark={false}
        >
          <Form.Item
            name="username"
            label="用户名"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input
              prefix={<Mail className="w-4 h-4 text-gray-400" />}
              placeholder="请输入用户名"
              size="large"
              className="!rounded-xl"
            />
          </Form.Item>

          <Form.Item
            name="password"
            label="密码"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password
              prefix={<Lock className="w-4 h-4 text-gray-400" />}
              placeholder="请输入密码"
              size="large"
              className="!rounded-xl"
            />
          </Form.Item>

          <Form.Item name="rememberMe" valuePropName="checked">
            <div className="flex items-center justify-between">
              <Checkbox>记住我</Checkbox>
              <a className="text-sm text-indigo-600 hover:text-indigo-700">
                忘记密码？
              </a>
            </div>
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              size="large"
              loading={loading}
              block
              className="!h-12 !rounded-xl !font-medium !bg-gradient-to-r !from-indigo-500 !to-purple-600 hover:!from-indigo-600 hover:!to-purple-700 !border-0 !shadow-lg !shadow-indigo-500/30"
            >
              登录
            </Button>
          </Form.Item>
        </Form>

        {/* 提示信息 */}
        <div className="mt-6 p-4 bg-indigo-50/50 rounded-xl border border-indigo-100">
          <p className="text-xs text-gray-600 text-center">
            <strong>默认账号：</strong> admin / admin123
          </p>
        </div>
      </Card>
    </div>
  )
}
