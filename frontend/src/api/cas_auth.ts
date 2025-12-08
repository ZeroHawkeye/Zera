/**
 * CAS 认证服务 API
 * 对接 proto/base/cas_auth.proto 定义的 CASAuthService
 */

import { create } from '@bufbuild/protobuf'
import { createClient } from '@connectrpc/connect'
import { transport } from './client'
import {
  CASAuthService,
  GetCASLoginURLRequestSchema,
  CASCallbackRequestSchema,
  CASLogoutRequestSchema,
  GetPublicCASSettingsRequestSchema,
  GetCASConfigRequestSchema,
  UpdateCASConfigRequestSchema,
  TestCASConnectionRequestSchema,
  CASConfigSchema,
  type GetCASLoginURLResponse,
  type CASCallbackResponse,
  type CASLogoutResponse,
  type GetPublicCASSettingsResponse,
  type GetCASConfigResponse,
  type UpdateCASConfigResponse,
  type TestCASConnectionResponse,
  type CASConfig,
} from '@/gen/base/cas_auth_pb'

// 创建 CAS 认证服务客户端
const casAuthClient = createClient(CASAuthService, transport)

// Token 存储键 (复用 auth.ts 中的键)
const ACCESS_TOKEN_KEY = 'access_token'
const REFRESH_TOKEN_KEY = 'refresh_token'
const USER_INFO_KEY = 'user_info'

/**
 * CAS 配置参数
 */
export interface CASConfigParams {
  enabled: boolean
  serverUrl: string
  organization: string
  application: string
  serviceUrl: string
  defaultRole: string
  autoCreateUser: boolean
}

/**
 * CAS 认证服务 API
 */
export const casAuthApi = {
  /**
   * 获取 CAS 登录 URL
   */
  async getLoginURL(redirectUrl?: string): Promise<GetCASLoginURLResponse> {
    const request = create(GetCASLoginURLRequestSchema, {
      redirectUrl: redirectUrl || '',
    })

    return await casAuthClient.getCASLoginURL(request)
  },

  /**
   * CAS 回调处理
   */
  async callback(ticket: string, service: string): Promise<CASCallbackResponse> {
    const request = create(CASCallbackRequestSchema, {
      ticket,
      service,
    })

    const response = await casAuthClient.cASCallback(request)

    // 存储 token
    localStorage.setItem(ACCESS_TOKEN_KEY, response.accessToken)
    localStorage.setItem(REFRESH_TOKEN_KEY, response.refreshToken)

    // 存储用户信息
    if (response.user) {
      localStorage.setItem(USER_INFO_KEY, JSON.stringify(response.user))
    }

    return response
  },

  /**
   * CAS 登出
   */
  async logout(): Promise<CASLogoutResponse> {
    const accessToken = localStorage.getItem(ACCESS_TOKEN_KEY) || ''
    const request = create(CASLogoutRequestSchema, {
      accessToken,
    })

    const response = await casAuthClient.cASLogout(request)
    return response
  },

  /**
   * 获取公开的 CAS 设置
   */
  async getPublicSettings(): Promise<GetPublicCASSettingsResponse> {
    const request = create(GetPublicCASSettingsRequestSchema, {})
    return await casAuthClient.getPublicCASSettings(request)
  },

  /**
   * 获取 CAS 配置 (管理员)
   */
  async getConfig(): Promise<GetCASConfigResponse> {
    const request = create(GetCASConfigRequestSchema, {})
    return await casAuthClient.getCASConfig(request)
  },

  /**
   * 更新 CAS 配置 (管理员)
   */
  async updateConfig(params: CASConfigParams): Promise<UpdateCASConfigResponse> {
    const config = create(CASConfigSchema, {
      enabled: params.enabled,
      serverUrl: params.serverUrl,
      organization: params.organization,
      application: params.application,
      serviceUrl: params.serviceUrl,
      defaultRole: params.defaultRole,
      autoCreateUser: params.autoCreateUser,
    })

    const request = create(UpdateCASConfigRequestSchema, {
      config,
    })

    return await casAuthClient.updateCASConfig(request)
  },

  /**
   * 测试 CAS 连接 (管理员)
   */
  async testConnection(params?: CASConfigParams): Promise<TestCASConnectionResponse> {
    let config: CASConfig | undefined
    if (params) {
      config = create(CASConfigSchema, {
        enabled: params.enabled,
        serverUrl: params.serverUrl,
        organization: params.organization,
        application: params.application,
        serviceUrl: params.serviceUrl,
        defaultRole: params.defaultRole,
        autoCreateUser: params.autoCreateUser,
      })
    }

    const request = create(TestCASConnectionRequestSchema, {
      config,
    })

    return await casAuthClient.testCASConnection(request)
  },
}

// ============================================
// CAS 登录 URL 辅助函数（用于路由守卫）
// ============================================

/** CAS 启用状态缓存 */
let cachedCasEnabled: boolean | null = null

/**
 * 清除 CAS 状态缓存
 * 用于配置更新后强制重新获取
 */
export function clearCasCache() {
  cachedCasEnabled = null
}

/**
 * 获取 CAS 登录 URL
 * 用于路由守卫中未登录时直接跳转 Casdoor
 * @param redirectPath 登录成功后重定向的路径
 * @returns CAS 登录 URL，如果 CAS 未启用则返回 null
 */
export async function getCasLoginUrl(redirectPath: string): Promise<string | null> {
  // 如果已缓存且 CAS 未启用，直接返回 null
  if (cachedCasEnabled === false) {
    return null
  }

  try {
    // 获取 CAS 公开设置
    const settings = await casAuthApi.getPublicSettings()
    cachedCasEnabled = settings.casEnabled

    if (!settings.casEnabled) {
      return null
    }

    // 获取 CAS 登录 URL
    const response = await casAuthApi.getLoginURL(redirectPath)
    return response.loginUrl || null
  } catch {
    // 发生错误时返回 null，回退到普通登录
    return null
  }
}

/**
 * 获取 CAS 退出登录后的重定向 URL
 * 用于退出登录后跳转到 Casdoor 登录页面
 * @param redirectPath 重新登录后重定向的路径，默认为 /admin
 * @returns CAS 登录 URL，如果 CAS 未启用则返回 null
 */
export async function getCasLogoutRedirectUrl(redirectPath: string = '/admin'): Promise<string | null> {
  // 如果已缓存且 CAS 未启用，直接返回 null
  if (cachedCasEnabled === false) {
    return null
  }

  try {
    // 获取 CAS 公开设置
    const settings = await casAuthApi.getPublicSettings()
    cachedCasEnabled = settings.casEnabled

    if (!settings.casEnabled) {
      return null
    }

    // 获取 CAS 登录 URL
    const response = await casAuthApi.getLoginURL(redirectPath)
    return response.loginUrl || null
  } catch {
    // 发生错误时返回 null，回退到普通登录页面
    return null
  }
}

export type {
  GetCASLoginURLResponse,
  CASCallbackResponse,
  CASLogoutResponse,
  GetPublicCASSettingsResponse,
  GetCASConfigResponse,
  UpdateCASConfigResponse,
  TestCASConnectionResponse,
  CASConfig,
}
