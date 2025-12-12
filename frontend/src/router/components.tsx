import { Outlet } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import { AdminLayout, TopNavLayout } from '@/layouts'
import { useLayoutStore } from '@/stores'

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
 * 根据用户设置动态选择布局模式
 */
export function AdminRouteComponent() {
  const { layoutMode } = useLayoutStore()

  // 根据布局模式选择对应的布局组件
  const Layout = layoutMode === 'topnav' ? TopNavLayout : AdminLayout

  return (
    <Layout>
      <Outlet />
    </Layout>
  )
}

