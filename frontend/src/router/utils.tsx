/**
 * 路由工具函数
 * 
 * 提供路由相关的实用工具
 */

import type { RouteDefinition } from './types'

/**
 * 扁平化路由配置
 * 将嵌套的路由定义转换为扁平数组
 */
export function flattenRoutes(
  routes: RouteDefinition[],
  parentPath = ''
): Array<RouteDefinition & { fullPath: string }> {
  const result: Array<RouteDefinition & { fullPath: string }> = []

  for (const route of routes) {
    const fullPath = parentPath + route.path

    result.push({
      ...route,
      fullPath,
    })

    if (route.children && route.children.length > 0) {
      result.push(...flattenRoutes(route.children, fullPath))
    }
  }

  return result
}

/**
 * 根据路径获取路由配置
 */
export function getRouteByPath(
  routes: RouteDefinition[],
  path: string
): RouteDefinition | undefined {
  const flatRoutes = flattenRoutes(routes)
  return flatRoutes.find((route) => route.fullPath === path)
}

/**
 * 生成菜单数据
 * 从路由配置生成侧边栏菜单结构
 */
export interface MenuItem {
  key: string
  label: string
  icon?: React.ReactNode
  children?: MenuItem[]
  order?: number
}

export function generateMenuFromRoutes(
  routes: RouteDefinition[],
  parentPath = ''
): MenuItem[] {
  const menuItems: MenuItem[] = []

  for (const route of routes) {
    // 跳过在菜单中隐藏的路由
    if (route.meta?.hideInMenu) continue

    const fullPath = parentPath + route.path

    const menuItem: MenuItem = {
      key: fullPath,
      label: route.meta?.title || route.path,
      order: route.meta?.order ?? 100,
    }

    // 处理图标
    if (route.meta?.icon) {
      const IconComponent = route.meta.icon
      menuItem.icon = <IconComponent className="w-4 h-4" />
    }

    // 递归处理子路由
    if (route.children && route.children.length > 0) {
      const childMenuItems = generateMenuFromRoutes(route.children, fullPath)
      if (childMenuItems.length > 0) {
        menuItem.children = childMenuItems
      }
    }

    menuItems.push(menuItem)
  }

  // 按 order 排序
  return menuItems.sort((a, b) => (a.order ?? 100) - (b.order ?? 100))
}

/**
 * 生成面包屑数据
 */
export interface BreadcrumbItem {
  title: string
  path?: string
}

export function generateBreadcrumbs(
  routes: RouteDefinition[],
  currentPath: string
): BreadcrumbItem[] {
  const breadcrumbs: BreadcrumbItem[] = []
  const pathSegments = currentPath.split('/').filter(Boolean)

  let accumulatedPath = ''

  for (const segment of pathSegments) {
    accumulatedPath += '/' + segment
    const route = getRouteByPath(routes, accumulatedPath)

    if (route && !route.meta?.hideInBreadcrumb) {
      breadcrumbs.push({
        title: route.meta?.title || segment,
        path: accumulatedPath,
      })
    }
  }

  return breadcrumbs
}

/**
 * 检查路由是否匹配当前路径
 */
export function isRouteActive(routePath: string, currentPath: string): boolean {
  if (routePath === currentPath) return true
  
  // 检查是否是子路由
  if (currentPath.startsWith(routePath + '/')) return true
  
  return false
}

/**
 * 解析动态路由参数
 */
export function parseRouteParams(
  routePath: string,
  actualPath: string
): Record<string, string> {
  const params: Record<string, string> = {}
  const routeSegments = routePath.split('/')
  const actualSegments = actualPath.split('/')

  for (let i = 0; i < routeSegments.length; i++) {
    const segment = routeSegments[i]
    if (segment.startsWith('$')) {
      const paramName = segment.slice(1)
      params[paramName] = actualSegments[i] || ''
    }
  }

  return params
}
