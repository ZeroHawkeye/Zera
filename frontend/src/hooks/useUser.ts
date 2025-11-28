/**
 * 用户管理相关 Hooks
 */

import { useState, useCallback, useEffect } from 'react'
import { message } from 'antd'
import { 
  userApi, 
  type UserDetail, 
  type ListUsersParams, 
  UserStatus,
  type CreateUserParams,
  type UpdateUserParams 
} from '@/api'

/**
 * 用户列表状态
 */
interface UseUsersState {
  users: UserDetail[]
  total: number
  loading: boolean
  error: string | null
}

/**
 * 用户列表分页参数
 */
interface UsePaginationState {
  page: number
  pageSize: number
}

/**
 * 用户列表 Hook
 */
export function useUsers(initialParams?: Partial<ListUsersParams>) {
  const [state, setState] = useState<UseUsersState>({
    users: [],
    total: 0,
    loading: false,
    error: null,
  })

  const [pagination, setPagination] = useState<UsePaginationState>({
    page: initialParams?.page ?? 1,
    pageSize: initialParams?.pageSize ?? 10,
  })

  const [filters, setFilters] = useState<Omit<ListUsersParams, 'page' | 'pageSize'>>({
    keyword: initialParams?.keyword ?? '',
    status: initialParams?.status ?? UserStatus.UNSPECIFIED,
    role: initialParams?.role ?? '',
    sortBy: initialParams?.sortBy ?? 'created_at',
    descending: initialParams?.descending ?? true,
  })

  /**
   * 获取用户列表
   */
  const fetchUsers = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }))
    
    try {
      const response = await userApi.listUsers({
        ...pagination,
        ...filters,
      })
      
      setState({
        users: response.users,
        total: Number(response.total),
        loading: false,
        error: null,
      })
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '获取用户列表失败'
      setState(prev => ({
        ...prev,
        loading: false,
        error: errorMessage,
      }))
      message.error(errorMessage)
    }
  }, [pagination, filters])

  /**
   * 刷新用户列表
   */
  const refresh = useCallback(() => {
    fetchUsers()
  }, [fetchUsers])

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
    fetchUsers()
  }, [fetchUsers])

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
 * 用户详情 Hook
 */
export function useUser(userId: string | undefined) {
  const [user, setUser] = useState<UserDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchUser = useCallback(async () => {
    if (!userId) return

    setLoading(true)
    setError(null)

    try {
      const response = await userApi.getUser(userId)
      setUser(response.user ?? null)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '获取用户详情失败'
      setError(errorMessage)
      message.error(errorMessage)
    } finally {
      setLoading(false)
    }
  }, [userId])

  const refresh = useCallback(() => {
    fetchUser()
  }, [fetchUser])

  useEffect(() => {
    fetchUser()
  }, [fetchUser])

  return { user, loading, error, refresh }
}

/**
 * 用户操作 Hook
 */
export function useUserActions() {
  const [loading, setLoading] = useState(false)

  /**
   * 创建用户
   */
  const createUser = useCallback(async (params: CreateUserParams) => {
    setLoading(true)
    try {
      const response = await userApi.createUser(params)
      message.success('用户创建成功')
      return response.user
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '创建用户失败'
      message.error(errorMessage)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  /**
   * 更新用户
   */
  const updateUser = useCallback(async (params: UpdateUserParams) => {
    setLoading(true)
    try {
      const response = await userApi.updateUser(params)
      message.success('用户更新成功')
      return response.user
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '更新用户失败'
      message.error(errorMessage)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  /**
   * 删除用户
   */
  const deleteUser = useCallback(async (id: string) => {
    setLoading(true)
    try {
      await userApi.deleteUser(id)
      message.success('用户删除成功')
      return true
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '删除用户失败'
      message.error(errorMessage)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  /**
   * 重置密码
   */
  const resetPassword = useCallback(async (id: string, newPassword: string) => {
    setLoading(true)
    try {
      await userApi.resetUserPassword(id, newPassword)
      message.success('密码重置成功')
      return true
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '重置密码失败'
      message.error(errorMessage)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  /**
   * 批量删除用户
   */
  const batchDeleteUsers = useCallback(async (ids: string[]) => {
    setLoading(true)
    try {
      const response = await userApi.batchDeleteUsers(ids)
      if (response.failedIds.length > 0) {
        message.warning(`成功删除 ${response.deletedCount} 个用户，${response.failedIds.length} 个失败`)
      } else {
        message.success(`成功删除 ${response.deletedCount} 个用户`)
      }
      return response
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '批量删除失败'
      message.error(errorMessage)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  /**
   * 批量更新用户状态
   */
  const batchUpdateStatus = useCallback(async (ids: string[], status: UserStatus) => {
    setLoading(true)
    try {
      const response = await userApi.batchUpdateUserStatus(ids, status)
      if (response.failedIds.length > 0) {
        message.warning(`成功更新 ${response.updatedCount} 个用户，${response.failedIds.length} 个失败`)
      } else {
        message.success(`成功更新 ${response.updatedCount} 个用户状态`)
      }
      return response
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '批量更新状态失败'
      message.error(errorMessage)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  return {
    loading,
    createUser,
    updateUser,
    deleteUser,
    resetPassword,
    batchDeleteUsers,
    batchUpdateStatus,
  }
}

export { UserStatus }
