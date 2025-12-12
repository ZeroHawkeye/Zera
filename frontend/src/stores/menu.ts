/**
 * 菜单状态管理
 * 使用 zustand 管理菜单的展开/折叠状态
 */

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { MenuKey, MenuItem, MenuPermissionContext } from '@/config/menu'
import {
  menuRegistry,
  getOpenKeysForPath,
  getDefaultOpenKeys,
  generateBreadcrumbs,
} from '@/config/menu'

/**
 * 菜单状态接口
 */
export interface MenuState {
  /** 展开的菜单 key 列表 */
  openKeys: MenuKey[]
  /** 当前激活的菜单项 key */
  activeKey: MenuKey | null
  /** 侧边栏是否折叠 */
  collapsed: boolean
  /** 移动端菜单是否打开 */
  mobileMenuOpen: boolean
  /** 当前激活的顶级菜单 key（用于 TopNavLayout） */
  activeTopMenuKey: MenuKey | null

  /** 获取处理后的菜单项（已过滤权限） */
  getFilteredMenuItems: (context: MenuPermissionContext) => MenuItem[]
  /** 获取原始菜单项 */
  getMenuItems: () => MenuItem[]
  /** 获取面包屑数据 */
  getBreadcrumbs: (path: string) => Array<{ key: MenuKey; label: string; path?: string }>

  /** 设置展开的菜单 keys */
  setOpenKeys: (keys: MenuKey[]) => void
  /** 切换菜单展开状态 */
  toggleOpenKey: (key: MenuKey) => void
  /** 设置激活的菜单项 */
  setActiveKey: (key: MenuKey | null) => void
  /** 根据路径更新菜单状态 */
  updateByPath: (path: string) => void
  /** 设置侧边栏折叠状态 */
  setCollapsed: (collapsed: boolean) => void
  /** 切换侧边栏折叠状态 */
  toggleCollapsed: () => void
  /** 设置移动端菜单状态 */
  setMobileMenuOpen: (open: boolean) => void
  /** 设置激活的顶级菜单 key */
  setActiveTopMenuKey: (key: MenuKey | null) => void
  /** 展开所有菜单 */
  expandAll: () => void
  /** 折叠所有菜单 */
  collapseAll: () => void
  /** 重置为默认展开状态 */
  resetToDefault: () => void
}

/**
 * 菜单状态 Store
 */
export const useMenuStore = create<MenuState>()(
  persist(
    (set, get) => ({
      openKeys: [],
      activeKey: null,
      collapsed: false,
      mobileMenuOpen: false,
      activeTopMenuKey: null,

      getFilteredMenuItems: (context: MenuPermissionContext) => {
        return menuRegistry.getMergedMenuItems(context)
      },

      getMenuItems: () => {
        return menuRegistry.getMergedMenuItems()
      },

      getBreadcrumbs: (path: string) => {
        const items = get().getMenuItems()
        return generateBreadcrumbs(items, path)
      },

      setOpenKeys: (keys: MenuKey[]) => {
        set({ openKeys: keys })
      },

      toggleOpenKey: (key: MenuKey) => {
        const { openKeys } = get()
        const index = openKeys.indexOf(key)
        if (index === -1) {
          set({ openKeys: [...openKeys, key] })
        } else {
          set({ openKeys: openKeys.filter((k) => k !== key) })
        }
      },

      setActiveKey: (key: MenuKey | null) => {
        set({ activeKey: key })
      },

      updateByPath: (path: string) => {
        const items = get().getMenuItems()
        const openKeys = getOpenKeysForPath(items, path)
        
        // 找到当前路径对应的菜单项 key
        const activeKey = openKeys.length > 0 ? openKeys[openKeys.length - 1] : null
        
        // 合并新的 openKeys（保留已展开的，添加新的）
        const currentOpenKeys = get().openKeys
        const mergedKeys = [...new Set([...currentOpenKeys, ...openKeys])]
        
        set({
          openKeys: mergedKeys,
          activeKey,
        })
      },

      setCollapsed: (collapsed: boolean) => {
        set({ collapsed })
      },

      toggleCollapsed: () => {
        set((state) => ({ collapsed: !state.collapsed }))
      },

      setMobileMenuOpen: (open: boolean) => {
        set({ mobileMenuOpen: open })
      },

      setActiveTopMenuKey: (key: MenuKey | null) => {
        set({ activeTopMenuKey: key })
      },

      expandAll: () => {
        const items = get().getMenuItems()
        const allKeys: MenuKey[] = []
        
        const collectKeys = (menuItems: MenuItem[]) => {
          for (const item of menuItems) {
            if ('children' in item && item.children) {
              allKeys.push(item.key)
              collectKeys(item.children)
            }
          }
        }
        
        collectKeys(items)
        set({ openKeys: allKeys })
      },

      collapseAll: () => {
        set({ openKeys: [] })
      },

      resetToDefault: () => {
        const items = get().getMenuItems()
        const defaultKeys = getDefaultOpenKeys(items)
        set({ openKeys: defaultKeys })
      },
    }),
    {
      name: 'menu-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        // 只持久化折叠状态和展开的菜单
        collapsed: state.collapsed,
        openKeys: state.openKeys,
      }),
    }
  )
)
