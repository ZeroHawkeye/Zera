import { useState, useEffect, useMemo, useSyncExternalStore } from 'react'

/**
 * 断点配置（与 Tailwind CSS 保持一致）
 */
export const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
} as const

export type Breakpoint = keyof typeof BREAKPOINTS

/**
 * 响应式状态接口
 */
export interface ResponsiveState {
  /** 当前是否为移动端（< md） */
  isMobile: boolean
  /** 当前是否为平板（>= md && < lg） */
  isTablet: boolean
  /** 当前是否为桌面端（>= lg） */
  isDesktop: boolean
  /** 当前视口宽度 */
  width: number
  /** 当前视口高度 */
  height: number
  /** 当前激活的断点 */
  breakpoint: Breakpoint | 'xs'
}

/**
 * 获取当前视口宽度
 */
function getWindowWidth(): number {
  if (typeof window === 'undefined') return 0
  return window.innerWidth
}

/**
 * 获取当前视口高度
 */
function getWindowHeight(): number {
  if (typeof window === 'undefined') return 0
  return window.innerHeight
}

/**
 * 获取当前激活的断点
 */
function getBreakpoint(width: number): Breakpoint | 'xs' {
  if (width >= BREAKPOINTS['2xl']) return '2xl'
  if (width >= BREAKPOINTS.xl) return 'xl'
  if (width >= BREAKPOINTS.lg) return 'lg'
  if (width >= BREAKPOINTS.md) return 'md'
  if (width >= BREAKPOINTS.sm) return 'sm'
  return 'xs'
}

/**
 * 创建响应式状态的外部存储
 * 使用 useSyncExternalStore 确保服务端渲染兼容性
 */
const listeners = new Set<() => void>()
let cachedState: ResponsiveState | null = null

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  
  if (listeners.size === 1) {
    window.addEventListener('resize', notifyListeners)
  }
  
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) {
      window.removeEventListener('resize', notifyListeners)
    }
  }
}

function notifyListeners(): void {
  cachedState = null // 清除缓存，下次获取时重新计算
  listeners.forEach(listener => listener())
}

function getSnapshot(): ResponsiveState {
  if (cachedState) return cachedState
  
  const width = getWindowWidth()
  const height = getWindowHeight()
  const breakpoint = getBreakpoint(width)
  
  cachedState = {
    isMobile: width < BREAKPOINTS.md,
    isTablet: width >= BREAKPOINTS.md && width < BREAKPOINTS.lg,
    isDesktop: width >= BREAKPOINTS.lg,
    width,
    height,
    breakpoint,
  }
  
  return cachedState
}

function getServerSnapshot(): ResponsiveState {
  return {
    isMobile: false,
    isTablet: false,
    isDesktop: true,
    width: 1024,
    height: 768,
    breakpoint: 'lg',
  }
}

/**
 * 全局响应式 Hook
 * 
 * 提供统一的设备类型检测，所有页面应使用此 Hook 而非自行实现
 * 使用 useSyncExternalStore 确保最佳性能和服务端渲染兼容性
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { isMobile, isDesktop, breakpoint } = useResponsive()
 *   
 *   return isMobile ? <MobileView /> : <DesktopView />
 * }
 * ```
 */
export function useResponsive(): ResponsiveState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

/**
 * 简化的移动端检测 Hook
 * 
 * @param breakpoint - 判断为移动端的断点，默认为 'md' (768px)
 * @returns 是否为移动端
 * 
 * @example
 * ```tsx
 * const isMobile = useIsMobile()
 * const isSmallMobile = useIsMobile('sm') // 小于 640px
 * ```
 */
export function useIsMobile(breakpoint: Breakpoint = 'md'): boolean {
  const { width } = useResponsive()
  return width < BREAKPOINTS[breakpoint]
}

/**
 * 媒体查询 Hook
 * 
 * @param query - 媒体查询字符串
 * @returns 查询是否匹配
 * 
 * @example
 * ```tsx
 * const prefersDark = useMediaQuery('(prefers-color-scheme: dark)')
 * const isLandscape = useMediaQuery('(orientation: landscape)')
 * ```
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia(query).matches
  })

  useEffect(() => {
    const mediaQuery = window.matchMedia(query)
    
    const handler = (event: MediaQueryListEvent) => {
      setMatches(event.matches)
    }
    
    // 初始化
    setMatches(mediaQuery.matches)
    
    // 监听变化
    mediaQuery.addEventListener('change', handler)
    return () => mediaQuery.removeEventListener('change', handler)
  }, [query])

  return matches
}

/**
 * 根据断点返回不同值的 Hook
 * 
 * @param values - 不同断点对应的值
 * @returns 当前断点对应的值
 * 
 * @example
 * ```tsx
 * const columns = useBreakpointValue({ xs: 1, sm: 2, md: 3, lg: 4 })
 * const padding = useBreakpointValue({ xs: 16, md: 24, lg: 32 })
 * ```
 */
export function useBreakpointValue<T>(values: Partial<Record<Breakpoint | 'xs', T>>): T | undefined {
  const { breakpoint } = useResponsive()
  
  return useMemo(() => {
    // 从当前断点开始向下查找最近的有值断点
    const breakpoints: (Breakpoint | 'xs')[] = ['xs', 'sm', 'md', 'lg', 'xl', '2xl']
    const currentIndex = breakpoints.indexOf(breakpoint)
    
    for (let i = currentIndex; i >= 0; i--) {
      const bp = breakpoints[i]
      if (bp in values) {
        return values[bp]
      }
    }
    
    return undefined
  }, [breakpoint, values])
}
