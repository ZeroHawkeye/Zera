/**
 * 布局状态管理
 * 用于管理系统布局模式切换
 */

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

/**
 * 布局模式
 */
export type LayoutMode = 'sidebar' | 'topnav'

/**
 * 布局状态接口
 */
export interface LayoutState {
  /** 当前布局模式 */
  layoutMode: LayoutMode
  /** 设置布局模式 */
  setLayoutMode: (mode: LayoutMode) => void
  /** 切换布局模式 */
  toggleLayoutMode: () => void
}

/**
 * 布局状态 Store
 */
export const useLayoutStore = create<LayoutState>()(
  persist(
    (set, get) => ({
      layoutMode: 'topnav',

      setLayoutMode: (mode: LayoutMode) => {
        set({ layoutMode: mode })
      },

      toggleLayoutMode: () => {
        const current = get().layoutMode
        set({ layoutMode: current === 'sidebar' ? 'topnav' : 'sidebar' })
      },
    }),
    {
      name: 'layout-storage',
      storage: createJSONStorage(() => localStorage),
    }
  )
)
