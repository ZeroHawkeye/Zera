/**
 * 菜单系统统一导出
 */

// 类型导出
export type {
  MenuKey,
  MenuIcon,
  MenuItemBase,
  MenuPermission,
  MenuPermissionContext,
  MenuGroup,
  MenuNavItem,
  MenuDivider,
  MenuItem,
  MenuConfig,
  MenuModule,
  MenuContext,
  FlatMenuItem,
  MenuRendererProps,
  MenuBadge,
} from './types'

// 枚举和常量导出
export { MenuType, MAX_MENU_DEPTH } from './types'

// 类型守卫导出
export {
  isMenuGroup,
  isMenuNavItem,
  isMenuDivider,
  hasChildren,
} from './types'

// 工具函数导出
export {
  flattenMenuItems,
  findMenuItemByKey,
  findMenuItemByPath,
  getOpenKeysForItem,
  getOpenKeysForPath,
  checkMenuPermission,
  filterMenuItems,
  sortMenuItems,
  mergeMenuItems,
  getAllExpandableKeys,
  getDefaultOpenKeys,
  generateBreadcrumbs,
} from './utils'

// 注册中心导出
export { menuRegistry, defineMenuModule } from './registry'

// 菜单配置导出
export {
  adminCoreMenuModule,
  adminCoreMenuItems,
  initAdminMenus,
} from './admin'
