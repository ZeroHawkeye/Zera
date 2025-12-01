/**
 * 应用配置
 * 根据构建环境自动选择配置
 */

interface AppConfig {
  /** API 基础地址，生产环境为空（同源） */
  apiBaseUrl: string
  /** 是否使用二进制格式 */
  useBinaryFormat: boolean
  /** 是否启用调试模式 */
  debug: boolean
}

const devConfig: AppConfig = {
  apiBaseUrl: 'http://localhost:9800',
  useBinaryFormat: false,
  debug: true,
}

const prodConfig: AppConfig = {
  apiBaseUrl: '', // 生产环境与后端同源
  useBinaryFormat: true,
  debug: false,
}

export const config: AppConfig = import.meta.env.PROD ? prodConfig : devConfig

// 菜单配置导出
export * from './menu'

// 权限配置导出
export * from './permissions'
