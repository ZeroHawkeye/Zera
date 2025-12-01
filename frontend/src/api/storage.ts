/**
 * 存储服务客户端
 * 提供与 RustFS 对象存储的交互功能
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  HeadObjectCommand,
  CreateBucketCommand,
  HeadBucketCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { storageConfig, type StorageConfig } from '@/config/storage'

/**
 * 对象信息
 */
export interface ObjectInfo {
  key: string
  size: number
  lastModified: Date
  etag?: string
}

/**
 * 上传选项
 */
export interface UploadOptions {
  /** 内容类型 */
  contentType?: string
  /** 自定义元数据 */
  metadata?: Record<string, string>
  /** 进度回调 */
  onProgress?: (progress: number) => void
}

/**
 * 存储服务类
 * 封装 S3 兼容 API 操作
 */
class StorageService {
  private client: S3Client
  private config: StorageConfig
  private initialized = false

  constructor() {
    this.config = storageConfig
    this.client = this.createClient()
  }

  /**
   * 创建 S3 客户端
   */
  private createClient(): S3Client {
    return new S3Client({
      endpoint: this.config.endpoint,
      region: this.config.region,
      credentials: {
        accessKeyId: this.config.accessKeyId,
        secretAccessKey: this.config.secretAccessKey,
      },
      forcePathStyle: true, // 使用路径样式（必需）
    })
  }

  /**
   * 初始化存储服务（确保桶存在）
   */
  async init(): Promise<void> {
    if (this.initialized) {
      return
    }

    try {
      // 检查桶是否存在
      await this.client.send(
        new HeadBucketCommand({ Bucket: this.config.bucket })
      )
      this.initialized = true
    } catch (error) {
      // 桶不存在，尝试创建
      if ((error as { name?: string }).name === 'NotFound') {
        await this.client.send(
          new CreateBucketCommand({ Bucket: this.config.bucket })
        )
        this.initialized = true
      } else {
        throw error
      }
    }
  }

  /**
   * 获取默认存储桶名称
   */
  getBucket(): string {
    return this.config.bucket
  }

  /**
   * 上传文件
   * @param key 对象键
   * @param file 文件对象
   * @param options 上传选项
   */
  async uploadFile(
    key: string,
    file: File | Blob,
    options?: UploadOptions
  ): Promise<string> {
    const buffer = await file.arrayBuffer()

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
        Body: new Uint8Array(buffer),
        ContentType: options?.contentType || file.type || 'application/octet-stream',
        Metadata: options?.metadata,
      })
    )

    return this.getObjectUrl(key)
  }

  /**
   * 上传数据
   * @param key 对象键
   * @param data 数据
   * @param contentType 内容类型
   */
  async uploadData(
    key: string,
    data: Uint8Array | string,
    contentType?: string
  ): Promise<string> {
    const body = typeof data === 'string' ? new TextEncoder().encode(data) : data

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
        Body: body,
        ContentType: contentType || 'application/octet-stream',
      })
    )

    return this.getObjectUrl(key)
  }

  /**
   * 下载文件
   * @param key 对象键
   */
  async downloadFile(key: string): Promise<Blob> {
    const response = await this.client.send(
      new GetObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
      })
    )

    if (!response.Body) {
      throw new Error(`Failed to download object: ${key}`)
    }

    // 将响应体转换为 Blob
    const bytes = await response.Body.transformToByteArray()
    return new Blob([bytes], { type: response.ContentType })
  }

  /**
   * 下载文件并触发浏览器下载
   * @param key 对象键
   * @param filename 下载文件名
   */
  async downloadAndSave(key: string, filename?: string): Promise<void> {
    const blob = await this.downloadFile(key)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename || key.split('/').pop() || 'download'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  /**
   * 删除文件
   * @param key 对象键
   */
  async deleteFile(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
      })
    )
  }

  /**
   * 批量删除文件
   * @param keys 对象键列表
   */
  async deleteFiles(keys: string[]): Promise<void> {
    await Promise.all(keys.map((key) => this.deleteFile(key)))
  }

  /**
   * 获取文件信息
   * @param key 对象键
   */
  async getFileInfo(key: string): Promise<ObjectInfo | null> {
    try {
      const response = await this.client.send(
        new HeadObjectCommand({
          Bucket: this.config.bucket,
          Key: key,
        })
      )

      return {
        key,
        size: response.ContentLength || 0,
        lastModified: response.LastModified || new Date(),
        etag: response.ETag,
      }
    } catch {
      return null
    }
  }

  /**
   * 检查文件是否存在
   * @param key 对象键
   */
  async exists(key: string): Promise<boolean> {
    const info = await this.getFileInfo(key)
    return info !== null
  }

  /**
   * 列出文件
   * @param prefix 前缀
   * @param maxKeys 最大数量
   */
  async listFiles(prefix?: string, maxKeys?: number): Promise<ObjectInfo[]> {
    const response = await this.client.send(
      new ListObjectsV2Command({
        Bucket: this.config.bucket,
        Prefix: prefix,
        MaxKeys: maxKeys,
      })
    )

    return (
      response.Contents?.map((obj) => ({
        key: obj.Key || '',
        size: obj.Size || 0,
        lastModified: obj.LastModified || new Date(),
        etag: obj.ETag,
      })) || []
    )
  }

  /**
   * 获取对象 URL
   * @param key 对象键
   */
  getObjectUrl(key: string): string {
    return `${this.config.endpoint}/${this.config.bucket}/${key}`
  }

  /**
   * 获取预签名 URL（用于临时访问私有对象）
   * @param key 对象键
   * @param expiresIn 过期时间（秒）
   */
  async getPresignedUrl(key: string, expiresIn = 3600): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.config.bucket,
      Key: key,
    })

    return getSignedUrl(this.client, command, { expiresIn })
  }

  /**
   * 获取上传预签名 URL
   * @param key 对象键
   * @param contentType 内容类型
   * @param expiresIn 过期时间（秒）
   */
  async getUploadPresignedUrl(
    key: string,
    contentType?: string,
    expiresIn = 3600
  ): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.config.bucket,
      Key: key,
      ContentType: contentType,
    })

    return getSignedUrl(this.client, command, { expiresIn })
  }

  /**
   * 生成唯一的对象键
   * @param filename 原始文件名
   * @param prefix 前缀目录
   */
  generateKey(filename: string, prefix?: string): string {
    const timestamp = Date.now()
    const random = Math.random().toString(36).substring(2, 8)
    const ext = filename.includes('.') ? filename.split('.').pop() : ''
    const key = ext ? `${timestamp}-${random}.${ext}` : `${timestamp}-${random}`

    return prefix ? `${prefix}/${key}` : key
  }
}

// 导出单例实例
export const storage = new StorageService()

// 导出类型和类
export type { StorageConfig }
export { StorageService }
