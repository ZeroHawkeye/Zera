/**
 * 站点设置状态管理
 * 管理公开的站点设置，包括站点名称、描述、Logo 等
 */

import { create } from 'zustand'
import { systemSettingApi } from '@/api/system_setting'

/**
 * 站点设置状态接口
 */
export interface SiteState {
  /** 站点名称 */
  siteName: string
  /** 站点描述 */
  siteDescription: string
  /** 站点 Logo URL - TODO: 后续从后台设置获取 */
  siteLogo: string
  /** 站点 Favicon URL - TODO: 后续从后台设置获取 */
  siteFavicon: string
  /** 是否启用注册 */
  enableRegistration: boolean
  /** 是否处于维护模式 */
  maintenanceMode: boolean
  /** 是否正在加载 */
  isLoading: boolean
  /** 是否已初始化 */
  isInitialized: boolean

  /** 初始化站点设置（获取公开设置） */
  initialize: () => Promise<void>
  /** 刷新站点设置 */
  refresh: () => Promise<void>
  /** 更新文档标题 */
  updateDocumentTitle: (pageTitle?: string) => void
  /** 设置站点 Logo - TODO: 后续接入后台设置 */
  setSiteLogo: (url: string) => void
  /** 设置站点 Favicon - TODO: 后续接入后台设置 */
  setSiteFavicon: (url: string) => void
}

/** 默认站点名称 */
const DEFAULT_SITE_NAME = 'Zera'

/** 默认站点描述 */
const DEFAULT_SITE_DESCRIPTION = ''

/**
 * 站点设置 Store
 */
export const useSiteStore = create<SiteState>()((set, get) => ({
  siteName: DEFAULT_SITE_NAME,
  siteDescription: DEFAULT_SITE_DESCRIPTION,
  siteLogo: '',
  siteFavicon: '',
  enableRegistration: false,
  maintenanceMode: false,
  isLoading: false,
  isInitialized: false,

  initialize: async () => {
    const { isInitialized, isLoading } = get()
    
    // 避免重复初始化
    if (isInitialized || isLoading) {
      return
    }

    set({ isLoading: true })

    try {
      const response = await systemSettingApi.getPublicSettings()
      
      const siteName = response.siteName || DEFAULT_SITE_NAME
      const siteDescription = response.siteDescription || DEFAULT_SITE_DESCRIPTION
      // TODO: 后续从响应中获取 logo 和 favicon
      // const siteLogo = response.siteLogo || ''
      // const siteFavicon = response.siteFavicon || ''

      set({
        siteName,
        siteDescription,
        // siteLogo,
        // siteFavicon,
        enableRegistration: response.enableRegistration,
        maintenanceMode: response.maintenanceMode,
        isLoading: false,
        isInitialized: true,
      })

      // 更新文档标题
      document.title = siteName

      // 更新 meta description
      const metaDescription = document.querySelector('meta[name="description"]')
      if (metaDescription) {
        metaDescription.setAttribute('content', siteDescription)
      } else if (siteDescription) {
        const meta = document.createElement('meta')
        meta.name = 'description'
        meta.content = siteDescription
        document.head.appendChild(meta)
      }
    } catch {
      // 获取失败时使用默认值
      set({
        isLoading: false,
        isInitialized: true,
      })
    }
  },

  refresh: async () => {
    set({ isLoading: true })

    try {
      const response = await systemSettingApi.getPublicSettings()
      
      const siteName = response.siteName || DEFAULT_SITE_NAME
      const siteDescription = response.siteDescription || DEFAULT_SITE_DESCRIPTION

      set({
        siteName,
        siteDescription,
        enableRegistration: response.enableRegistration,
        maintenanceMode: response.maintenanceMode,
        isLoading: false,
      })

      // 更新文档标题
      document.title = siteName

      // 更新 meta description
      const metaDescription = document.querySelector('meta[name="description"]')
      if (metaDescription) {
        metaDescription.setAttribute('content', siteDescription)
      } else if (siteDescription) {
        const meta = document.createElement('meta')
        meta.name = 'description'
        meta.content = siteDescription
        document.head.appendChild(meta)
      }
    } catch {
      set({ isLoading: false })
    }
  },

  updateDocumentTitle: (pageTitle?: string) => {
    const { siteName } = get()
    if (pageTitle) {
      document.title = `${pageTitle} - ${siteName}`
    } else {
      document.title = siteName
    }
  },

  setSiteLogo: (url: string) => {
    set({ siteLogo: url })
  },

  setSiteFavicon: (url: string) => {
    set({ siteFavicon: url })
  },
}))
