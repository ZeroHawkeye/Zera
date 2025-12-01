/**
 * 多层级菜单渲染组件
 * 支持最深5层嵌套，递归渲染菜单项
 */

import { useCallback, useMemo, type ReactNode, isValidElement } from 'react'
import { Link, useLocation } from '@tanstack/react-router'
import { ChevronDown, ExternalLink } from 'lucide-react'
import { Badge, Tooltip } from 'antd'
import {
  type MenuItem,
  type MenuPermissionContext,
  type MenuIcon,
  MAX_MENU_DEPTH,
  isMenuGroup,
  isMenuNavItem,
  isMenuDivider,
  hasChildren,
  filterMenuItems,
} from '@/config/menu'
import { useMenuStore, useAuthStore } from '@/stores'

/**
 * 菜单渲染器 Props
 */
interface MenuRendererProps {
  /** 菜单项列表 */
  items: MenuItem[]
  /** 是否折叠模式 */
  collapsed?: boolean
  /** 当前嵌套层级（内部使用） */
  level?: number
}

/**
 * 菜单渲染器
 * 根据菜单配置递归渲染菜单项
 */
export function MenuRenderer({
  items,
  collapsed = false,
  level = 0,
}: MenuRendererProps) {
  const location = useLocation()
  const { user } = useAuthStore()
  const { openKeys, toggleOpenKey } = useMenuStore()

  // 构建权限上下文
  const permissionContext: MenuPermissionContext = useMemo(
    () => ({
      permissions: user?.permissions || [],
      roles: user?.roles || [],
      user: user as Record<string, unknown> | null,
    }),
    [user]
  )

  // 过滤菜单项
  const filteredItems = useMemo(
    () => (level === 0 ? filterMenuItems(items, permissionContext) : items),
    [items, permissionContext, level]
  )

  // 检查菜单项是否激活
  const isActive = useCallback(
    (item: MenuItem): boolean => {
      if (!isMenuNavItem(item) || !item.path) return false
      
      // 精确匹配
      if (location.pathname === item.path) return true
      
      // 对于仪表盘特殊处理
      if (item.path === '/admin') {
        return location.pathname === '/admin' || location.pathname === '/admin/'
      }
      
      // 前缀匹配（检查子路径）
      return location.pathname.startsWith(item.path + '/')
    },
    [location.pathname]
  )

  // 检查分组是否包含激活项
  const hasActiveChild = useCallback(
    (item: MenuItem): boolean => {
      if (!hasChildren(item)) return false
      
      const children = isMenuGroup(item) ? item.children : item.children
      if (!children) return false
      
      return children.some((child) => {
        if (isActive(child)) return true
        if (hasChildren(child)) return hasActiveChild(child)
        return false
      })
    },
    [isActive]
  )

  // 渲染单个菜单项
  const renderMenuItem = useCallback(
    (item: MenuItem) => {
      // 分割线
      if (isMenuDivider(item)) {
        return (
          <div
            key={item.key}
            className={`my-2 mx-3 border-t transition-opacity ${
              collapsed ? 'border-gray-200/50' : 'border-gray-200/60'
            }`}
          />
        )
      }

      // 分组或带子菜单的导航项
      if (hasChildren(item)) {
        return (
          <MenuGroupItem
            key={item.key}
            item={item}
            collapsed={collapsed}
            level={level}
            isOpen={openKeys.includes(item.key)}
            hasActiveChild={hasActiveChild(item)}
            onToggle={() => toggleOpenKey(item.key)}
          />
        )
      }

      // 普通导航项
      if (isMenuNavItem(item)) {
        return (
          <MenuNavItemComponent
            key={item.key}
            item={item}
            collapsed={collapsed}
            level={level}
            isActive={isActive(item)}
          />
        )
      }

      return null
    },
    [collapsed, level, openKeys, toggleOpenKey, isActive, hasActiveChild]
  )

  // 防止超过最大嵌套层级
  if (level >= MAX_MENU_DEPTH) {
    console.warn(`Menu depth exceeded maximum of ${MAX_MENU_DEPTH}`)
    return null
  }

  return (
    <div className="space-y-1">
      {filteredItems.map(renderMenuItem)}
    </div>
  )
}

