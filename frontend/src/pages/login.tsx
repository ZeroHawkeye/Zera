import { createLazyRoute, useNavigate, Link, useSearch } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { User, Lock, ArrowRight, AlertCircle, Building2 } from 'lucide-react'
import { ConnectError } from '@connectrpc/connect'
import { authApi } from '@/api/auth'
import { casAuthApi } from '@/api/cas_auth'
import { useSiteStore } from '@/stores'

export const Route = createLazyRoute('/login')({
  component: LoginPage,
})

function LoginPage() {
  const navigate = useNavigate()
  const search = useSearch({ from: '/login' }) as { redirect?: string }
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  
  // CAS 相关状态
  const [casEnabled, setCasEnabled] = useState(false)
  const [casLoading, setCasLoading] = useState(false)

  // 从全局 store 获取站点设置
  const siteName = useSiteStore((state) => state.siteName)
  const registrationEnabled = useSiteStore((state) => state.enableRegistration)

  // 获取 CAS 公开设置
  useEffect(() => {
    const fetchCasSettings = async () => {
      try {
        const response = await casAuthApi.getPublicSettings()
        setCasEnabled(response.casEnabled)
      } catch {
        // 如果获取失败，默认不显示 CAS 登录入口
        setCasEnabled(false)
      }
    }
    fetchCasSettings()
  }, [])

const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!username.trim() || !password.trim()) {
      setError('请输入用户名和密码')
      return
    }

    setLoading(true)
    try {
      await authApi.login({
        username: username.trim(),
        password: password,
        rememberMe,
      })
      // 登录成功后跳转到重定向地址或首页
      const redirectTo = search.redirect || '/'
      navigate({ to: redirectTo })
    } catch (err) {
      const connectErr = ConnectError.from(err)
      setError(connectErr.message || '登录失败，请检查用户名和密码')
    } finally {
      setLoading(false)
    }
  }

  // 处理 CAS 登录
  const handleCasLogin = async () => {
    setCasLoading(true)
    setError('')
    try {
      // 获取 CAS 登录 URL，传递当前页面的重定向参数
      const redirectUrl = search.redirect || '/admin'
      const response = await casAuthApi.getLoginURL(redirectUrl)
      
      if (response.loginUrl) {
        // 跳转到 CAS 登录页面
        window.location.href = response.loginUrl
      } else {
        setError('获取 CAS 登录地址失败')
      }
    } catch (err) {
      const connectErr = ConnectError.from(err)
      setError(connectErr.message || 'CAS 登录失败')
      setCasLoading(false)
    }
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
        {/* 半透明遮罩层 */}
        <div className="absolute inset-0 bg-black/10" />
        {/* 品牌区域 */}
        <div className="relative z-10 flex flex-col justify-between p-12">
          <div>
            <h1 className="text-3xl font-bold text-white drop-shadow-lg">{siteName}</h1>
          </div>
          <div className="max-w-md">
            <blockquote className="text-white/90 text-lg leading-relaxed drop-shadow-md">
              "简洁是复杂的最终形式"
              <footer className="mt-2 text-white/70 text-sm">— Leonardo da Vinci</footer>
            </blockquote>
          </div>
        </div>
      </div>

      {/* 右侧登录表单区域 */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 bg-gray-50 lg:px-8">
        <div className="w-full max-w-sm">
          {/* 移动端Logo */}
          <div className="lg:hidden mb-8 text-center">
            <h1 className="text-2xl font-bold text-gray-900">{siteName}</h1>
          </div>

          {/* 标题 */}
          <div className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900">欢迎回来</h2>
            <p className="mt-2 text-sm text-gray-600">请输入您的账号信息登录系统</p>
          </div>

          {/* 错误提示 */}
          {error && (
            <div className="mb-6 flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200">
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
              <span className="text-sm text-red-600">{error}</span>
            </div>
          )}

          {/* 登录表单 */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* 用户名输入框 */}
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1.5">
                用户名
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <User className="h-4 w-4 text-gray-400" />
                </div>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="block w-full pl-10 pr-4 py-2.5 text-sm text-gray-900 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors placeholder:text-gray-400"
                  placeholder="请输入用户名"
                  autoComplete="username"
                />
              </div>
            </div>

            {/* 密码输入框 */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">
                密码
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Lock className="h-4 w-4 text-gray-400" />
                </div>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-10 pr-4 py-2.5 text-sm text-gray-900 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors placeholder:text-gray-400"
                  placeholder="请输入密码"
                  autoComplete="current-password"
                />
              </div>
            </div>

            {/* 记住我和忘记密码 */}
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500/20 focus:ring-offset-0 transition-colors cursor-pointer"
                />
                <span className="text-sm text-gray-600">记住我</span>
              </label>
              <a href="#" className="text-sm text-blue-600 hover:text-blue-700 transition-colors">
                忘记密码?
              </a>
            </div>

            {/* 登录按钮 */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
                  登录中...
                </span>
              ) : (
                <>
                  登录
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

          {/* CAS 单点登录按钮 */}
          {casEnabled && (
            <button
              type="button"
              onClick={handleCasLogin}
              disabled={casLoading}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors mb-4"
            >
              {casLoading ? (
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
                  正在跳转...
                </span>
              ) : (
                <>
                  <Building2 className="w-4 h-4" />
                  使用企业账号登录
                </>
              )}
            </button>
          )}

          {/* 注册提示 */}
          {registrationEnabled && (
            <p className="text-center text-sm text-gray-600">
              还没有账号?{' '}
              <Link to="/register" className="text-blue-600 hover:text-blue-700 font-medium transition-colors">
                立即注册
              </Link>
            </p>
          )}

          {/* 页脚 */}
          <div className="mt-12 text-center">
            <p className="text-xs text-gray-400">© {new Date().getFullYear()} {siteName}. All rights reserved.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
