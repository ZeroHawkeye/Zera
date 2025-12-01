/**
 * 权限配置模块
 *
 * 定义权限代码常量和菜单权限映射关系
 * 与后端 internal/permission/registry.go 保持对应
 */

// ============================================
// 权限代码常量
// ============================================

/**
 * 用户管理权限
 */
export const USER_PERMISSIONS = {
  READ: 'user:read',
  CREATE: 'user:create',
  UPDATE: 'user:update',
  DELETE: 'user:delete',
  RESET_PASSWORD: 'user:reset-password',
} as const

/**
 * 角色管理权限
 */
export const ROLE_PERMISSIONS = {
  READ: 'role:read',
  CREATE: 'role:create',
  UPDATE: 'role:update',
  DELETE: 'role:delete',
  ASSIGN: 'role:assign',
} as const

/**
 * 权限管理权限
 */
export const PERMISSION_PERMISSIONS = {
  READ: 'permission:read',
} as const

/**
 * 所有权限常量集合
 */
export const PERMISSIONS = {
  USER: USER_PERMISSIONS,
  ROLE: ROLE_PERMISSIONS,
  PERMISSION: PERMISSION_PERMISSIONS,
} as const

// ============================================
// 菜单权限映射
// ============================================

/**
 * 菜单路径与所需权限的映射
 * key: 路由路径
 * value: 需要的权限列表（满足任一即可显示菜单）
 */
export const MENU_PERMISSIONS: Record<string, string[]> = {
  // 用户管理
  '/admin/users': [USER_PERMISSIONS.READ],

  // 角色管理
  '/admin/roles': [ROLE_PERMISSIONS.READ],

  // 系统设置
  '/admin/settings': [],  // 暂无特定权限要求
  '/admin/settings/general': [],
  '/admin/settings/security': [],

  // 日志管理
  '/admin/logs': [],  // TODO: 添加日志权限
}

// ============================================
// 按钮权限映射
// ============================================

/**
 * 按钮级别的权限映射
 * 用于控制页面内按钮的显示/禁用状态
 */
export const BUTTON_PERMISSIONS = {
  // 用户管理
  USER_CREATE: USER_PERMISSIONS.CREATE,
  USER_UPDATE: USER_PERMISSIONS.UPDATE,
  USER_DELETE: USER_PERMISSIONS.DELETE,
  USER_RESET_PASSWORD: USER_PERMISSIONS.RESET_PASSWORD,

  // 角色管理
  ROLE_CREATE: ROLE_PERMISSIONS.CREATE,
  ROLE_UPDATE: ROLE_PERMISSIONS.UPDATE,
  ROLE_DELETE: ROLE_PERMISSIONS.DELETE,
  ROLE_ASSIGN: ROLE_PERMISSIONS.ASSIGN,
} as const

// ============================================
// 资源分组定义
// ============================================

/**
 * 资源分组信息（用于权限配置界面展示）
 */
export interface ResourceGroup {
  /** 资源代码 */
  resource: string
  /** 资源显示名称 */
  name: string
  /** 资源描述 */
  description: string
  /** 图标名称 */
  icon: string
  /** 排序顺序 */
  order: number
}

/**
 * 资源分组列表
 */
export const RESOURCE_GROUPS: ResourceGroup[] = [
  {
    resource: 'user',
    name: '用户管理',
    description: '用户账号相关操作',
    icon: 'UserOutlined',
    order: 1,
  },
  {
    resource: 'role',
    name: '角色管理',
    description: '角色及权限分配',
    icon: 'TeamOutlined',
    order: 2,
  },
  {
    resource: 'permission',
    name: '权限管理',
    description: '系统权限配置',
    icon: 'SafetyOutlined',
    order: 3,
  },
]

/**
 * 获取资源分组名称
 */
export function getResourceName(resource: string): string {
  const group = RESOURCE_GROUPS.find((g) => g.resource === resource)
  return group?.name ?? resource
}

// ============================================
// 权限检查工具函数
// ============================================

/**
 * 检查路由是否有权限要求
 */
export function hasMenuPermissionRequirement(path: string): boolean {
  const permissions = MENU_PERMISSIONS[path]
  return permissions !== undefined && permissions.length > 0
}

/**
 * 获取路由所需的权限列表
 */
export function getMenuPermissions(path: string): string[] {
  return MENU_PERMISSIONS[path] ?? []
}
