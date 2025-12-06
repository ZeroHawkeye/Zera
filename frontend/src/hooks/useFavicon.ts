/**
 * 动态 Favicon Hook
 * 用于在运行时动态更新网站图标
 * 支持从后台设置获取自定义 favicon
 */

import { useEffect, useCallback } from 'react'
import { useSiteStore } from '@/stores'
import { config } from '@/config'

/** 默认 Favicon - 使用 Sparkles 图标样式 */
const DEFAULT_FAVICON_SVG = `
<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="32" height="32" rx="8" fill="#6366f1"/>
  <path d="M16 6L17.545 12.455L24 14L17.545 15.545L16 22L14.455 15.545L8 14L14.455 12.455L16 6Z" fill="white"/>
  <path d="M22 16L22.727 18.273L25 19L22.727 19.727L22 22L21.273 19.727L19 19L21.273 18.273L22 16Z" fill="white" opacity="0.8"/>
  <path d="M10 18L10.545 19.455L12 20L10.545 20.545L10 22L9.455 20.545L8 20L9.455 19.455L10 18Z" fill="white" opacity="0.6"/>
</svg>
`

/**
 * 将 SVG 字符串转换为 Data URL
 */
function svgToDataUrl(svg: string): string {
  const encoded = encodeURIComponent(svg.trim())
  return `data:image/svg+xml,${encoded}`
}

/**
 * 更新页面的 favicon
 */
function updateFavicon(url: string): void {
  // 获取或创建 link 元素
  let link = document.querySelector<HTMLLinkElement>("link[rel*='icon']")

  if (!link) {
    link = document.createElement('link')
    link.rel = 'icon'
    document.head.appendChild(link)
  }

  link.type = url.startsWith('data:image/svg') ? 'image/svg+xml' : 'image/x-icon'
  link.href = url
}

/**
 * 动态 Favicon Hook
 * 自动根据站点设置更新 favicon
 * 
 * @example
 * ```tsx
 * function App() {
 *   useFavicon()
 *   return <div>...</div>
 * }
 * ```
 */
export function useFavicon(): void {
  // 优先使用 siteFavicon，如果没有则使用 siteLogo
  const faviconUrl = useSiteStore((state) => state.siteFavicon)
  const logoUrl = useSiteStore((state) => state.siteLogo)

  useEffect(() => {
    const iconUrl = faviconUrl || logoUrl
    if (iconUrl) {
      // 使用自定义 favicon/logo
      // 如果是相对路径，需要添加 API 基础地址
      const fullUrl = iconUrl.startsWith('http')
        ? iconUrl
        : `${config.apiBaseUrl}${iconUrl}`
      updateFavicon(fullUrl)
    } else {
      // 使用默认 SVG favicon
      updateFavicon(svgToDataUrl(DEFAULT_FAVICON_SVG))
    }
  }, [faviconUrl, logoUrl])
}

/**
 * 获取 Favicon 管理函数
 * 提供手动更新 favicon 的能力
 * 
 * @example
 * ```tsx
 * function SettingsPage() {
 *   const { setFavicon, resetFavicon } = useFaviconActions()
 *   
 *   return (
 *     <button onClick={() => setFavicon('/custom-icon.png')}>
 *       设置自定义图标
 *     </button>
 *   )
 * }
 * ```
 */
export function useFaviconActions() {
  const setFavicon = useCallback((url: string) => {
    updateFavicon(url)
  }, [])

  const resetFavicon = useCallback(() => {
    updateFavicon(svgToDataUrl(DEFAULT_FAVICON_SVG))
  }, [])

  return {
    /** 设置自定义 favicon URL */
    setFavicon,
    /** 重置为默认 favicon */
    resetFavicon,
  }
}

export default useFavicon
