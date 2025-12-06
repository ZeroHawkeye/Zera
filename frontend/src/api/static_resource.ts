/**
 * 静态资源上传 API
 * 处理 Logo 等静态资源的上传和删除
 */

import { config } from '@/config'

/**
 * 获取认证头
 */
function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  const token = localStorage.getItem('access_token')
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  return headers
}

/** 上传响应类型 */
export interface UploadLogoResponse {
  success: boolean
  url?: string
  filename?: string
  size?: number
  error?: string
}

/** 删除响应类型 */
export interface DeleteLogoResponse {
  success: boolean
  error?: string
}

/** API 基础地址 */
const API_BASE = config.apiBaseUrl

/**
 * 静态资源 API
 */
export const staticResourceApi = {
  /**
   * 上传 Logo
   * @param file 图片文件
   */
  async uploadLogo(file: File): Promise<UploadLogoResponse> {
    const formData = new FormData()
    formData.append('file', file)

    const headers = getAuthHeaders()
    // 移除 Content-Type，让浏览器自动设置 multipart/form-data 边界
    delete headers['Content-Type']

    const response = await fetch(`${API_BASE}/api/upload/logo`, {
      method: 'POST',
      headers,
      body: formData,
    })

    const data = await response.json() as UploadLogoResponse

    if (!response.ok) {
      throw new Error(data.error || '上传失败')
    }

    return data
  },

  /**
   * 删除 Logo
   */
  async deleteLogo(): Promise<DeleteLogoResponse> {
    const headers = getAuthHeaders()

    const response = await fetch(`${API_BASE}/api/upload/logo`, {
      method: 'DELETE',
      headers,
    })

    const data = await response.json() as DeleteLogoResponse

    if (!response.ok) {
      throw new Error(data.error || '删除失败')
    }

    return data
  },

  /**
   * 获取 Logo URL
   * @param path 相对路径
   */
  getLogoUrl(path: string): string {
    if (!path) return ''
    // 如果已经是完整 URL，直接返回
    if (path.startsWith('http://') || path.startsWith('https://')) {
      return path
    }
    // 如果已经以 / 开头，直接拼接
    if (path.startsWith('/')) {
      return `${API_BASE}${path}`
    }
    // 否则添加前缀
    return `${API_BASE}/uploads/static/${path}`
  },
}
