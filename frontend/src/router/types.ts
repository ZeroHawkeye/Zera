import type { AnyRoute } from '@tanstack/react-router'
import type { ReactNode, ComponentType } from 'react'

/**
 * 路由元信息
 * 用于定义路由的额外属性，如标题、图标、权限等
 */
export interface RouteMeta {
  /** 路由标题，用于菜单显示和页面标题 */
  title?: string
  /** 路由图标，用于菜单显示 */
  icon?: ComponentType<{ className?: string }>
  /** 是否在菜单中隐藏 */
  hideInMenu?: boolean
  /** 是否在面包屑中隐藏 */
  hideInBreadcrumb?: boolean
  /** 所需权限列表 */
  permissions?: string[]
  /** 所需角色列表 */
  roles?: string[]
  /** 排序权重，数值越小越靠前 */
  order?: number
  /** 是否保持页面状态 */
  keepAlive?: boolean
  /** 外链地址 */
  externalLink?: string
  /** 自定义数据 */
  [key: string]: unknown
}

/**
 * 路由模块配置
 * 用于定义一个路由模块的完整配置
 */
export interface RouteModuleConfig {
  /** 模块唯一标识 */
  id: string
  /** 模块名称 */
  name: string
  /** 模块描述 */
  description?: string
  /** 基础路径 */
  basePath: string
  /** 模块优先级，数值越小越先加载 */
  priority?: number
  /** 是否启用 */
  enabled?: boolean
}

/**
 * 路由定义配置
 */
export interface RouteDefinition {
  /** 路由路径 */
  path: string
  /** 路由元信息 */
  meta?: RouteMeta
  /** 路由组件 */
  component?: () => ReactNode
  /** 懒加载组件（支持 default 导出或 Route 导出） */
  lazyComponent?: () => Promise<{ default: ComponentType } | { Route: unknown }>
  /** 子路由 */
  children?: RouteDefinition[]
  /** 重定向路径 */
  redirect?: string
  /** 路由守卫 */
  beforeEnter?: (context: RouteGuardContext) => boolean | Promise<boolean>
}

/**
 * 路由守卫上下文
 */
export interface RouteGuardContext {
  /** 来源路由 */
  from: string
  /** 目标路由 */
  to: string
  /** 路由参数 */
  params: Record<string, string>
  /** 查询参数 */
  search: Record<string, string>
}

/**
 * 路由模块接口
 * 所有路由模块都需要实现此接口
 */
export interface RouteModule {
  /** 模块配置 */
  config: RouteModuleConfig
  /** 获取路由定义 */
  getRoutes: () => RouteDefinition[]
  /** 模块初始化钩子 */
  onInit?: () => void | Promise<void>
  /** 模块销毁钩子 */
  onDestroy?: () => void | Promise<void>
}

/**
 * 布局类型
 */
export type LayoutType = 'admin' | 'auth' | 'blank' | 'custom'

/**
 * 布局配置
 */
export interface LayoutConfig {
  /** 布局类型 */
  type: LayoutType
  /** 是否显示侧边栏 */
  showSidebar?: boolean
  /** 是否显示头部 */
  showHeader?: boolean
  /** 是否显示页脚 */
  showFooter?: boolean
  /** 是否显示面包屑 */
  showBreadcrumb?: boolean
  /** 侧边栏折叠状态 */
  sidebarCollapsed?: boolean
}

/**
 * 扩展路由选项类型
 */
export interface ExtendedRouteOptions {
  meta?: RouteMeta
  layout?: LayoutConfig
}

/**
 * 类型安全的路由表
 */
export type RouteTree = AnyRoute
