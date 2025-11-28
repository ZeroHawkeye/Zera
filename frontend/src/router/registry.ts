import type { RouteModule, RouteDefinition, RouteModuleConfig } from './types'

/**
 * 路由模块注册中心
 * 管理所有路由模块的注册、获取和生命周期
 */
class RouteRegistry {
  /** 已注册的模块 */
  private modules: Map<string, RouteModule> = new Map()
  
  /** 模块初始化状态 */
  private initializedModules: Set<string> = new Set()

  /**
   * 注册路由模块
   * @param module 路由模块
   */
  register(module: RouteModule): void {
    if (this.modules.has(module.config.id)) {
      console.warn(`Route module "${module.config.id}" is already registered. Skipping...`)
      return
    }

    if (module.config.enabled === false) {
      console.info(`Route module "${module.config.id}" is disabled. Skipping...`)
      return
    }

    this.modules.set(module.config.id, module)
  }

  /**
   * 批量注册路由模块
   * @param modules 路由模块数组
   */
  registerAll(modules: RouteModule[]): void {
    modules.forEach((module) => this.register(module))
  }

  /**
   * 注销路由模块
   * @param moduleId 模块ID
   */
  unregister(moduleId: string): void {
    const module = this.modules.get(moduleId)
    if (module) {
      // 调用销毁钩子
      if (this.initializedModules.has(moduleId)) {
        module.onDestroy?.()
        this.initializedModules.delete(moduleId)
      }
      this.modules.delete(moduleId)
    }
  }

  /**
   * 获取指定模块
   * @param moduleId 模块ID
   */
  getModule(moduleId: string): RouteModule | undefined {
    return this.modules.get(moduleId)
  }

  /**
   * 获取所有已注册的模块（按优先级排序）
   */
  getAllModules(): RouteModule[] {
    return Array.from(this.modules.values()).sort(
      (a, b) => (a.config.priority ?? 100) - (b.config.priority ?? 100)
    )
  }

  /**
   * 获取所有路由定义
   */
  getAllRoutes(): { module: RouteModuleConfig; routes: RouteDefinition[] }[] {
    return this.getAllModules().map((module) => ({
      module: module.config,
      routes: module.getRoutes(),
    }))
  }

  /**
   * 初始化所有模块
   */
  async initializeAll(): Promise<void> {
    const modules = this.getAllModules()
    
    for (const module of modules) {
      if (!this.initializedModules.has(module.config.id)) {
        await module.onInit?.()
        this.initializedModules.add(module.config.id)
      }
    }
  }

  /**
   * 销毁所有模块
   */
  async destroyAll(): Promise<void> {
    const modules = this.getAllModules().reverse()
    
    for (const module of modules) {
      if (this.initializedModules.has(module.config.id)) {
        await module.onDestroy?.()
        this.initializedModules.delete(module.config.id)
      }
    }
    
    this.modules.clear()
  }

  /**
   * 检查模块是否已注册
   * @param moduleId 模块ID
   */
  hasModule(moduleId: string): boolean {
    return this.modules.has(moduleId)
  }

  /**
   * 获取模块数量
   */
  get size(): number {
    return this.modules.size
  }
}

/** 全局路由注册中心实例 */
export const routeRegistry = new RouteRegistry()

/**
 * 创建路由模块的工厂函数
 * @param config 模块配置
 * @param getRoutes 获取路由定义的函数
 * @param hooks 生命周期钩子
 */
export function defineRouteModule(
  config: RouteModuleConfig,
  getRoutes: () => RouteDefinition[],
  hooks?: {
    onInit?: () => void | Promise<void>
    onDestroy?: () => void | Promise<void>
  }
): RouteModule {
  return {
    config: {
      ...config,
      enabled: config.enabled ?? true,
      priority: config.priority ?? 100,
    },
    getRoutes,
    onInit: hooks?.onInit,
    onDestroy: hooks?.onDestroy,
  }
}
