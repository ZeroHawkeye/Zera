/**
 * 权限控制组件
 *
 * 提供声明式的权限控制，用于控制组件、按钮的显示/隐藏
 */

import type { ReactNode } from 'react'
import { useAuthStore } from '@/stores'

/**
 * Authorized 组件属性
 */
export interface AuthorizedProps {
  /**
   * 需要的单个权限
   * 与 permissions 二选一
   */
  permission?: string
  /**
   * 需要的权限列表（满足任一即可）
   * 与 permission 二选一
   */
  permissions?: string[]
  /**
   * 是否需要满足所有权限
   * 默认 false，即满足任一权限即可
   */
  requireAll?: boolean
  /**
   * 需要的角色
   */
  role?: string
  /**
   * 需要的角色列表（满足任一即可）
   */
  roles?: string[]
  /**
   * 无权限时显示的内容
   */
  fallback?: ReactNode
  /**
   * 子元素
   */
  children: ReactNode
}

/**
 * 权限控制组件
 *
 * 根据用户权限决定是否渲染子组件
 *
 * @example
 * ```tsx
 * // 单个权限
 * <Authorized permission="user:create">
 *   <Button>创建用户</Button>
 * </Authorized>
 *
 * // 多个权限（任一满足）
 * <Authorized permissions={['user:update', 'user:delete']}>
 *   <Button>编辑/删除</Button>
 * </Authorized>
 *
 * // 多个权限（全部满足）
 * <Authorized permissions={['user:read', 'user:update']} requireAll>
 *   <Button>查看并编辑</Button>
 * </Authorized>
 *
 * // 带有 fallback
 * <Authorized permission="user:delete" fallback={<Button disabled>删除</Button>}>
 *   <Button danger>删除</Button>
 * </Authorized>
 * ```
 */
export function Authorized({
  permission,
  permissions,
  requireAll = false,
  role,
  roles,
  fallback = null,
  children,
}: AuthorizedProps): ReactNode {
  const { hasPermission, hasAnyPermission, hasAllPermissions, hasRole } = useAuthStore()

  // 检查角色
  if (role && !hasRole(role)) {
    return fallback
  }

  if (roles && roles.length > 0) {
    const hasAnyRole = roles.some((r) => hasRole(r))
    if (!hasAnyRole) {
      return fallback
    }
  }

  // 检查权限
  if (permission) {
    if (!hasPermission(permission)) {
      return fallback
    }
  }

  if (permissions && permissions.length > 0) {
    const hasAccess = requireAll
      ? hasAllPermissions(permissions)
      : hasAnyPermission(permissions)
    if (!hasAccess) {
      return fallback
    }
  }

  return children
}

/**
 * useAuthorized Hook
 *
 * 用于在代码逻辑中检查权限
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { canCreate, canDelete } = useAuthorized({
 *     canCreate: 'user:create',
 *     canDelete: 'user:delete',
 *   })
 *
 *   return (
 *     <div>
 *       {canCreate && <Button>创建</Button>}
 *       {canDelete && <Button danger>删除</Button>}
 *     </div>
 *   )
 * }
 * ```
 */
export function useAuthorized<T extends Record<string, string>>(
  permissionMap: T
): Record<keyof T, boolean> {
  const { hasPermission } = useAuthStore()

  const result = {} as Record<keyof T, boolean>
  for (const key in permissionMap) {
    result[key] = hasPermission(permissionMap[key])
  }

  return result
}

/**
 * withAuthorized HOC
 *
 * 用于包装整个组件，无权限时不渲染或渲染 fallback
 *
 * @example
 * ```tsx
 * const ProtectedButton = withAuthorized(Button, {
 *   permission: 'user:delete',
 *   fallback: <Button disabled>无权限</Button>,
 * })
 * ```
 */
export function withAuthorized<P extends object>(
  Component: React.ComponentType<P>,
  options: Omit<AuthorizedProps, 'children'>
) {
  return function AuthorizedComponent(props: P) {
    return (
      <Authorized {...options}>
        <Component {...props} />
      </Authorized>
    )
  }
}

export default Authorized
