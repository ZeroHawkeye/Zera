/**
 * Connect RPC 客户端配置
 */

import { createConnectTransport } from '@connectrpc/connect-web'
import { config } from '@/config'

/**
 * 创建 Connect Transport
 * 使用 Connect 协议进行通信
 */
export const transport = createConnectTransport({
  baseUrl: config.apiBaseUrl,
  useBinaryFormat: config.useBinaryFormat,
  // 自定义拦截器，用于添加认证头
  interceptors: [
    (next) => async (req) => {
      const token = localStorage.getItem('access_token')
      if (token) {
        req.header.set('Authorization', `Bearer ${token}`)
      }
      return next(req)
    },
  ],
})
