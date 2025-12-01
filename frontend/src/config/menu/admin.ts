/**
 * 后台管理菜单配置
 * 定义系统管理相关的菜单项
 */

import {
  LayoutDashboard,
  Users,
  Shield,
  Settings,
  type LucideIcon,
} from 'lucide-react'
import { MenuType, type MenuItem } from './types'
import { defineMenuModule, menuRegistry } from './registry'
import { USER_PERMISSIONS, ROLE_PERMISSIONS } from '../permissions'

/**
 * 创建图标包装器
 * 用于统一处理 lucide-react 图标
 */
const createIcon = (Icon: LucideIcon) => Icon

/**
 * 后台管理核心菜单配置
 */
const adminCoreMenuItems: MenuItem[] = [
  // 仪表盘
  {
    key: 'dashboard',
    type: MenuType.ITEM,
    label: '仪表盘',
    icon: createIcon(LayoutDashboard),
    path: '/admin',
    order: 0,
  },
  
  // 用户管理 - 使用 SubMenu 形式（ITEM 类型 + children）
  {
    key: 'users-management',
    type: MenuType.ITEM,
    label: '用户管理',
    icon: createIcon(Shield),
    order: 100,
    defaultOpen: true,
    // 只要有任一子菜单权限就显示父菜单
    permission: {
      permissions: [USER_PERMISSIONS.READ, ROLE_PERMISSIONS.READ],
    },
    children: [
      // 用户管理
      {
        key: 'users',
        type: MenuType.ITEM,
        label: '用户管理',
        icon: createIcon(Users),
        path: '/admin/users',
        order: 0,
        permission: {
          permissions: [USER_PERMISSIONS.READ],
        },
      },
      // 角色管理
      {
        key: 'roles',
        type: MenuType.ITEM,
        label: '角色管理',
        icon: createIcon(Shield),
        path: '/admin/roles',
        order: 10,
        permission: {
          permissions: [ROLE_PERMISSIONS.READ],
        },
      },
    ],
  },

  // 系统设置
  {
    key: 'settings',
    type: MenuType.ITEM,
    label: '系统设置',
    icon: createIcon(Settings),
    path: '/admin/settings',
    order: 200,
  },
]

/**
 * 后台管理核心菜单模块
 */
export const adminCoreMenuModule = defineMenuModule(
  'admin-core',
  '后台管理核心菜单',
  () => ({
    items: adminCoreMenuItems,
    enabled: true,
    priority: 0, // 最高优先级
  })
)

/**
 * 初始化后台菜单
 * 注册所有后台相关的菜单模块
 */
export function initAdminMenus(): void {
  menuRegistry.register(adminCoreMenuModule)
}

/**
 * 导出菜单项（用于直接访问）
 */
export { adminCoreMenuItems }
