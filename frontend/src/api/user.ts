/**
 * 用户管理服务 API
 * 对接 proto/base/user.proto 定义的 UserService
 */

import { create } from '@bufbuild/protobuf'
import { createClient } from '@connectrpc/connect'
import { transport } from './client'
import {
  UserService,
  ListUsersRequestSchema,
  GetUserRequestSchema,
  CreateUserRequestSchema,
  UpdateUserRequestSchema,
  DeleteUserRequestSchema,
  ResetUserPasswordRequestSchema,
  BatchDeleteUsersRequestSchema,
  BatchUpdateUserStatusRequestSchema,
  type ListUsersResponse,
  type GetUserResponse,
  type CreateUserResponse,
  type UpdateUserResponse,
  type DeleteUserResponse,
  type ResetUserPasswordResponse,
  type BatchDeleteUsersResponse,
  type BatchUpdateUserStatusResponse,
  type UserDetail,
  UserStatus,
} from '@/gen/base/user_pb'

// 创建用户服务客户端
const userClient = createClient(UserService, transport)

/**
 * 用户列表查询参数
 */
export interface ListUsersParams {
  page?: number
  pageSize?: number
  keyword?: string
  status?: UserStatus
  role?: string
  sortBy?: string
  descending?: boolean
}

/**
 * 创建用户参数
 */
export interface CreateUserParams {
  username: string
  password: string
  email: string
  nickname?: string
  avatar?: string
  roles?: string[]
  status?: UserStatus
}

/**
 * 更新用户参数
 */
export interface UpdateUserParams {
  id: string
  nickname?: string
  email?: string
  avatar?: string
  roles?: string[]
  status?: UserStatus
}

/**
 * 用户管理服务 API
 */
export const userApi = {
  /**
   * 获取用户列表
   */
  async listUsers(params: ListUsersParams = {}): Promise<ListUsersResponse> {
    const request = create(ListUsersRequestSchema, {
      page: params.page ?? 1,
      pageSize: params.pageSize ?? 10,
      keyword: params.keyword ?? '',
      status: params.status ?? UserStatus.UNSPECIFIED,
      role: params.role ?? '',
      sortBy: params.sortBy ?? '',
      descending: params.descending ?? true,
    })

    return await userClient.listUsers(request)
  },

  /**
   * 获取用户详情
   */
  async getUser(id: string): Promise<GetUserResponse> {
    const request = create(GetUserRequestSchema, { id })
    return await userClient.getUser(request)
  },

  /**
   * 创建用户
   */
  async createUser(params: CreateUserParams): Promise<CreateUserResponse> {
    const request = create(CreateUserRequestSchema, {
      username: params.username,
      password: params.password,
      email: params.email,
      nickname: params.nickname ?? '',
      avatar: params.avatar ?? '',
      roles: params.roles ?? [],
      status: params.status ?? UserStatus.ACTIVE,
    })

    return await userClient.createUser(request)
  },

  /**
   * 更新用户
   */
  async updateUser(params: UpdateUserParams): Promise<UpdateUserResponse> {
    const request = create(UpdateUserRequestSchema, {
      id: params.id,
      nickname: params.nickname,
      email: params.email,
      avatar: params.avatar,
      roles: params.roles ?? [],
      status: params.status,
    })

    return await userClient.updateUser(request)
  },

  /**
   * 删除用户
   */
  async deleteUser(id: string): Promise<DeleteUserResponse> {
    const request = create(DeleteUserRequestSchema, { id })
    return await userClient.deleteUser(request)
  },

  /**
   * 重置用户密码
   */
  async resetUserPassword(id: string, newPassword: string): Promise<ResetUserPasswordResponse> {
    const request = create(ResetUserPasswordRequestSchema, {
      id,
      newPassword,
    })
    return await userClient.resetUserPassword(request)
  },

  /**
   * 批量删除用户
   */
  async batchDeleteUsers(ids: string[]): Promise<BatchDeleteUsersResponse> {
    const request = create(BatchDeleteUsersRequestSchema, { ids })
    return await userClient.batchDeleteUsers(request)
  },

  /**
   * 批量更新用户状态
   */
  async batchUpdateUserStatus(ids: string[], status: UserStatus): Promise<BatchUpdateUserStatusResponse> {
    const request = create(BatchUpdateUserStatusRequestSchema, { ids, status })
    return await userClient.batchUpdateUserStatus(request)
  },
}

// 导出类型
export type {
  ListUsersResponse,
  GetUserResponse,
  CreateUserResponse,
  UpdateUserResponse,
  DeleteUserResponse,
  ResetUserPasswordResponse,
  BatchDeleteUsersResponse,
  BatchUpdateUserStatusResponse,
  UserDetail,
}

export { UserStatus }
