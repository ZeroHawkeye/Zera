/**
 * 路由模块统一导出
 */

// 类型导出
export type {
  RouteMeta,
  RouteModuleConfig,
  RouteDefinition,
  RouteGuardContext,
  RouteModule,
  LayoutType,
  LayoutConfig,
  ExtendedRouteOptions,
  RouteTree,
} from './types'

// 注册中心导出
export { routeRegistry, defineRouteModule } from './registry'

// 路由器导出
export { router } from './router'

// 路由相关工具
export { routeTree, rootRoute } from './routes'

// 路由守卫
export {
  isAuthenticated,
  getCurrentUser,
  hasPermission,
  hasRole,
  hasAnyPermission,
  hasAllPermissions,
  authGuard,
  permissionGuard,
  roleGuard,
  guestGuard,
} from './guards'

// 路由工具函数
export {
  flattenRoutes,
  getRouteByPath,
  generateMenuFromRoutes,
  generateBreadcrumbs,
  isRouteActive,
  parseRouteParams,
  type MenuItem,
  type BreadcrumbItem,
} from './utils'
