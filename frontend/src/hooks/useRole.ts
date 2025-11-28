/**
 * 角色管理相关 Hooks
 */

import { useState, useCallback, useEffect } from 'react'
import { message } from 'antd'
import {
  roleApi,
  type RoleInfo,
  type PermissionInfo,
  type PermissionGroup,
  type ListRolesParams,
  type CreateRoleParams,
  type UpdateRoleParams,
} from '@/api'

/**
 * 角色列表状态
 */
interface UseRolesState {
  roles: RoleInfo[]
  total: number
  loading: boolean
  error: string | null
}

/**
 * 分页参数
 */
interface UsePaginationState {
  page: number
  pageSize: number
}

/**
 * 角色列表 Hook
 */
export function useRoles(initialParams?: Partial<ListRolesParams>) {
  const [state, setState] = useState<UseRolesState>({
    roles: [],
    total: 0,
    loading: false,
    error: null,
  })

  const [pagination, setPagination] = useState<UsePaginationState>({
    page: initialParams?.page ?? 1,
    pageSize: initialParams?.pageSize ?? 10,
  })

  const [filters, setFilters] = useState<Omit<ListRolesParams, 'page' | 'pageSize'>>({
    keyword: initialParams?.keyword ?? '',
    isSystem: initialParams?.isSystem,
  })

  /**
   * 获取角色列表
   */
  const fetchRoles = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }))

    try {
      const response = await roleApi.listRoles({
        ...pagination,
        ...filters,
      })

      setState({
        roles: response.roles,
        total: Number(response.total),
        loading: false,
        error: null,
      })
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '获取角色列表失败'
      setState(prev => ({
        ...prev,
        loading: false,
        error: errorMessage,
      }))
      message.error(errorMessage)
    }
  }, [pagination, filters])

  /**
   * 刷新角色列表
   */
  const refresh = useCallback(() => {
    fetchRoles()
  }, [fetchRoles])

  /**
   * 更新分页
   */
  const updatePagination = useCallback((page: number, pageSize?: number) => {
    setPagination(prev => ({
      page,
      pageSize: pageSize ?? prev.pageSize,
    }))
  }, [])

  /**
   * 更新筛选条件
   */
  const updateFilters = useCallback((newFilters: Partial<typeof filters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }))
    // 重置到第一页
    setPagination(prev => ({ ...prev, page: 1 }))
  }, [])

  /**
   * 搜索
   */
  const search = useCallback((keyword: string) => {
    updateFilters({ keyword })
  }, [updateFilters])

  // 自动加载
  useEffect(() => {
    fetchRoles()
  }, [fetchRoles])

  return {
    ...state,
    pagination,
    filters,
    refresh,
    updatePagination,
    updateFilters,
    search,
  }
}

/**
 * 角色详情 Hook
 */
export function useRole(roleId: string | undefined) {
  const [role, setRole] = useState<RoleInfo | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchRole = useCallback(async () => {
    if (!roleId) return

    setLoading(true)
    setError(null)

    try {
      const response = await roleApi.getRole(roleId)
      setRole(response.role ?? null)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '获取角色详情失败'
      setError(errorMessage)
      message.error(errorMessage)
    } finally {
      setLoading(false)
    }
  }, [roleId])

  const refresh = useCallback(() => {
    fetchRole()
  }, [fetchRole])

  useEffect(() => {
    fetchRole()
  }, [fetchRole])

  return { role, loading, error, refresh }
}

/**
 * 权限列表 Hook
 */
export function usePermissions(resource?: string) {
  const [permissions, setPermissions] = useState<PermissionInfo[]>([])
  const [groups, setGroups] = useState<PermissionGroup[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchPermissions = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await roleApi.listPermissions(resource)
      setPermissions(response.permissions)
      setGroups(response.groups)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '获取权限列表失败'
      setError(errorMessage)
      message.error(errorMessage)
    } finally {
      setLoading(false)
    }
  }, [resource])

  const refresh = useCallback(() => {
    fetchPermissions()
  }, [fetchPermissions])

  useEffect(() => {
    fetchPermissions()
  }, [fetchPermissions])

  return { permissions, groups, loading, error, refresh }
}

/**
 * 角色权限 Hook
 */
export function useRolePermissions(roleId: string | undefined) {
  const [permissions, setPermissions] = useState<string[]>([])
  const [allGroups, setAllGroups] = useState<PermissionGroup[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchRolePermissions = useCallback(async () => {
    if (!roleId) return

    setLoading(true)
    setError(null)

    try {
      const response = await roleApi.getRolePermissions(roleId)
      setPermissions(response.permissions)
      setAllGroups(response.allPermissionGroups)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '获取角色权限失败'
      setError(errorMessage)
      message.error(errorMessage)
    } finally {
      setLoading(false)
    }
  }, [roleId])

  const refresh = useCallback(() => {
    fetchRolePermissions()
  }, [fetchRolePermissions])

  useEffect(() => {
    fetchRolePermissions()
  }, [fetchRolePermissions])

  return { permissions, allGroups, loading, error, refresh }
}

/**
 * 角色操作 Hook
 */
export function useRoleActions() {
  const [loading, setLoading] = useState(false)

  /**
   * 创建角色
   */
  const createRole = useCallback(async (params: CreateRoleParams) => {
    setLoading(true)
    try {
      const response = await roleApi.createRole(params)
      message.success('角色创建成功')
      return response.role
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '创建角色失败'
      message.error(errorMessage)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  /**
   * 更新角色
   */
  const updateRole = useCallback(async (params: UpdateRoleParams) => {
    setLoading(true)
    try {
      const response = await roleApi.updateRole(params)
      message.success('角色更新成功')
      return response.role
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '更新角色失败'
      message.error(errorMessage)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  /**
   * 删除角色
   */
  const deleteRole = useCallback(async (id: string) => {
    setLoading(true)
    try {
      await roleApi.deleteRole(id)
      message.success('角色删除成功')
      return true
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '删除角色失败'
      message.error(errorMessage)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  /**
   * 更新角色权限
   */
  const updateRolePermissions = useCallback(async (roleId: string, permissions: string[]) => {
    setLoading(true)
    try {
      await roleApi.updateRolePermissions(roleId, permissions)
      message.success('权限更新成功')
      return true
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '更新权限失败'
      message.error(errorMessage)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  return {
    loading,
    createRole,
    updateRole,
    deleteRole,
    updateRolePermissions,
  }
}
