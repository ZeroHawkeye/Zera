/**
 * 菜单工具函数
 * 提供菜单的遍历、过滤、权限校验等功能
 */

import {
  type MenuItem,
  type MenuKey,
  type FlatMenuItem,
  type MenuPermission,
  type MenuPermissionContext,
  type MenuGroup,
  type MenuNavItem,
  MAX_MENU_DEPTH,
  isMenuGroup,
  isMenuNavItem,
  isMenuDivider,
  hasChildren,
} from "./types";

/**
 * 扁平化菜单树
 * 将嵌套的菜单结构转换为扁平数组，便于快速查找
 * @param items 菜单项列表
 * @param parentKeys 父级菜单 key 路径
 * @param level 当前层级
 */
export function flattenMenuItems(
  items: MenuItem[],
  parentKeys: MenuKey[] = [],
  level: number = 0,
): FlatMenuItem[] {
  const result: FlatMenuItem[] = [];

  for (const item of items) {
    const flatItem: FlatMenuItem = {
      item,
      parentKeys,
      level,
      fullPath: isMenuNavItem(item) ? item.path : undefined,
    };
    result.push(flatItem);

    // 递归处理子菜单（最深5层）
    if (hasChildren(item) && level < MAX_MENU_DEPTH - 1) {
      const children = isMenuGroup(item) ? item.children : item.children;
      if (children) {
        result.push(
          ...flattenMenuItems(children, [...parentKeys, item.key], level + 1),
        );
      }
    }
  }

  return result;
}

/**
 * 根据 key 查找菜单项
 * @param items 菜单项列表
 * @param key 菜单 key
 */
export function findMenuItemByKey(
  items: MenuItem[],
  key: MenuKey,
): FlatMenuItem | undefined {
  const flatItems = flattenMenuItems(items);
  return flatItems.find((flat) => flat.item.key === key);
}

/**
 * 根据路径查找菜单项
 * @param items 菜单项列表
 * @param path 路由路径
 */
export function findMenuItemByPath(
  items: MenuItem[],
  path: string,
): FlatMenuItem | undefined {
  const flatItems = flattenMenuItems(items);

  // 精确匹配
  const exactMatch = flatItems.find(
    (flat) => isMenuNavItem(flat.item) && flat.item.path === path,
  );
  if (exactMatch) return exactMatch;

  // 前缀匹配（用于子页面）
  const prefixMatches = flatItems
    .filter((flat) => {
      if (!isMenuNavItem(flat.item) || !flat.item.path) return false;
      return path.startsWith(flat.item.path) && flat.item.path !== "/";
    })
    .sort((a, b) => {
      // 优先匹配更长的路径
      const pathA = (a.item as MenuNavItem).path || "";
      const pathB = (b.item as MenuNavItem).path || "";
      return pathB.length - pathA.length;
    });

  return prefixMatches[0];
}

/**
 * 获取菜单项的展开 keys 路径
 * @param items 菜单项列表
 * @param key 目标菜单 key
 */
export function getOpenKeysForItem(items: MenuItem[], key: MenuKey): MenuKey[] {
  const flatItem = findMenuItemByKey(items, key);
  return flatItem ? flatItem.parentKeys : [];
}

/**
 * 根据路径获取展开 keys 路径
 * @param items 菜单项列表
 * @param path 路由路径
 */
export function getOpenKeysForPath(items: MenuItem[], path: string): MenuKey[] {
  const flatItem = findMenuItemByPath(items, path);
  return flatItem ? [...flatItem.parentKeys, flatItem.item.key] : [];
}

/**
 * 检查单个权限是否匹配
 * 支持通配符: * 匹配所有，user:* 匹配所有 user 相关权限
 */
function matchPermission(
  userPermission: string,
  requiredPermission: string,
): boolean {
  // 完全匹配
  if (userPermission === requiredPermission) return true;
  // 超级权限
  if (userPermission === "*") return true;
  // 资源级通配符 (如 user:* 匹配 user:read)
  if (userPermission.endsWith(":*")) {
    const prefix = userPermission.slice(0, -1); // 移除末尾的 *
    if (requiredPermission.startsWith(prefix)) return true;
  }
  return false;
}

/**
 * 检查菜单项权限
 * @param permission 权限配置
 * @param context 权限上下文
 */
export function checkMenuPermission(
  permission: MenuPermission | undefined,
  context: MenuPermissionContext,
): boolean {
  if (!permission) return true;

  // 自定义权限校验
  if (permission.check) {
    return permission.check(context);
  }

  // 管理员角色拥有所有权限
  if (
    context.roles.includes("admin") ||
    context.roles.includes("super_admin")
  ) {
    return true;
  }

  // 角色校验（满足任意一个即可）
  if (permission.roles && permission.roles.length > 0) {
    const hasRole = permission.roles.some((role) =>
      context.roles.includes(role),
    );
    if (!hasRole) return false;
  }

  // 权限校验（满足任意一个即可），支持通配符
  if (permission.permissions && permission.permissions.length > 0) {
    const hasPermission = permission.permissions.some((requiredPerm) =>
      context.permissions.some((userPerm) =>
        matchPermission(userPerm, requiredPerm),
      ),
    );
    if (!hasPermission) return false;
  }

  return true;
}

/**
 * 过滤菜单项（根据权限和隐藏状态）
 * @param items 菜单项列表
 * @param context 权限上下文
 * @param level 当前层级
 */
