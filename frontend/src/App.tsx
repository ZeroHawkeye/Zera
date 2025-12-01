import { RouterProvider } from '@tanstack/react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Spin } from 'antd'
import { router } from './router/router'
import { useAuthStore, useSiteStore } from './stores'
import { useFavicon } from './hooks'

// 创建 QueryClient 实例
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 分钟
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

function App() {
  const [isInitialized, setIsInitialized] = useState(false)
  const initializeAuth = useAuthStore((state) => state.initialize)
  const initializeSite = useSiteStore((state) => state.initialize)

  // 动态更新 favicon
  useFavicon()

  useEffect(() => {
    const init = async () => {
      try {
        // 并行初始化认证和站点设置
        await Promise.all([
          initializeAuth(),
          initializeSite(),
        ])
      } finally {
        setIsInitialized(true)
      }
    }
    init()
  }, [initializeAuth, initializeSite])

  // 初始化加载状态
  if (!isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="text-center">
          <Spin size="large" />
          <p className="mt-4 text-gray-600">加载中...</p>
        </div>
      </div>
    )
  }

  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
}

export default App
