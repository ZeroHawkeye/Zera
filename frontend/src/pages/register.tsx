import { createLazyRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { User, Lock, Mail, ArrowRight, AlertCircle, CheckCircle2 } from 'lucide-react'
import { ConnectError } from '@connectrpc/connect'
import { authApi } from '@/api/auth'
import { useSiteStore } from '@/stores'

export const Route = createLazyRoute('/register')({
  component: RegisterPage,
})

function RegisterPage() {
  const navigate = useNavigate()
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    nickname: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  // 从全局 store 获取站点名称
  const siteName = useSiteStore((state) => state.siteName)

  const passwordPolicy = {
    minLength: 8,
    requireUppercase: true,
    requireNumber: true,
    requireSpecial: false,
  }

  const validatePassword = (password: string): string[] => {
    const errors: string[] = []
    
    if (password.length < passwordPolicy.minLength) {
      errors.push(`密码长度至少为 ${passwordPolicy.minLength} 位`)
    }
    
    if (passwordPolicy.requireUppercase && !/[A-Z]/.test(password)) {
      errors.push('密码必须包含至少一个大写字母')
    }
    
    if (passwordPolicy.requireNumber && !/\d/.test(password)) {
      errors.push('密码必须包含至少一个数字')
    }
    
    if (passwordPolicy.requireSpecial && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      errors.push('密码必须包含至少一个特殊字符')
    }
    
    return errors
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess(false)

    // 基本验证
    if (!formData.username.trim() || !formData.email.trim() || !formData.password || !formData.confirmPassword) {
      setError('请填写所有必填项')
      return
    }

    // 用户名格式验证
    if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(formData.username)) {
      setError('用户名必须以字母开头，只能包含字母、数字和下划线')
      return
    }

    if (formData.username.length < 3 || formData.username.length > 50) {
      setError('用户名长度必须在 3-50 个字符之间')
      return
    }

    // 邮箱格式验证
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      setError('请输入有效的邮箱地址')
      return
    }

    // 密码验证
    const passwordErrors = validatePassword(formData.password)
    if (passwordErrors.length > 0) {
      setError(passwordErrors[0])
      return
    }

    // 密码确认
    if (formData.password !== formData.confirmPassword) {
      setError('两次输入的密码不一致')
      return
    }

    setLoading(true)
    try {
      const response = await authApi.register({
        username: formData.username.trim(),
        email: formData.email.trim(),
        password: formData.password,
        confirmPassword: formData.confirmPassword,
        nickname: formData.nickname.trim() || formData.username.trim(),
      })

      if (response.success) {
        setSuccess(true)
        // 2秒后跳转到登录页
        setTimeout(() => {
          navigate({ to: '/login' })
        }, 2000)
      }
    } catch (err) {
      const connectErr = ConnectError.from(err)
      setError(connectErr.message || '注册失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (field: keyof typeof formData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    setError('')
  }

  return (
    <div className="min-h-screen flex">
      {/* 左侧背景图片区域 */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <img
          src="/login-bg.jpg"
          alt="Background"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-black/10" />
        <div className="relative z-10 flex flex-col justify-between p-12">
          <div>
            <h1 className="text-3xl font-bold text-white drop-shadow-lg">{siteName}</h1>
          </div>
          <div className="max-w-md">
            <blockquote className="text-white/90 text-lg leading-relaxed drop-shadow-md">
              "开始是成功的一半"
              <footer className="mt-2 text-white/70 text-sm">— 亚里士多德</footer>
            </blockquote>
          </div>
        </div>
      </div>

      {/* 右侧注册表单区域 */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 bg-gray-50 lg:px-8">
        <div className="w-full max-w-sm">
          {/* 移动端Logo */}
          <div className="lg:hidden mb-8 text-center">
            <h1 className="text-2xl font-bold text-gray-900">{siteName}</h1>
          </div>

          {/* 标题 */}
          <div className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900">创建账号</h2>
            <p className="mt-2 text-sm text-gray-600">填写以下信息完成注册</p>
          </div>

          {/* 成功提示 */}
          {success && (
            <div className="mb-6 flex items-center gap-2 p-3 rounded-lg bg-green-50 border border-green-200">
              <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
              <span className="text-sm text-green-600">注册成功！即将跳转到登录页...</span>
            </div>
          )}

          {/* 错误提示 */}
          {error && !success && (
            <div className="mb-6 flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200">
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
              <span className="text-sm text-red-600">{error}</span>
            </div>
          )}

          {/* 注册表单 */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* 用户名 */}
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1.5">
                用户名 <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <User className="h-4 w-4 text-gray-400" />
                </div>
                <input
                  id="username"
                  type="text"
                  value={formData.username}
                  onChange={(e) => handleInputChange('username', e.target.value)}
                  className="block w-full pl-10 pr-4 py-2.5 text-sm text-gray-900 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors placeholder:text-gray-400"
                  placeholder="请输入用户名（字母开头，3-50位）"
                  autoComplete="username"
                  disabled={loading || success}
                />
              </div>
            </div>

            {/* 邮箱 */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
                邮箱 <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Mail className="h-4 w-4 text-gray-400" />
                </div>
                <input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  className="block w-full pl-10 pr-4 py-2.5 text-sm text-gray-900 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors placeholder:text-gray-400"
                  placeholder="请输入邮箱地址"
                  autoComplete="email"
                  disabled={loading || success}
                />
              </div>
            </div>

            {/* 昵称（可选） */}
            <div>
              <label htmlFor="nickname" className="block text-sm font-medium text-gray-700 mb-1.5">
                昵称
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <User className="h-4 w-4 text-gray-400" />
                </div>
                <input
                  id="nickname"
                  type="text"
                  value={formData.nickname}
                  onChange={(e) => handleInputChange('nickname', e.target.value)}
                  className="block w-full pl-10 pr-4 py-2.5 text-sm text-gray-900 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors placeholder:text-gray-400"
                  placeholder="不填写则默认为用户名"
                  autoComplete="nickname"
                  disabled={loading || success}
                />
              </div>
            </div>

            {/* 密码 */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">
                密码 <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Lock className="h-4 w-4 text-gray-400" />
                </div>
                <input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => handleInputChange('password', e.target.value)}
                  className="block w-full pl-10 pr-4 py-2.5 text-sm text-gray-900 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors placeholder:text-gray-400"
                  placeholder="请输入密码"
                  autoComplete="new-password"
                  disabled={loading || success}
                />
              </div>
              <p className="mt-1 text-xs text-gray-500">
                至少{passwordPolicy.minLength}位
                {passwordPolicy.requireUppercase && '，包含大写字母'}
                {passwordPolicy.requireNumber && '，包含数字'}
                {passwordPolicy.requireSpecial && '，包含特殊字符'}
              </p>
            </div>

            {/* 确认密码 */}
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1.5">
                确认密码 <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Lock className="h-4 w-4 text-gray-400" />
                </div>
                <input
                  id="confirmPassword"
                  type="password"
                  value={formData.confirmPassword}
                  onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                  className="block w-full pl-10 pr-4 py-2.5 text-sm text-gray-900 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors placeholder:text-gray-400"
                  placeholder="请再次输入密码"
                  autoComplete="new-password"
                  disabled={loading || success}
                />
              </div>
            </div>

            {/* 注册按钮 */}
            <button
              type="submit"
              disabled={loading || success}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors mt-6"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  注册中...
                </span>
              ) : success ? (
                '注册成功'
              ) : (
                <>
                  注册
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* 分割线 */}
          <div className="my-6 flex items-center gap-4">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs text-gray-400">或</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          {/* 登录链接 */}
          <p className="text-center text-sm text-gray-600">
            已有账号?{' '}
            <a href="/login" className="text-blue-600 hover:text-blue-700 font-medium transition-colors">
              立即登录
            </a>
          </p>

          {/* 页脚 */}
          <div className="mt-12 text-center">
            <p className="text-xs text-gray-400">© {new Date().getFullYear()} {siteName}. All rights reserved.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
