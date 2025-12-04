import { Outlet } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import { AdminLayout } from '@/layouts'

/**
 * 根路由组件
 */
export function RootComponent() {
  return (
    <>
      <Outlet />
      <TanStackRouterDevtools position="bottom-right" />
    </>
  )
}

/**
 * 后台管理布局组件
 */
export function AdminRouteComponent() {
  return (
    <AdminLayout>
      <Outlet />
    </AdminLayout>
  )
}

