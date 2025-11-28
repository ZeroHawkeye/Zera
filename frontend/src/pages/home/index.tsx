import { createLazyRoute, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'
import { useAuthStore } from '@/stores'

export const Route = createLazyRoute('/')({
  component: HomePage,
})

/**
 * 首页 - 重定向逻辑
 */
function HomePage() {
  const navigate = useNavigate()
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)

  useEffect(() => {
    // 根据认证状态重定向
    if (isAuthenticated()) {
      navigate({ to: '/admin', replace: true })
    } else {
      navigate({ to: '/login', replace: true })
    }
  }, [navigate, isAuthenticated])

  return null
}
