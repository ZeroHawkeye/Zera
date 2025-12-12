/**
 * 顶部导航菜单组件
 * 横向展示一级菜单，用于 TopNavLayout
 */

import { useMemo, type ReactNode, isValidElement } from "react";
import {
  type MenuItem,
  type MenuIcon,
  isMenuNavItem,
  isMenuDivider,
} from "@/config/menu";

/**
 * 顶部导航菜单 Props
 */
interface TopNavMenuProps {
  /** 菜单项列表 */
  items: MenuItem[];
  /** 当前激活的菜单项 key */
  activeKey?: string | null;
  /** 菜单项点击事件 */
  onItemClick?: (key: string, path?: string) => void;
}

/**
 * 渲染菜单图标
 */
function renderIcon(
  icon: MenuIcon | undefined,
  className: string = "w-4 h-4",
): ReactNode {
  if (!icon) return null;

  // 如果是 React 元素（已实例化），直接返回
  if (isValidElement(icon)) {
    return icon;
  }

  // 如果是函数组件
  if (typeof icon === "function") {
    const IconComponent = icon;
    return <IconComponent className={className} />;
  }

  // 如果是对象（可能是 ForwardRef 组件，如 Lucide 图标）
  if (typeof icon === "object" && icon !== null) {
    const iconAsAny = icon as { $$typeof?: symbol; render?: unknown };
    if (iconAsAny.$$typeof || typeof iconAsAny.render === "function") {
      const IconComponent = icon as unknown as React.ComponentType<{
        className?: string;
      }>;
      return <IconComponent className={className} />;
    }
  }

  return null;
}

/**
 * 顶部导航菜单组件
 */
export function TopNavMenu({ items, activeKey, onItemClick }: TopNavMenuProps) {
  // 过滤并排序菜单项
  const visibleItems = useMemo(() => {
    return items
      .filter((item) => !item.hidden && !isMenuDivider(item))
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [items]);

  return (
    <nav className="flex items-center gap-1">
      {visibleItems.map((item) => {
        const isActive = activeKey === item.key;
        const label = isMenuNavItem(item) ? item.label : (item as { label?: string }).label;
        const icon = 'icon' in item ? item.icon : undefined;
        const path = isMenuNavItem(item) ? item.path : undefined;

        return (
          <button
            key={item.key}
            onClick={() => onItemClick?.(item.key, path)}
            className={`
              relative px-4 py-2 rounded-lg text-sm font-medium
              transition-all duration-200 cursor-pointer
              ${
                isActive
                  ? "text-primary"
                  : "text-secondary hover:text-default hover:bg-hover"
              }
            `}
          >
            {/* 图标 + 标签 + 激活指示条 */}
            <span className="relative flex items-center gap-2">
              {/* 图标 */}
              {icon && (
                <span className="flex-shrink-0">
                  {renderIcon(icon, "w-4 h-4")}
                </span>
              )}

              {/* 标签 */}
              <span>{label}</span>

              {/* 激活指示条 - 宽度与图标+文字一致 */}
              {isActive && (
                <span
                  className="absolute -bottom-2 left-0 w-full h-0.5 rounded-full"
                  style={{ backgroundColor: "var(--color-primary)" }}
                />
              )}
            </span>
          </button>
        );
      })}
    </nav>
  );
}

export default TopNavMenu;
