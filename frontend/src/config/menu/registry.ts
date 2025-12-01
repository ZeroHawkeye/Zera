/**
 * 菜单注册中心
 * 管理所有菜单模块的注册、获取和生命周期
 * 支持动态注册和热更新
 */

import type { MenuModule, MenuConfig, MenuItem, MenuPermissionContext } from './types'
import { filterMenuItems, sortMenuItems, mergeMenuItems } from './utils'

/**
 * 菜单模块注册中心
 */
class MenuRegistry {
  /** 已注册的模块 */
  private modules: Map<string, MenuModule> = new Map()

  /** 模块初始化状态 */
  private initializedModules: Set<string> = new Set()

  /** 变更监听器 */
  private listeners: Set<() => void> = new Set()

  /**
   * 注册菜单模块
   * @param module 菜单模块
   */
  register(module: MenuModule): void {
    if (this.modules.has(module.id)) {
      console.warn(`Menu module "${module.id}" is already registered. Updating...`)
    }

    this.modules.set(module.id, module)
    this.notifyListeners()
  }

  /**
   * 批量注册菜单模块
   * @param modules 菜单模块数组
   */
  registerAll(modules: MenuModule[]): void {
    modules.forEach((module) => this.register(module))
  }

  /**
   * 注销菜单模块
   * @param moduleId 模块ID
   */
  unregister(moduleId: string): void {
    const module = this.modules.get(moduleId)
    if (module) {
      if (this.initializedModules.has(moduleId)) {
        module.onDestroy?.()
        this.initializedModules.delete(moduleId)
      }
      this.modules.delete(moduleId)
      this.notifyListeners()
    }
  }

  /**
   * 获取指定模块
   * @param moduleId 模块ID
   */
  getModule(moduleId: string): MenuModule | undefined {
    return this.modules.get(moduleId)
  }

  /**
   * 获取所有已注册的模块（按优先级排序）
   */
  getAllModules(): MenuModule[] {
    return Array.from(this.modules.values()).sort((a, b) => {
      const configA = a.getMenuConfig()
      const configB = b.getMenuConfig()
      return (configA.priority ?? 100) - (configB.priority ?? 100)
    })
  }

  /**
   * 获取所有菜单配置
   */
  getAllConfigs(): MenuConfig[] {
    return this.getAllModules()
      .map((module) => module.getMenuConfig())
      .filter((config) => config.enabled !== false)
  }

  /**
   * 获取合并后的菜单项列表
   * @param context 权限上下文（可选）
   */
  getMergedMenuItems(context?: MenuPermissionContext): MenuItem[] {
    const configs = this.getAllConfigs()
    const allItems = configs.map((config) => config.items)
    const merged = mergeMenuItems(...allItems)
    const sorted = sortMenuItems(merged)

    if (context) {
      return filterMenuItems(sorted, context)
    }

    return sorted
  }

  /**
   * 初始化所有模块
   */
  async initializeAll(): Promise<void> {
    const modules = this.getAllModules()

    for (const module of modules) {
      if (!this.initializedModules.has(module.id)) {
        await module.onInit?.()
        this.initializedModules.add(module.id)
      }
    }
  }

  /**
   * 销毁所有模块
   */
  async destroyAll(): Promise<void> {
    const modules = this.getAllModules().reverse()

    for (const module of modules) {
      if (this.initializedModules.has(module.id)) {
        await module.onDestroy?.()
        this.initializedModules.delete(module.id)
      }
    }

    this.modules.clear()
    this.notifyListeners()
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

  /**
   * 添加变更监听器
   */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /**
   * 通知所有监听器
   */
  private notifyListeners(): void {
    this.listeners.forEach((listener) => listener())
  }
}

/** 全局菜单注册中心实例 */
export const menuRegistry = new MenuRegistry()

/**
 * 创建菜单模块的工厂函数
 * @param id 模块唯一标识
 * @param name 模块名称
 * @param getConfig 获取菜单配置的函数
 * @param hooks 生命周期钩子
 */
export function defineMenuModule(
  id: string,
  name: string,
  getConfig: () => Omit<MenuConfig, 'id' | 'name'>,
  hooks?: {
    onInit?: () => void | Promise<void>
    onDestroy?: () => void | Promise<void>
  }
): MenuModule {
  return {
    id,
    name,
    getMenuConfig: () => ({
      id,
      name,
      ...getConfig(),
    }),
    onInit: hooks?.onInit,
    onDestroy: hooks?.onDestroy,
  }
}
