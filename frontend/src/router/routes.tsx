import { createRootRoute, createRoute, redirect } from '@tanstack/react-router'
import { authGuard, guestGuard, waitForAuthInit } from './guards'
import { RootComponent, AdminRouteComponent } from './components'

// ============================================
// 根路由
// ============================================
export const rootRoute = createRootRoute({
  component: RootComponent,
})

// ============================================
// 公共路由
// ============================================

// 首页路由
export const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
}).lazy(() => import('@/pages/home').then((m) => m.Route))

// 登录路由
export const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  beforeLoad: async () => {
    await waitForAuthInit()
    guestGuard()
  },
}).lazy(() => import('@/pages/login').then((m) => m.Route))

// 注册路由
export const registerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/register',
  beforeLoad: async () => {
    await waitForAuthInit()
    guestGuard()
  },
}).lazy(() => import('@/pages/register').then((m) => m.Route))

// ============================================
// 后台管理路由
// ============================================

// 后台管理布局路由
export const adminRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin',
  component: AdminRouteComponent,
  beforeLoad: async () => {
    await waitForAuthInit()
    authGuard()
  },
})

// 后台首页（仪表盘）
export const adminIndexRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: '/',
}).lazy(() => import('@/pages/admin/Dashboard').then((m) => m.Route))

// ============================================
// 用户管理路由
// ============================================

export const usersRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: '/users',
})

export const usersIndexRoute = createRoute({
  getParentRoute: () => usersRoute,
  path: '/',
}).lazy(() => import('@/pages/admin/users/UserList').then((m) => m.Route))

export const userDetailRoute = createRoute({
  getParentRoute: () => usersRoute,
  path: '/$userId',
}).lazy(() => import('@/pages/admin/users/UserDetail').then((m) => m.Route))

// ============================================
// 角色管理路由
// ============================================

export const rolesRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: '/roles',
})

export const rolesIndexRoute = createRoute({
  getParentRoute: () => rolesRoute,
  path: '/',
}).lazy(() => import('@/pages/admin/roles/RoleList').then((m) => m.Route))

export const roleDetailRoute = createRoute({
  getParentRoute: () => rolesRoute,
  path: '/$roleId',
}).lazy(() => import('@/pages/admin/roles/RoleDetail').then((m) => m.Route))

// ============================================
// 审计日志路由
// ============================================

export const logsRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: '/logs',
})

export const logsIndexRoute = createRoute({
  getParentRoute: () => logsRoute,
  path: '/',
}).lazy(() => import('@/pages/admin/logs/AuditLogList').then((m) => m.Route))

// ============================================
// 系统设置路由
// ============================================

export const settingsRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: '/settings',
}).lazy(() => import('@/pages/admin/settings/SettingsLayout').then((m) => m.Route))

export const generalSettingsRoute = createRoute({
  getParentRoute: () => settingsRoute,
  path: '/general',
}).lazy(() => import('@/pages/admin/settings/GeneralSettings').then((m) => m.Route))

export const securitySettingsRoute = createRoute({
  getParentRoute: () => settingsRoute,
  path: '/security',
}).lazy(() => import('@/pages/admin/settings/SecuritySettings').then((m) => m.Route))

// 设置首页重定向到基础设置
export const settingsIndexRoute = createRoute({
  getParentRoute: () => settingsRoute,
  path: '/',
  beforeLoad: () => {
    throw redirect({ to: '/admin/settings/general' })
  },
})

// ============================================
// 路由树
// ============================================

// 构建路由树
export const routeTree = rootRoute.addChildren([
  indexRoute,
  loginRoute,
  registerRoute,
  adminRoute.addChildren([
    adminIndexRoute,
    usersRoute.addChildren([
      usersIndexRoute,
      userDetailRoute,
    ]),
    rolesRoute.addChildren([
      rolesIndexRoute,
      roleDetailRoute,
    ]),
    logsRoute.addChildren([
      logsIndexRoute,
    ]),
    settingsRoute.addChildren([
      settingsIndexRoute,
      generalSettingsRoute,
      securitySettingsRoute,
    ]),
  ]),
])
