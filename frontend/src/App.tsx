import { RouterProvider } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { Spin } from 'antd'
import { router } from './router/router'
import { useAuthStore } from './stores'

function App() {
  const [isInitialized, setIsInitialized] = useState(false)
  const initialize = useAuthStore((state) => state.initialize)

  useEffect(() => {
    const init = async () => {
      try {
        await initialize()
      } finally {
        setIsInitialized(true)
      }
    }
    init()
  }, [initialize])

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

  return <RouterProvider router={router} />
}

export default App
