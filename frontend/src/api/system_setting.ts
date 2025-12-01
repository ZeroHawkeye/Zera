/**
 * 系统设置服务 API
 * 对接 proto/base/system_setting.proto 定义的 SystemSettingService
 */

import { create } from '@bufbuild/protobuf'
import { createClient } from '@connectrpc/connect'
import { transport } from './client'
import {
  SystemSettingService,
  GetSystemSettingsRequestSchema,
  UpdateSystemSettingsRequestSchema,
  GetPublicSettingsRequestSchema,
  SystemSettingsSchema,
  GeneralSettingsSchema,
  FeatureSettingsSchema,
  SecuritySettingsSchema,
  type GetSystemSettingsResponse,
  type UpdateSystemSettingsResponse,
  type GetPublicSettingsResponse,
  type SystemSettings,
  type GeneralSettings,
  type FeatureSettings,
  type SecuritySettings,
} from '@/gen/base/system_setting_pb'

// 创建系统设置服务客户端
const systemSettingClient = createClient(SystemSettingService, transport)

/**
 * 更新设置参数
 */
export interface UpdateSettingsParams {
  general?: {
    siteName: string
    siteDescription: string
  }
  features?: {
    enableRegistration: boolean
    maintenanceMode: boolean
    defaultRegisterRole?: string
  }
  security?: {
    maxLoginAttempts: number
    lockoutDuration: number
    sessionTimeout: number
    passwordMinLength: number
    passwordRequireUppercase: boolean
    passwordRequireNumber: boolean
    passwordRequireSpecial: boolean
  }
}

/**
 * 系统设置服务 API
 */
export const systemSettingApi = {
  /**
   * 获取系统设置
   */
  async getSettings(): Promise<GetSystemSettingsResponse> {
    const request = create(GetSystemSettingsRequestSchema, {})
    return await systemSettingClient.getSystemSettings(request)
  },

  /**
   * 更新系统设置
   */
  async updateSettings(params: UpdateSettingsParams): Promise<UpdateSystemSettingsResponse> {
    const settings = create(SystemSettingsSchema, {})

    if (params.general) {
      settings.general = create(GeneralSettingsSchema, {
        siteName: params.general.siteName,
        siteDescription: params.general.siteDescription,
      })
    }

    if (params.features) {
      settings.features = create(FeatureSettingsSchema, {
        enableRegistration: params.features.enableRegistration,
        maintenanceMode: params.features.maintenanceMode,
        defaultRegisterRole: params.features.defaultRegisterRole || '',
      })
    }

    if (params.security) {
      settings.security = create(SecuritySettingsSchema, {
        maxLoginAttempts: params.security.maxLoginAttempts,
        lockoutDuration: params.security.lockoutDuration,
        sessionTimeout: params.security.sessionTimeout,
        passwordMinLength: params.security.passwordMinLength,
        passwordRequireUppercase: params.security.passwordRequireUppercase,
        passwordRequireNumber: params.security.passwordRequireNumber,
        passwordRequireSpecial: params.security.passwordRequireSpecial,
      })
    }

    const request = create(UpdateSystemSettingsRequestSchema, {
      settings,
    })

    return await systemSettingClient.updateSystemSettings(request)
  },

  /**
   * 获取公开设置（无需认证）
   */
  async getPublicSettings(): Promise<GetPublicSettingsResponse> {
    const request = create(GetPublicSettingsRequestSchema, {})
    return await systemSettingClient.getPublicSettings(request)
  },
}

export type {
  GetSystemSettingsResponse,
  UpdateSystemSettingsResponse,
  GetPublicSettingsResponse,
  SystemSettings,
  GeneralSettings,
  FeatureSettings,
  SecuritySettings,
}
