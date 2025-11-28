import { createRouter } from '@tanstack/react-router'
import { routeTree } from './routes'

// 创建路由器实例
export const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
})

// 为类型安全注册路由器类型
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

// 导出路由注册 API，供插件使用
export { registerRoute, getRouteTree } from './routes'
