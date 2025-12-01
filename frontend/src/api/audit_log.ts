/**
 * 审计日志服务 API
 * 对接 proto/base/audit_log.proto 定义的 AuditLogService
 */

import { create } from '@bufbuild/protobuf'
import { createClient } from '@connectrpc/connect'
import { transport } from './client'
import {
  AuditLogService,
  ListAuditLogsRequestSchema,
  GetAuditLogRequestSchema,
  GetAuditLogStatsRequestSchema,
  ListAuditLogModulesRequestSchema,
  type ListAuditLogsResponse,
  type GetAuditLogResponse,
  type GetAuditLogStatsResponse,
  type ListAuditLogModulesResponse,
  type AuditLogEntry,
  LogLevel,
} from '@/gen/base/audit_log_pb'

// 创建审计日志服务客户端
const auditLogClient = createClient(AuditLogService, transport)

/**
 * 日志列表查询参数
 */
export interface ListAuditLogsParams {
  page?: number
  pageSize?: number
  level?: LogLevel
  module?: string
  action?: string
  username?: string
  ip?: string
  resource?: string
  startTime?: string
  endTime?: string
  keyword?: string
  sortBy?: string
  descending?: boolean
}

/**
 * 日志统计查询参数
 */
export interface GetAuditLogStatsParams {
  startTime?: string
  endTime?: string
}

/**
 * 审计日志服务 API
 */
export const auditLogApi = {
  /**
   * 获取日志列表
   */
  async listAuditLogs(params: ListAuditLogsParams = {}): Promise<ListAuditLogsResponse> {
    const request = create(ListAuditLogsRequestSchema, {
      page: params.page ?? 1,
      pageSize: params.pageSize ?? 20,
      level: params.level ?? LogLevel.UNSPECIFIED,
      module: params.module ?? '',
      action: params.action ?? '',
      username: params.username ?? '',
      ip: params.ip ?? '',
      resource: params.resource ?? '',
      startTime: params.startTime ?? '',
      endTime: params.endTime ?? '',
      keyword: params.keyword ?? '',
      sortBy: params.sortBy ?? '',
      descending: params.descending ?? true,
    })

    return await auditLogClient.listAuditLogs(request)
  },

  /**
   * 获取日志详情
   */
  async getAuditLog(id: string): Promise<GetAuditLogResponse> {
    const request = create(GetAuditLogRequestSchema, { id })
    return await auditLogClient.getAuditLog(request)
  },

  /**
   * 获取日志统计
   */
  async getAuditLogStats(params: GetAuditLogStatsParams = {}): Promise<GetAuditLogStatsResponse> {
    const request = create(GetAuditLogStatsRequestSchema, {
      startTime: params.startTime ?? '',
      endTime: params.endTime ?? '',
    })
    return await auditLogClient.getAuditLogStats(request)
  },

  /**
   * 获取可用模块列表
   */
  async listAuditLogModules(): Promise<ListAuditLogModulesResponse> {
    const request = create(ListAuditLogModulesRequestSchema, {})
    return await auditLogClient.listAuditLogModules(request)
  },
}

// 导出类型
export type {
  ListAuditLogsResponse,
  GetAuditLogResponse,
  GetAuditLogStatsResponse,
  ListAuditLogModulesResponse,
  AuditLogEntry,
}

export { LogLevel }

/**
 * 日志级别显示名称映射
 */
export const LogLevelNames: Record<LogLevel, string> = {
  [LogLevel.UNSPECIFIED]: '全部',
  [LogLevel.DEBUG]: 'DEBUG',
  [LogLevel.INFO]: 'INFO',
  [LogLevel.WARNING]: 'WARNING',
  [LogLevel.ERROR]: 'ERROR',
}

/**
 * 日志级别颜色映射
 */
export const LogLevelColors: Record<LogLevel, string> = {
  [LogLevel.UNSPECIFIED]: 'default',
  [LogLevel.DEBUG]: 'gray',
  [LogLevel.INFO]: 'blue',
  [LogLevel.WARNING]: 'orange',
  [LogLevel.ERROR]: 'red',
}