/**
 * 渲染菜单图标
 */
function renderIcon(icon: MenuIcon | undefined, className: string = 'w-5 h-5'): ReactNode {
  if (!icon) return null

  // 如果是 React 元素，直接返回
  if (isValidElement(icon)) {
    return icon
  }

  // 如果是组件，渲染它
  if (typeof icon === 'function') {
    const IconComponent = icon
    return <IconComponent className={className} />
  }

  return null
}

/**
 * 分组/子菜单项组件 Props
 */
interface MenuGroupItemProps {
  item: MenuItem
  collapsed: boolean
  level: number
  isOpen: boolean
  hasActiveChild: boolean
  onToggle: () => void
}

/**
 * SubMenu 子菜单组件
 * 可展开/收起的嵌套菜单
 */
function MenuGroupItem({
  item,
  collapsed,
  level,
  isOpen,
  hasActiveChild,
  onToggle,
}: MenuGroupItemProps) {
  const label = isMenuGroup(item) ? item.label : (item as { label: string }).label
  const icon = 'icon' in item ? item.icon : undefined
  const children = isMenuGroup(item)
    ? item.children
    : (item as { children?: MenuItem[] }).children

  // 根据层级获取背景色
  const getLevelBgClass = (lvl: number, active: boolean) => {
    if (active) {
      // 激活状态：蓝色背景，层级越深颜色越浅
      const activeBgClasses = [
        'bg-blue-100',
        'bg-blue-100/80',
        'bg-blue-100/60',
        'bg-blue-50',
      ]
      return activeBgClasses[Math.min(lvl, activeBgClasses.length - 1)]
    }
    // hover 状态：层级越深背景越浅
    const hoverBgClasses = [
      'hover:bg-gray-100',
      'hover:bg-gray-100/80',
      'hover:bg-gray-100/60',
      'hover:bg-gray-50',
    ]
    return hoverBgClasses[Math.min(lvl, hoverBgClasses.length - 1)]
  }

  // 可展开/收起的 SubMenu
  const content = (
    <div>
      <button
        onClick={onToggle}
        className={`
          w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 relative group cursor-pointer
          ${hasActiveChild
            ? `${getLevelBgClass(level, true)} text-blue-600`
            : `text-gray-500 ${getLevelBgClass(level, false)} hover:text-gray-700`
          }
        `}
        style={{ paddingLeft: `${12 + level * 12}px` }}
      >
        {/* 激活指示条 */}
        <div
          className={`
            absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full bg-blue-500 transition-opacity duration-200
            ${hasActiveChild ? 'opacity-60' : 'opacity-0'}
          `}
        />

        {/* 图标 */}
        <span className="flex-shrink-0">
          {renderIcon(icon)}
        </span>

        {/* 标签 */}
        <span
          className={`text-sm font-medium whitespace-nowrap overflow-hidden transition-all duration-300 flex-1 text-left ${
            collapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'
          }`}
        >
          {label}
        </span>

        {/* 展开/折叠箭头 */}
        {!collapsed && (
          <span
            className={`transition-transform duration-200 ${
              isOpen ? 'rotate-180' : ''
            }`}
          >
            <ChevronDown className="w-4 h-4" />
          </span>
        )}
      </button>

      {/* 子菜单 */}
      {!collapsed && (
        <div
          className={`overflow-hidden transition-all duration-300 ${
            isOpen ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'
          }`}
        >
          <div className="pt-1">
            {children && (
              <MenuRenderer items={children} collapsed={collapsed} level={level + 1} />
            )}
          </div>
        </div>
      )}
    </div>
  )

  // 折叠模式下显示 Tooltip
  if (collapsed) {
    return (
      <Tooltip title={label} placement="right">
        {content}
      </Tooltip>
    )
  }

  return content
}

