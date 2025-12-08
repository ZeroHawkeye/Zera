/**
 * 路由守卫
 * 
 * 提供路由级别的访问控制和权限验证
 * 使用 zustand store 管理认证状态
 */

import { redirect } from '@tanstack/react-router'
import { useAuthStore } from '@/stores'
import { getCasLoginUrl } from '@/api/cas_auth'

/**
 * 获取认证状态（非 hook 方式，用于路由守卫）
 */
function getAuthState() {
  return useAuthStore.getState()
}

/**
 * 认证状态检查
 */
export function isAuthenticated(): boolean {
  const state = getAuthState()
  return !!state.accessToken
}

/**
 * 获取当前用户信息
 */
export function getCurrentUser() {
  const state = getAuthState()
  return state.user
}

/**
 * 检查用户是否有指定权限
 */
export function hasPermission(permission: string): boolean {
  const state = getAuthState()
  return state.hasPermission(permission)
}

/**
 * 检查用户是否有指定角色
 */
export function hasRole(role: string): boolean {
  const state = getAuthState()
  return state.hasRole(role)
}

/**
 * 检查用户是否有任意一个指定权限
 */
export function hasAnyPermission(permissions: string[]): boolean {
  const state = getAuthState()
  return state.hasAnyPermission(permissions)
}

/**
 * 检查用户是否有所有指定权限
 */
export function hasAllPermissions(permissions: string[]): boolean {
  const state = getAuthState()
  return state.hasAllPermissions(permissions)
}

/**
 * 认证守卫
 * 用于保护需要登录的路由
 * 未登录时优先跳转到 Casdoor 统一登录页面
 */
export async function authGuard() {
  if (!isAuthenticated()) {
    const currentPath = window.location.pathname
    
    // 尝试获取 CAS 登录 URL
    const casLoginUrl = await getCasLoginUrl(currentPath)
    
    if (casLoginUrl) {
      // CAS 已启用，直接跳转到 Casdoor 登录页面
      window.location.href = casLoginUrl
      // 抛出错误阻止后续路由加载
      throw new Error('Redirecting to CAS login')
    }
    
    // CAS 未启用，回退到前端登录页面
    throw redirect({
      to: '/login',
      search: {
        redirect: currentPath,
      },
    })
  }
}

/**
 * 权限守卫
 * 用于保护需要特定权限的路由
 */
export async function permissionGuard(permission: string) {
  await authGuard()
  
  if (!hasPermission(permission)) {
    throw redirect({
      to: '/admin',
    })
  }
}

/**
 * 角色守卫
 * 用于保护需要特定角色的路由
 */
export async function roleGuard(role: string) {
  await authGuard()
  
  if (!hasRole(role)) {
    throw redirect({
      to: '/admin',
    })
  }
}

/**
 * 访客守卫
 * 用于保护仅限未登录用户访问的路由（如登录页）
 */
export function guestGuard() {
  if (isAuthenticated()) {
    throw redirect({
      to: '/admin',
    })
  }
}

/**
 * 等待认证初始化完成
 * 用于在路由加载前确保认证状态已初始化
 */
export async function waitForAuthInit(): Promise<void> {
  const state = getAuthState()
  if (!state.isInitialized) {
    await state.initialize()
  }
}
