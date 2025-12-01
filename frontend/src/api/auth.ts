/**
 * 认证服务 API
 * 对接 proto/base/login.proto 定义的 AuthService
 */

import { create } from '@bufbuild/protobuf'
import { createClient } from '@connectrpc/connect'
import { transport } from './client'
import {
  AuthService,
  LoginRequestSchema,
  LogoutRequestSchema,
  RefreshTokenRequestSchema,
  GetCurrentUserRequestSchema,
  RegisterRequestSchema,
  type LoginResponse,
  type LogoutResponse,
  type RefreshTokenResponse,
  type GetCurrentUserResponse,
  type RegisterResponse,
  type UserInfo,
} from '@/gen/base/login_pb'

// 创建认证服务客户端
const authClient = createClient(AuthService, transport)

// Token 存储键
const ACCESS_TOKEN_KEY = 'access_token'
const REFRESH_TOKEN_KEY = 'refresh_token'
const USER_INFO_KEY = 'user_info'

/**
 * 登录参数
 */
export interface LoginParams {
  username: string
  password: string
  rememberMe?: boolean
}

/**
 * 注册参数
 */
export interface RegisterParams {
  username: string
  password: string
  confirmPassword: string
  email: string
  nickname?: string
}

/**
 * 认证服务 API
 */
export const authApi = {
  /**
   * 用户登录
   */
  async login(params: LoginParams): Promise<LoginResponse> {
    const request = create(LoginRequestSchema, {
      username: params.username,
      password: params.password,
    })

    const response = await authClient.login(request)

    // 存储 token
    localStorage.setItem(ACCESS_TOKEN_KEY, response.accessToken)
    if (params.rememberMe) {
      localStorage.setItem(REFRESH_TOKEN_KEY, response.refreshToken)
    } else {
      sessionStorage.setItem(REFRESH_TOKEN_KEY, response.refreshToken)
    }

    // 存储用户信息
    if (response.user) {
      localStorage.setItem(USER_INFO_KEY, JSON.stringify(response.user))
    }

    return response
  },

  /**
   * 用户登出
   */
  async logout(): Promise<LogoutResponse> {
    const accessToken = localStorage.getItem(ACCESS_TOKEN_KEY) || ''
    const request = create(LogoutRequestSchema, {
      accessToken,
    })

    try {
      const response = await authClient.logout(request)
      return response
    } finally {
      // 无论成功失败都清除本地存储
      authApi.clearTokens()
    }
  },

  /**
   * 刷新令牌
   */
  async refreshToken(): Promise<RefreshTokenResponse> {
    const refreshToken =
      localStorage.getItem(REFRESH_TOKEN_KEY) ||
      sessionStorage.getItem(REFRESH_TOKEN_KEY) ||
      ''

    const request = create(RefreshTokenRequestSchema, {
      refreshToken,
    })

    const response = await authClient.refreshToken(request)

    // 更新存储的 token
    localStorage.setItem(ACCESS_TOKEN_KEY, response.accessToken)
    const storage = localStorage.getItem(REFRESH_TOKEN_KEY)
      ? localStorage
      : sessionStorage
    storage.setItem(REFRESH_TOKEN_KEY, response.refreshToken)

    return response
  },

  /**
   * 获取当前用户信息
   */
  async getCurrentUser(): Promise<GetCurrentUserResponse> {
    const request = create(GetCurrentUserRequestSchema, {})
    const response = await authClient.getCurrentUser(request)

    // 更新本地存储的用户信息
    if (response.user) {
      localStorage.setItem(USER_INFO_KEY, JSON.stringify(response.user))
    }

    return response
  },

  /**
   * 用户注册
   */
  async register(params: RegisterParams): Promise<RegisterResponse> {
    const request = create(RegisterRequestSchema, {
      username: params.username,
      password: params.password,
      confirmPassword: params.confirmPassword,
      email: params.email,
      nickname: params.nickname || '',
    })

    return await authClient.register(request)
  },

  /**
   * 获取本地存储的用户信息
   */
  getStoredUser(): UserInfo | null {
    const userStr = localStorage.getItem(USER_INFO_KEY)
    if (!userStr) return null
    try {
      return JSON.parse(userStr) as UserInfo
    } catch {
      return null
    }
  },

  /**
   * 获取访问令牌
   */
  getAccessToken(): string | null {
    return localStorage.getItem(ACCESS_TOKEN_KEY)
  },

  /**
   * 检查是否已登录
   */
  isAuthenticated(): boolean {
    return !!localStorage.getItem(ACCESS_TOKEN_KEY)
  },

  /**
   * 清除所有 token 和用户信息
   */
  clearTokens(): void {
    localStorage.removeItem(ACCESS_TOKEN_KEY)
    localStorage.removeItem(REFRESH_TOKEN_KEY)
    localStorage.removeItem(USER_INFO_KEY)
    sessionStorage.removeItem(REFRESH_TOKEN_KEY)
  },
}

export type { LoginResponse, LogoutResponse, RefreshTokenResponse, GetCurrentUserResponse, RegisterResponse, UserInfo }
