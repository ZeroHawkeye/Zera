import { Outlet } from '@tanstack/react-router'
import type { ReactNode } from 'react'

interface BlankLayoutProps {
  children?: ReactNode
}

/**
 * 空白布局
 * 用于不需要任何布局元素的页面，如登录页、错误页等
 */
export function BlankLayout({ children }: BlankLayoutProps) {
  return (
    <div className="min-h-screen">
      {children ?? <Outlet />}
    </div>
  )
}