/**
 * 导航菜单项组件 Props
 */
interface MenuNavItemProps {
  item: MenuItem
  collapsed: boolean
  level: number
  isActive: boolean
}

/**
 * 导航菜单项组件
 */
function MenuNavItemComponent({
  item,
  collapsed,
  level,
  isActive,
}: MenuNavItemProps) {
  if (!isMenuNavItem(item)) return null

  const { label, icon, path, externalLink, openInNewTab, badge } = item

  // 外部链接
  if (externalLink) {
    const linkContent = (
      <a
        href={externalLink}
        target={openInNewTab ? '_blank' : undefined}
        rel={openInNewTab ? 'noopener noreferrer' : undefined}
        className={`
          flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 relative group
          text-gray-500 hover:bg-gray-100/80 hover:text-gray-700
        `}
        style={{ paddingLeft: `${12 + level * 12}px` }}
      >
        <span className="flex-shrink-0">
          {renderIcon(icon)}
        </span>
        <span
          className={`text-sm font-medium whitespace-nowrap overflow-hidden transition-all duration-300 flex-1 ${
            collapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'
          }`}
        >
          {label}
        </span>
        {!collapsed && (
          <ExternalLink className="w-3.5 h-3.5 text-gray-400" />
        )}
      </a>
    )

    if (collapsed) {
      return (
        <Tooltip title={label} placement="right">
          {linkContent}
        </Tooltip>
      )
    }

    return linkContent
  }

  // 根据层级获取背景色
  const getLevelBgClass = (lvl: number, active: boolean) => {
    if (active) {
      // 激活状态：蓝色背景，层级越深颜色越浅
      const activeBgClasses = [
        'bg-blue-100',
        'bg-blue-100/80',
        'bg-blue-100/60',
        'bg-blue-50',
      ]
      return activeBgClasses[Math.min(lvl, activeBgClasses.length - 1)]
    }
    // hover 状态：层级越深背景越浅
    const hoverBgClasses = [
      'hover:bg-gray-100',
      'hover:bg-gray-100/80',
      'hover:bg-gray-100/60',
      'hover:bg-gray-50',
    ]
    return hoverBgClasses[Math.min(lvl, hoverBgClasses.length - 1)]
  }

  // 内部导航
  const navContent = (
    <Link
      to={path || '#'}
      className={`
        flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 relative overflow-hidden group
        ${isActive
          ? `${getLevelBgClass(level, true)} text-blue-600`
          : `text-gray-500 ${getLevelBgClass(level, false)} hover:text-gray-700`
        }
      `}
      style={{ paddingLeft: `${12 + level * 12}px` }}
    >
      {/* 激活指示条 */}
      <div
        className={`
          absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full bg-blue-500 transition-all duration-200
          ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-50'}
        `}
      />

      {/* 图标 */}
      <span className="flex-shrink-0">
        {renderIcon(icon)}
      </span>

      {/* 标签 */}
      <span
        className={`text-sm font-medium whitespace-nowrap overflow-hidden transition-all duration-300 flex-1 ${
          collapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'
        }`}
      >
        {label}
      </span>

      {/* 徽章 */}
      {!collapsed && badge && (
        <Badge
          count={badge.count}
          dot={badge.dot}
          overflowCount={badge.overflowCount}
          color={badge.color}
          size="small"
        />
      )}

      {/* 激活状态指示点 */}
      {!collapsed && (
        <div
          className={`absolute right-3 w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse transition-opacity duration-200 ${
            isActive ? 'opacity-100' : 'opacity-0'
          }`}
        />
      )}
    </Link>
  )

  // 折叠模式下显示 Tooltip
  if (collapsed) {
    return (
      <Tooltip title={label} placement="right">
        {navContent}
      </Tooltip>
    )
  }

  return navContent
}

export default MenuRenderer
