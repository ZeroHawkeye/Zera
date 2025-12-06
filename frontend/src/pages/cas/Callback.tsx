import { createLazyRoute, useNavigate, useSearch } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { Card, Spin, Result, Button } from 'antd'
import { Sparkles, AlertCircle, CheckCircle2 } from 'lucide-react'
import { casAuthApi } from '@/api/cas_auth'
import { useAuthStore, useSiteStore } from '@/stores'

export const Route = createLazyRoute('/cas/callback')({
  component: CASCallbackPage,
})

type CallbackStatus = 'loading' | 'success' | 'error'

/**
 * CAS 回调页面
 * 处理 CAS 服务器认证后的回调，验证票据并完成登录
 */
function CASCallbackPage() {
  const navigate = useNavigate()
  const search = useSearch({ from: '/cas/callback' }) as { ticket?: string; redirect?: string }
  const siteName = useSiteStore((state) => state.siteName)
  const setUser = useAuthStore((state) => state.setUser)
  
  const [status, setStatus] = useState<CallbackStatus>('loading')
  const [errorMessage, setErrorMessage] = useState<string>('')
  const [isNewUser, setIsNewUser] = useState(false)

  useEffect(() => {
    const handleCallback = async () => {
      const { ticket, redirect } = search

      if (!ticket) {
        setStatus('error')
        setErrorMessage('缺少 CAS 票据，请重新登录')
        return
      }

      try {
        // 构建当前服务 URL (去除 ticket 参数)
        const currentUrl = new URL(window.location.href)
        currentUrl.searchParams.delete('ticket')
        const serviceUrl = currentUrl.toString()

        // 调用后端验证票据
        const response = await casAuthApi.callback(ticket, serviceUrl)

        // 设置用户信息到 store
        if (response.user) {
          setUser(response.user)
        }

        setIsNewUser(response.isNewUser)
        setStatus('success')

        // 延迟跳转，让用户看到成功提示
        setTimeout(() => {
          const redirectTo = redirect || '/admin'
          navigate({ to: redirectTo })
        }, 1500)
      } catch (error) {
        console.error('CAS callback error:', error)
        setStatus('error')
        
        // 解析错误信息
        if (error instanceof Error) {
          if (error.message.includes('票据验证失败')) {
            setErrorMessage('CAS 票据验证失败，请重新登录')
          } else if (error.message.includes('未启用')) {
            setErrorMessage('CAS 认证未启用，请联系管理员')
          } else if (error.message.includes('创建用户失败')) {
            setErrorMessage('用户创建失败，请联系管理员')
          } else {
            setErrorMessage(error.message || 'CAS 认证失败，请重新尝试')
          }
        } else {
          setErrorMessage('CAS 认证失败，请重新尝试')
        }
      }
    }

    handleCallback()
  }, [search, navigate, setUser])

  const handleRetry = () => {
    navigate({ to: '/login' })
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-indigo-50/30 to-purple-50/30 p-4">
      {/* 背景装饰 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-indigo-400/20 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-purple-400/20 rounded-full blur-3xl" />
      </div>

      {/* 回调处理卡片 */}
      <Card className="w-full max-w-md relative z-10 !rounded-3xl !border-white/50 !bg-white/70 backdrop-blur-xl shadow-2xl shadow-indigo-500/10">
        {/* Logo */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl shadow-lg shadow-indigo-500/30 mb-4">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <p className="text-gray-500">{siteName}</p>
        </div>

        {/* 状态显示 */}
        {status === 'loading' && (
          <div className="text-center py-8">
            <Spin size="large" />
            <p className="mt-4 text-gray-600">正在验证身份...</p>
            <p className="mt-2 text-sm text-gray-400">请稍候，正在与 CAS 服务器通信</p>
          </div>
        )}

        {status === 'success' && (
          <Result
            icon={<CheckCircle2 className="w-16 h-16 text-green-500 mx-auto" />}
            title={isNewUser ? '欢迎加入！' : '登录成功'}
            subTitle={isNewUser ? '您的账号已自动创建，正在跳转...' : '正在跳转到系统...'}
            className="!py-4"
          />
        )}

        {status === 'error' && (
          <Result
            icon={<AlertCircle className="w-16 h-16 text-red-500 mx-auto" />}
            title="认证失败"
            subTitle={errorMessage}
            className="!py-4"
            extra={
              <Button
                type="primary"
                onClick={handleRetry}
                className="!rounded-xl !bg-gradient-to-r !from-indigo-500 !to-purple-600 hover:!from-indigo-600 hover:!to-purple-700 !border-0"
              >
                返回登录
              </Button>
            }
          />
        )}
      </Card>
    </div>
  )
}
