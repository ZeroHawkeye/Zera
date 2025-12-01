/**
 * 菜单系统类型定义
 * 支持最深5层嵌套的动态菜单系统
 */

import type { ComponentType, ReactNode } from 'react'

/**
 * 菜单项唯一标识类型
 */
export type MenuKey = string

/**
 * 菜单类型枚举
 */
export enum MenuType {
  /** 菜单分组（不可点击，仅作为容器） */
  GROUP = 'group',
  /** 菜单项（可点击导航） */
  ITEM = 'item',
  /** 分割线 */
  DIVIDER = 'divider',
}

/**
 * 菜单图标类型
 * 支持 Lucide 图标组件或自定义 ReactNode
 */
export type MenuIcon = ComponentType<{ className?: string }> | ReactNode

/**
 * 菜单项基础配置
 */
export interface MenuItemBase {
  /** 菜单唯一标识 */
  key: MenuKey
  /** 菜单类型 */
  type: MenuType
  /** 菜单标题 */
  label?: string
  /** 菜单图标 */
  icon?: MenuIcon
  /** 排序权重，数值越小越靠前 */
  order?: number
  /** 是否隐藏 */
  hidden?: boolean
  /** 是否禁用 */
  disabled?: boolean
}

/**
 * 菜单权限配置
 */
export interface MenuPermission {
  /** 所需权限列表（满足任意一个即可） */
  permissions?: string[]
  /** 所需角色列表（满足任意一个即可） */
  roles?: string[]
  /** 自定义权限校验函数 */
  check?: (context: MenuPermissionContext) => boolean
}

/**
 * 权限校验上下文
 */
export interface MenuPermissionContext {
  /** 当前用户权限列表 */
  permissions: string[]
  /** 当前用户角色列表 */
  roles: string[]
  /** 当前用户信息 */
  user: Record<string, unknown> | null
}

/**
 * 分组菜单配置
 * 用于组织一组相关的菜单项
 */
export interface MenuGroup extends MenuItemBase {
  type: MenuType.GROUP
  /** 分组标题（必填） */
  label: string
  /** 子菜单项（支持嵌套，最深5层） */
  children: MenuItem[]
  /** 权限配置 */
  permission?: MenuPermission
  /** 是否默认展开 */
  defaultOpen?: boolean
  /** 是否可折叠 */
  collapsible?: boolean
}

/**
 * 导航菜单项配置
 * 可点击跳转的菜单项
 */
export interface MenuNavItem extends MenuItemBase {
  type: MenuType.ITEM
  /** 菜单标题（必填） */
  label: string
  /** 路由路径 */
  path?: string
  /** 外部链接 */
  externalLink?: string
  /** 是否在新窗口打开外链 */
  openInNewTab?: boolean
  /** 子菜单项（支持嵌套，最深5层） */
  children?: MenuItem[]
  /** 权限配置 */
  permission?: MenuPermission
  /** 徽章配置 */
  badge?: MenuBadge
  /** 是否默认展开 */
  defaultOpen?: boolean
}

/**
 * 分割线配置
 */
export interface MenuDivider extends MenuItemBase {
  type: MenuType.DIVIDER
}

/**
 * 菜单徽章配置
 */
export interface MenuBadge {
  /** 徽章数量或文本 */
  count?: number | string
  /** 是否显示小红点 */
  dot?: boolean
  /** 徽章颜色 */
  color?: string
  /** 最大显示数量 */
  overflowCount?: number
}

/**
 * 菜单项联合类型
 */
export type MenuItem = MenuGroup | MenuNavItem | MenuDivider

/**
 * 菜单配置
 */
export interface MenuConfig {
  /** 菜单唯一标识 */
  id: string
  /** 菜单名称 */
  name: string
  /** 菜单描述 */
  description?: string
  /** 菜单项列表 */
  items: MenuItem[]
  /** 是否启用 */
  enabled?: boolean
  /** 优先级（数值越小越先处理） */
  priority?: number
}

/**
 * 菜单模块接口
 * 用于动态注册菜单
 */
export interface MenuModule {
  /** 模块唯一标识 */
  id: string
  /** 模块名称 */
  name: string
  /** 获取菜单配置 */
  getMenuConfig: () => MenuConfig
  /** 模块初始化钩子 */
  onInit?: () => void | Promise<void>
  /** 模块销毁钩子 */
  onDestroy?: () => void | Promise<void>
}

/**
 * 菜单上下文
 */
export interface MenuContext {
  /** 当前激活的菜单项 key */
  activeKey: MenuKey | null
  /** 展开的菜单 key 列表 */
  openKeys: MenuKey[]
  /** 侧边栏是否折叠 */
  collapsed: boolean
  /** 是否为移动端 */
  isMobile: boolean
}

/**
 * 扁平化的菜单项（用于快速查找）
 */
export interface FlatMenuItem {
  /** 菜单项 */
  item: MenuItem
  /** 父级菜单 key 路径 */
  parentKeys: MenuKey[]
  /** 嵌套层级（从 0 开始） */
  level: number
  /** 完整路径（用于匹配路由） */
  fullPath?: string
}

/**
 * 菜单渲染器 Props
 */
export interface MenuRendererProps {
  /** 菜单项列表 */
  items: MenuItem[]
  /** 当前激活的菜单项 key */
  activeKey?: MenuKey | null
  /** 展开的菜单 key 列表 */
  openKeys?: MenuKey[]
  /** 是否折叠 */
  collapsed?: boolean
  /** 当前嵌套层级 */
  level?: number
  /** 菜单项点击事件 */
  onItemClick?: (item: MenuItem, key: MenuKey) => void
  /** 展开/收起事件 */
  onOpenChange?: (keys: MenuKey[]) => void
  /** 权限上下文 */
  permissionContext?: MenuPermissionContext
}

/**
 * 最大嵌套层级
 */
export const MAX_MENU_DEPTH = 5

/**
 * 类型守卫：判断是否为分组菜单
 */
export function isMenuGroup(item: MenuItem): item is MenuGroup {
  return item.type === MenuType.GROUP
}

/**
 * 类型守卫：判断是否为导航菜单项
 */
export function isMenuNavItem(item: MenuItem): item is MenuNavItem {
  return item.type === MenuType.ITEM
}

/**
 * 类型守卫：判断是否为分割线
 */
export function isMenuDivider(item: MenuItem): item is MenuDivider {
  return item.type === MenuType.DIVIDER
}

/**
 * 判断菜单项是否有子菜单
 */
export function hasChildren(item: MenuItem): item is MenuGroup | (MenuNavItem & { children: MenuItem[] }) {
  if (isMenuGroup(item)) {
    return item.children.length > 0
  }
  if (isMenuNavItem(item)) {
    return !!item.children && item.children.length > 0
  }
  return false
}
