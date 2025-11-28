import { createRouter } from '@tanstack/react-router'
import { routeTree } from './routes'

/**
 * 创建路由器实例
 */
export const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
  // 默认的404处理
  defaultNotFoundComponent: () => (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-gray-200">404</h1>
        <p className="mt-4 text-xl text-gray-600">页面未找到</p>
        <a
          href="/"
          className="mt-6 inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          返回首页
        </a>
      </div>
    </div>
  ),
})

// 为类型安全注册路由器类型
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
