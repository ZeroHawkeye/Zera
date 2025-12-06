/**
 * Logo 上传组件
 * 支持上传、预览、删除自定义 Logo
 */

import { useState, useEffect } from 'react'
import { Upload, Button, message, Modal, theme, Spin, Typography } from 'antd'
import { Upload as UploadIcon, Trash2, Image, AlertCircle } from 'lucide-react'
import type { UploadProps, RcFile } from 'antd/es/upload'
import { useMutation } from '@tanstack/react-query'
import { staticResourceApi } from '@/api/static_resource'
import { config } from '@/config'

const { Text } = Typography

interface LogoUploadProps {
  /** 当前 Logo URL */
  value?: string
  /** Logo 类型: default | custom */
  logoType?: string
  /** 值变化回调 */
  onChange?: (url: string, type: string) => void
  /** 是否禁用 */
  disabled?: boolean
}

/** 支持的图片类型 */
const ACCEPT_TYPES = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp']
const ACCEPT_STRING = '.png,.jpg,.jpeg,.svg,.webp'

/** 最大文件大小 (2MB) */
const MAX_SIZE = 2 * 1024 * 1024

/** 推荐尺寸 */
const RECOMMENDED_SIZE = '200 x 60 像素'

/**
 * Logo 上传组件
 */
export function LogoUpload({ value, logoType = 'default', onChange, disabled }: LogoUploadProps) {
  const { token } = theme.useToken()
  const [previewUrl, setPreviewUrl] = useState<string>('')
  const [uploading, setUploading] = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)

  // 获取完整的 Logo URL
  const getFullUrl = (url: string): string => {
    if (!url) return ''
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url
    }
    return `${config.apiBaseUrl}${url}`
  }

  useEffect(() => {
    if (value) {
      setPreviewUrl(getFullUrl(value))
    } else {
      setPreviewUrl('')
    }
  }, [value])

  // 上传 Logo
  const uploadMutation = useMutation({
    mutationFn: (file: File) => staticResourceApi.uploadLogo(file),
    onSuccess: (data) => {
      if (data.success && data.url) {
        message.success('Logo 上传成功')
        setPreviewUrl(getFullUrl(data.url))
        onChange?.(data.url, 'custom')
      }
    },
    onError: (error: Error) => {
      message.error(error.message || '上传失败')
    },
  })

  // 删除 Logo
  const deleteMutation = useMutation({
    mutationFn: () => staticResourceApi.deleteLogo(),
    onSuccess: () => {
      message.success('Logo 已恢复为默认')
      setPreviewUrl('')
      onChange?.('', 'default')
      setDeleteModalOpen(false)
    },
    onError: (error: Error) => {
      message.error(error.message || '删除失败')
    },
  })

  // 上传前验证
  const beforeUpload = (file: RcFile): boolean => {
    // 检查文件类型
    if (!ACCEPT_TYPES.includes(file.type)) {
      message.error('仅支持 PNG、JPG、SVG、WebP 格式')
      return false
    }

    // 检查文件大小
    if (file.size > MAX_SIZE) {
      message.error('图片大小不能超过 2MB')
      return false
    }

    return true
  }

  // 自定义上传
  const customUpload: UploadProps['customRequest'] = async (options) => {
    const { file, onSuccess, onError } = options
    setUploading(true)

    try {
      const result = await uploadMutation.mutateAsync(file as File)
      onSuccess?.(result)
    } catch (error) {
      onError?.(error as Error)
    } finally {
      setUploading(false)
    }
  }

  // 处理删除确认
  const handleDeleteConfirm = () => {
    deleteMutation.mutate()
  }

  const hasCustomLogo = logoType === 'custom' && previewUrl

  return (
    <div className="space-y-4">
      {/* Logo 预览区域 */}
      <div
        className="relative rounded-lg border-2 border-dashed p-6 transition-colors"
        style={{
          borderColor: token.colorBorder,
          backgroundColor: token.colorBgLayout,
        }}
      >
        <div className="flex flex-col items-center justify-center gap-4 sm:flex-row sm:justify-start">
          {/* 预览图 */}
          <div
            className="flex h-20 w-48 items-center justify-center rounded-lg overflow-hidden"
            style={{
              backgroundColor: token.colorBgContainer,
              border: `1px solid ${token.colorBorderSecondary}`,
            }}
          >
            {uploading ? (
              <Spin />
            ) : previewUrl ? (
              <img
                src={previewUrl}
                alt="Logo 预览"
                className="max-h-full max-w-full object-contain"
                onError={() => setPreviewUrl('')}
              />
            ) : (
              <div className="flex flex-col items-center gap-1 text-center">
                <Image
                  className="opacity-40"
                  style={{ color: token.colorTextSecondary }}
                  size={24}
                />
                <Text type="secondary" className="text-xs">
                  默认 Logo
                </Text>
              </div>
            )}
          </div>

          {/* 操作按钮 */}
          <div className="flex flex-col gap-2">
            <Upload
              accept={ACCEPT_STRING}
              showUploadList={false}
              beforeUpload={beforeUpload}
              customRequest={customUpload}
              disabled={disabled || uploading}
            >
              <Button
                icon={<UploadIcon className="h-4 w-4" />}
                loading={uploading}
                disabled={disabled}
              >
                {hasCustomLogo ? '更换 Logo' : '上传 Logo'}
              </Button>
            </Upload>

            {hasCustomLogo && (
              <Button
                danger
                icon={<Trash2 className="h-4 w-4" />}
                onClick={() => setDeleteModalOpen(true)}
                disabled={disabled || deleteMutation.isPending}
              >
                恢复默认
              </Button>
            )}
          </div>
        </div>

        {/* 提示信息 */}
        <div
          className="mt-4 flex items-start gap-2 rounded-md p-3"
          style={{ backgroundColor: token.colorInfoBg }}
        >
          <AlertCircle
            className="mt-0.5 h-4 w-4 flex-shrink-0"
            style={{ color: token.colorInfo }}
          />
          <div className="text-sm" style={{ color: token.colorTextSecondary }}>
            <p className="mb-1">
              支持 PNG、JPG、SVG、WebP 格式，文件大小不超过 2MB
            </p>
            <p className="mb-0">
              推荐尺寸：{RECOMMENDED_SIZE}，系统会自动适配显示
            </p>
          </div>
        </div>
      </div>

      {/* 删除确认弹窗 */}
      <Modal
        title="确认恢复默认 Logo"
        open={deleteModalOpen}
        onOk={handleDeleteConfirm}
        onCancel={() => setDeleteModalOpen(false)}
        okText="确认"
        cancelText="取消"
        confirmLoading={deleteMutation.isPending}
        okButtonProps={{ danger: true }}
      >
        <p>确定要删除自定义 Logo 并恢复为默认 Logo 吗？此操作不可撤销。</p>
      </Modal>
    </div>
  )
}

export default LogoUpload
