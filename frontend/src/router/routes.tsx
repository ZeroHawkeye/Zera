import {
  createRootRoute,
  createRoute,
  createLazyRoute,
  Outlet,
  type AnyRoute,
} from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import type { ReactNode } from 'react'

// ============================================
// 根路由
// ============================================
export const rootRoute = createRootRoute({
  component: RootComponent,
})

function RootComponent() {
  return (
    <>
      <Outlet />
      <TanStackRouterDevtools position="bottom-right" />
    </>
  )
}

// ============================================
// 动态路由注册系统
// ============================================

// 存储动态注册的路由
const dynamicRoutes: AnyRoute[] = []

/**
 * 注册动态路由（供插件系统使用）
 * @param path 路由路径
 * @param component 路由组件
 * @param parentRoute 父路由（默认为 rootRoute）
 * @returns 创建的路由实例
 */
export function registerRoute(
  path: string,
  component: () => ReactNode,
  parentRoute: AnyRoute = rootRoute
) {
  const route = createRoute({
    getParentRoute: () => parentRoute,
    path,
    component,
  })

  dynamicRoutes.push(route)
  return route
}

/**
 * 注册懒加载路由（供插件系统使用）
 * @param path 路由路径
 * @param lazyImport 懒加载导入函数
 * @param parentRoute 父路由（默认为 rootRoute）
 * @returns 创建的路由实例
 */
export function registerLazyRoute(
  path: string,
  lazyImport: () => Promise<{ default: () => ReactNode }>,
  parentRoute: AnyRoute = rootRoute
) {
  const route = createRoute({
    getParentRoute: () => parentRoute,
    path,
  }).lazy(async () => {
    const module = await lazyImport()
    return createLazyRoute(path)({
      component: module.default,
    })
  })

  dynamicRoutes.push(route)
  return route
}

/**
 * 获取所有动态注册的路由
 */
export function getDynamicRoutes() {
  return dynamicRoutes
}

// ============================================
// 核心路由定义
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
}).lazy(() => import('@/pages/login').then((m) => m.Route))

// ============================================
// 路由树
// ============================================

// 构建路由树（合并静态路由和动态路由）
export function getRouteTree() {
  return rootRoute.addChildren([
    indexRoute,
    loginRoute,
    ...dynamicRoutes,
  ])
}

// 默认导出路由树
export const routeTree = getRouteTree()
