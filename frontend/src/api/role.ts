/**
 * 角色管理服务 API
 * 对接 proto/base/role.proto 定义的 RoleService
 */

import { create } from '@bufbuild/protobuf'
import { createClient } from '@connectrpc/connect'
import { transport } from './client'
import {
  RoleService,
  ListRolesRequestSchema,
  GetRoleRequestSchema,
  CreateRoleRequestSchema,
  UpdateRoleRequestSchema,
  DeleteRoleRequestSchema,
  ListPermissionsRequestSchema,
  GetRolePermissionsRequestSchema,
  UpdateRolePermissionsRequestSchema,
  type ListRolesResponse,
  type GetRoleResponse,
  type CreateRoleResponse,
  type UpdateRoleResponse,
  type DeleteRoleResponse,
  type ListPermissionsResponse,
  type GetRolePermissionsResponse,
  type UpdateRolePermissionsResponse,
  type RoleInfo,
  type PermissionInfo,
  type PermissionGroup,
} from '@/gen/base/role_pb'

// 创建角色服务客户端
const roleClient = createClient(RoleService, transport)

/**
 * 角色列表查询参数
 */
export interface ListRolesParams {
  page?: number
  pageSize?: number
  keyword?: string
  isSystem?: boolean
}

/**
 * 创建角色参数
 */
export interface CreateRoleParams {
  code: string
  name: string
  description?: string
  sortOrder?: number
  permissions?: string[]
}

/**
 * 更新角色参数
 */
export interface UpdateRoleParams {
  id: string
  name?: string
  description?: string
  sortOrder?: number
  permissions?: string[]
}

/**
 * 角色管理服务 API
 */
export const roleApi = {
  /**
   * 获取角色列表
   */
  async listRoles(params: ListRolesParams = {}): Promise<ListRolesResponse> {
    const request = create(ListRolesRequestSchema, {
      page: params.page ?? 1,
      pageSize: params.pageSize ?? 10,
      keyword: params.keyword ?? '',
      isSystem: params.isSystem,
    })

    return await roleClient.listRoles(request)
  },

  /**
   * 获取角色详情
   */
  async getRole(id: string): Promise<GetRoleResponse> {
    const request = create(GetRoleRequestSchema, { id })
    return await roleClient.getRole(request)
  },

  /**
   * 创建角色
   */
  async createRole(params: CreateRoleParams): Promise<CreateRoleResponse> {
    const request = create(CreateRoleRequestSchema, {
      code: params.code,
      name: params.name,
      description: params.description ?? '',
      sortOrder: params.sortOrder ?? 0,
      permissions: params.permissions ?? [],
    })

    return await roleClient.createRole(request)
  },

  /**
   * 更新角色
   */
  async updateRole(params: UpdateRoleParams): Promise<UpdateRoleResponse> {
    const request = create(UpdateRoleRequestSchema, {
      id: params.id,
      name: params.name,
      description: params.description,
      sortOrder: params.sortOrder,
      permissions: params.permissions ?? [],
    })

    return await roleClient.updateRole(request)
  },

  /**
   * 删除角色
   */
  async deleteRole(id: string): Promise<DeleteRoleResponse> {
    const request = create(DeleteRoleRequestSchema, { id })
    return await roleClient.deleteRole(request)
  },

  /**
   * 获取权限列表
   */
  async listPermissions(resource?: string): Promise<ListPermissionsResponse> {
    const request = create(ListPermissionsRequestSchema, {
      resource: resource ?? '',
    })
    return await roleClient.listPermissions(request)
  },

  /**
   * 获取角色权限
   */
  async getRolePermissions(roleId: string): Promise<GetRolePermissionsResponse> {
    const request = create(GetRolePermissionsRequestSchema, { roleId })
    return await roleClient.getRolePermissions(request)
  },

  /**
   * 更新角色权限
   */
  async updateRolePermissions(roleId: string, permissions: string[]): Promise<UpdateRolePermissionsResponse> {
    const request = create(UpdateRolePermissionsRequestSchema, {
      roleId,
      permissions,
    })
    return await roleClient.updateRolePermissions(request)
  },
}

// 导出类型
export type {
  ListRolesResponse,
  GetRoleResponse,
  CreateRoleResponse,
  UpdateRoleResponse,
  DeleteRoleResponse,
  ListPermissionsResponse,
  GetRolePermissionsResponse,
  UpdateRolePermissionsResponse,
  RoleInfo,
  PermissionInfo,
  PermissionGroup,
}
