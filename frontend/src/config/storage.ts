/**
 * 存储服务配置
 * 用于连接 RustFS 对象存储（S3 兼容协议）
 */

export interface StorageConfig {
  /** 存储服务端点 */
  endpoint: string
  /** 访问密钥 */
  accessKeyId: string
  /** 密钥 */
  secretAccessKey: string
  /** 默认存储桶 */
  bucket: string
  /** 区域 */
  region: string
}

const devStorageConfig: StorageConfig = {
  endpoint: 'http://localhost:9000',
  accessKeyId: 'zera',
  secretAccessKey: 'zera',
  bucket: 'zera',
  region: 'us-east-1',
}

const prodStorageConfig: StorageConfig = {
  // 生产环境应从环境变量读取，这里提供默认值
  endpoint: import.meta.env.VITE_STORAGE_ENDPOINT || 'http://localhost:9000',
  accessKeyId: import.meta.env.VITE_STORAGE_ACCESS_KEY || 'zera',
  secretAccessKey: import.meta.env.VITE_STORAGE_SECRET_KEY || 'zera',
  bucket: import.meta.env.VITE_STORAGE_BUCKET || 'zera',
  region: import.meta.env.VITE_STORAGE_REGION || 'us-east-1',
}

export const storageConfig: StorageConfig = import.meta.env.PROD
  ? prodStorageConfig
  : devStorageConfig