export function filterMenuItems(
  items: MenuItem[],
  context: MenuPermissionContext,
  level: number = 0,
): MenuItem[] {
  return items
    .filter((item) => {
      // 过滤隐藏项
      if (item.hidden) return false;

      // 分割线不需要权限校验
      if (isMenuDivider(item)) return true;

      // 权限校验
      if (isMenuGroup(item) || isMenuNavItem(item)) {
        if (!checkMenuPermission(item.permission, context)) return false;
      }

      return true;
    })
    .map((item) => {
      // 递归过滤子菜单
      if (hasChildren(item) && level < MAX_MENU_DEPTH - 1) {
        if (isMenuGroup(item)) {
          const filteredChildren = filterMenuItems(
            item.children,
            context,
            level + 1,
          );
          // 如果分组没有可见子项，则隐藏整个分组
          if (filteredChildren.length === 0) {
            return null;
          }
          return { ...item, children: filteredChildren };
        }
        if (isMenuNavItem(item) && item.children) {
          const filteredChildren = filterMenuItems(
            item.children,
            context,
            level + 1,
          );
          return { ...item, children: filteredChildren };
        }
      }
      return item;
    })
    .filter((item): item is MenuItem => item !== null);
}

/**
 * 对菜单项进行排序
 * @param items 菜单项列表
 */
export function sortMenuItems(items: MenuItem[]): MenuItem[] {
  return [...items]
    .sort((a, b) => (a.order ?? 100) - (b.order ?? 100))
    .map((item) => {
      if (hasChildren(item)) {
        if (isMenuGroup(item)) {
          return { ...item, children: sortMenuItems(item.children) };
        }
        if (isMenuNavItem(item) && item.children) {
          return { ...item, children: sortMenuItems(item.children) };
        }
      }
      return item;
    });
}

/**
 * 合并多个菜单配置
 * 按优先级合并，支持同 key 菜单项的覆盖
 * @param configs 菜单配置列表
 */
export function mergeMenuItems(...itemsList: MenuItem[][]): MenuItem[] {
  const merged = new Map<MenuKey, MenuItem>();
  const orderList: MenuKey[] = [];

  for (const items of itemsList) {
    for (const item of items) {
      if (!merged.has(item.key)) {
        orderList.push(item.key);
      }
      
      const existing = merged.get(item.key);
      if (existing && hasChildren(existing) && hasChildren(item)) {
        // 合并子菜单
        const existingChildren = isMenuGroup(existing)
          ? existing.children
          : (existing as MenuNavItem).children || [];
        const newChildren = isMenuGroup(item)
          ? item.children
          : (item as MenuNavItem).children || [];
        
        const mergedChildren = mergeMenuItems(existingChildren, newChildren);
        
        if (isMenuGroup(item)) {
          merged.set(item.key, { ...item, children: mergedChildren } as MenuGroup)
        } else {
          merged.set(item.key, { ...item, children: mergedChildren } as MenuNavItem)
        }
      } else {
        merged.set(item.key, item);
      }
    }
  }

  return orderList.map((key) => merged.get(key)!).filter(Boolean);
}

/**
 * 获取所有可展开的菜单项 keys
 * @param items 菜单项列表
 */
export function getAllExpandableKeys(items: MenuItem[]): MenuKey[] {
  const keys: MenuKey[] = [];

  const traverse = (menuItems: MenuItem[]) => {
    for (const item of menuItems) {
      if (hasChildren(item)) {
        keys.push(item.key);
        const children = isMenuGroup(item) ? item.children : item.children;
        if (children) {
          traverse(children);
        }
      }
    }
  };

  traverse(items);
  return keys;
}

/**
 * 获取默认展开的菜单项 keys
 * @param items 菜单项列表
 */
export function getDefaultOpenKeys(items: MenuItem[]): MenuKey[] {
  const keys: MenuKey[] = [];

  const traverse = (menuItems: MenuItem[]) => {
    for (const item of menuItems) {
      if (hasChildren(item)) {
        const shouldOpen =
          (isMenuGroup(item) && item.defaultOpen) ||
          (isMenuNavItem(item) && item.defaultOpen);

        if (shouldOpen) {
          keys.push(item.key);
        }

        const children = isMenuGroup(item) ? item.children : item.children;
        if (children) {
          traverse(children);
        }
      }
    }
  };

  traverse(items);
  return keys;
}

/**
 * 生成面包屑数据
 * @param items 菜单项列表
 * @param path 当前路径
 */
export function generateBreadcrumbs(
  items: MenuItem[],
  path: string,
): Array<{ key: MenuKey; label: string; path?: string }> {
  const flatItem = findMenuItemByPath(items, path);
  if (!flatItem) return [];

  const breadcrumbs: Array<{ key: MenuKey; label: string; path?: string }> = [];

  // 添加父级菜单
  for (const parentKey of flatItem.parentKeys) {
    const parent = findMenuItemByKey(items, parentKey);
    if (parent && (isMenuGroup(parent.item) || isMenuNavItem(parent.item))) {
      breadcrumbs.push({
        key: parent.item.key,
        label: parent.item.label,
        path: isMenuNavItem(parent.item) ? parent.item.path : undefined,
      });
    }
  }

  // 添加当前菜单
  if (isMenuGroup(flatItem.item) || isMenuNavItem(flatItem.item)) {
    breadcrumbs.push({
      key: flatItem.item.key,
      label: flatItem.item.label,
      path: isMenuNavItem(flatItem.item) ? flatItem.item.path : undefined,
    });
  }

  return breadcrumbs;
}
