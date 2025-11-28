/**
 * 认证状态管理
 * 使用 zustand 管理全局认证状态
 */

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { authApi, type UserInfo } from '@/api'

// Token 存储键
const ACCESS_TOKEN_KEY = 'access_token'
const REFRESH_TOKEN_KEY = 'refresh_token'

/**
 * 认证状态接口
 */
export interface AuthState {
  /** 当前用户信息 */
  user: UserInfo | null
  /** 访问令牌 */
  accessToken: string | null
  /** 刷新令牌 */
  refreshToken: string | null
  /** 是否正在加载 */
  isLoading: boolean
  /** 是否已初始化 */
  isInitialized: boolean
  /** 错误信息 */
  error: string | null

  /** 是否已认证 */
  isAuthenticated: () => boolean
  /** 检查是否有指定权限 */
  hasPermission: (permission: string) => boolean
  /** 检查是否有指定角色 */
  hasRole: (role: string) => boolean
  /** 检查是否有任意一个权限 */
  hasAnyPermission: (permissions: string[]) => boolean
  /** 检查是否有所有权限 */
  hasAllPermissions: (permissions: string[]) => boolean

  /** 登录 */
  login: (username: string, password: string, rememberMe?: boolean) => Promise<void>
  /** 登出 */
  logout: () => Promise<void>
  /** 刷新令牌 */
  refreshTokens: () => Promise<boolean>
  /** 获取当前用户信息 */
  fetchCurrentUser: () => Promise<void>
  /** 初始化认证状态 */
  initialize: () => Promise<void>
  /** 清除错误 */
  clearError: () => void
  /** 设置用户信息 */
  setUser: (user: UserInfo | null) => void
}

/**
 * 从本地存储获取 token
 */
function getStoredTokens() {
  const accessToken = localStorage.getItem(ACCESS_TOKEN_KEY)
  const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY) || sessionStorage.getItem(REFRESH_TOKEN_KEY)
  return { accessToken, refreshToken }
}

/**
 * 保存 token 到本地存储
 */
function saveTokens(accessToken: string, refreshToken: string, remember: boolean) {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken)
  if (remember) {
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken)
  } else {
    sessionStorage.setItem(REFRESH_TOKEN_KEY, refreshToken)
  }
}

/**
 * 清除本地存储的 token
 */
function clearStoredTokens() {
  localStorage.removeItem(ACCESS_TOKEN_KEY)
  localStorage.removeItem(REFRESH_TOKEN_KEY)
  sessionStorage.removeItem(REFRESH_TOKEN_KEY)
}

/**
 * 认证状态 Store
 */
export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isLoading: false,
      isInitialized: false,
      error: null,

      isAuthenticated: () => {
        const state = get()
        return !!state.accessToken && !!state.user
      },

      hasPermission: (permission: string) => {
        const { user } = get()
        if (!user) return false
        // 管理员拥有所有权限
        if (user.roles.includes('admin') || user.roles.includes('super_admin')) {
          return true
        }
        // TODO: 当用户信息中包含 permissions 时，检查权限
        return false
      },

      hasRole: (role: string) => {
        const { user } = get()
        if (!user) return false
        return user.roles.includes(role)
      },

      hasAnyPermission: (permissions: string[]) => {
        const { hasPermission } = get()
        return permissions.some(hasPermission)
      },

      hasAllPermissions: (permissions: string[]) => {
        const { hasPermission } = get()
        return permissions.every(hasPermission)
      },

      login: async (username: string, password: string, rememberMe = false) => {
        set({ isLoading: true, error: null })
        try {
          const response = await authApi.login({ username, password, rememberMe })
          
          // 保存 token
          saveTokens(response.accessToken, response.refreshToken, rememberMe)
          
          set({
            user: response.user ?? null,
            accessToken: response.accessToken,
            refreshToken: response.refreshToken,
            isLoading: false,
            error: null,
          })
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : '登录失败'
          set({ isLoading: false, error: errorMessage })
          throw err
        }
      },

      logout: async () => {
        set({ isLoading: true })
        try {
          await authApi.logout()
        } catch {
          // 忽略登出错误，继续清理本地状态
        } finally {
          clearStoredTokens()
          set({
            user: null,
            accessToken: null,
            refreshToken: null,
            isLoading: false,
            error: null,
          })
        }
      },

      refreshTokens: async () => {
        try {
          const response = await authApi.refreshToken()
          
          // 更新 token
          const remember = !!localStorage.getItem(REFRESH_TOKEN_KEY)
          saveTokens(response.accessToken, response.refreshToken, remember)
          
          set({
            accessToken: response.accessToken,
            refreshToken: response.refreshToken,
          })
          return true
        } catch {
          // 刷新失败，清理状态
          clearStoredTokens()
          set({
            user: null,
            accessToken: null,
            refreshToken: null,
          })
          return false
        }
      },

      fetchCurrentUser: async () => {
        set({ isLoading: true, error: null })
        try {
          const response = await authApi.getCurrentUser()
          set({
            user: response.user ?? null,
            isLoading: false,
          })
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : '获取用户信息失败'
          set({ isLoading: false, error: errorMessage })
          throw err
        }
      },

      initialize: async () => {
        const { accessToken, refreshToken } = getStoredTokens()
        
        if (!accessToken) {
          set({ isInitialized: true })
          return
        }

        set({ 
          accessToken, 
          refreshToken,
          isLoading: true 
        })

        try {
          // 尝试获取当前用户信息
          const response = await authApi.getCurrentUser()
          set({
            user: response.user ?? null,
            isLoading: false,
            isInitialized: true,
          })
        } catch {
          // 尝试刷新 token
          if (refreshToken) {
            const success = await get().refreshTokens()
            if (success) {
              try {
                const response = await authApi.getCurrentUser()
                set({
                  user: response.user ?? null,
                  isLoading: false,
                  isInitialized: true,
                })
                return
              } catch {
                // 刷新后仍然失败，清理状态
              }
            }
          }
          
          // 清理无效的认证状态
          clearStoredTokens()
          set({
            user: null,
            accessToken: null,
            refreshToken: null,
            isLoading: false,
            isInitialized: true,
          })
        }
      },

      clearError: () => set({ error: null }),

      setUser: (user: UserInfo | null) => set({ user }),
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        // 只持久化用户信息，token 在本地存储中单独管理
        user: state.user,
      }),
    }
  )
)
