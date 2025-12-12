/**
 * 多层级菜单渲染组件
 * 支持最多5层嵌套，递归渲染菜单项
 */

import {
  useCallback,
  useMemo,
  useState,
  type ReactNode,
  isValidElement,
} from "react";
import { Link, useLocation } from "@tanstack/react-router";
import { ChevronDown, ExternalLink, ChevronRight } from "lucide-react";
import { Badge, Tooltip, Popover } from "antd";
import {
  type MenuItem,
  type MenuPermissionContext,
  type MenuIcon,
  MAX_MENU_DEPTH,
  isMenuGroup,
  isMenuNavItem,
  isMenuDivider,
  hasChildren,
  filterMenuItems,
} from "@/config/menu";
import { useMenuStore, useAuthStore } from "@/stores";

/**
 * Theme-driven menu "active" styling
 * - Uses CSS variables defined in `index.css` / `theme/styles/themes.css`
 * - Avoids hardcoded Tailwind blue palette so themes can override primary color
 */
const MENU_ACTIVE_BAR_STYLE: React.CSSProperties = {
  backgroundColor: "var(--color-primary)",
};
const MENU_ACTIVE_DOT_STYLE: React.CSSProperties = {
  backgroundColor: "var(--color-primary)",
};
const MENU_ACTIVE_BG_STYLE: React.CSSProperties = {
  backgroundColor: "var(--color-primary-light)",
};

/**
 * 菜单渲染器 Props
 */
interface MenuRendererProps {
  /** 菜单项列表 */
  items: MenuItem[];
  /** 是否折叠模式 */
  collapsed?: boolean;
  /** 当前嵌套层级（内部使用） */
  level?: number;
}

/**
 * 菜单渲染器
 * 根据菜单配置递归渲染菜单项
 */
export function MenuRenderer({
  items,
  collapsed = false,
  level = 0,
}: MenuRendererProps) {
  const location = useLocation();
  const { user } = useAuthStore();
  const { openKeys, toggleOpenKey } = useMenuStore();

  // 构建权限上下文
  const permissionContext: MenuPermissionContext = useMemo(
    () => ({
      permissions: user?.permissions || [],
      roles: user?.roles || [],
      user: user as Record<string, unknown> | null,
    }),
    [user],
  );

  // 过滤菜单项
  const filteredItems = useMemo(
    () => (level === 0 ? filterMenuItems(items, permissionContext) : items),
    [items, permissionContext, level],
  );

  // 检查菜单项是否激活
  const isActive = useCallback(
    (item: MenuItem): boolean => {
      if (!isMenuNavItem(item) || !item.path) return false;

      // 精确匹配
      if (location.pathname === item.path) return true;

      // 对于仪表盘特殊处理
      if (item.path === "/admin") {
        return (
          location.pathname === "/admin" || location.pathname === "/admin/"
        );
      }

      // 前缀匹配（检查子路径）
      return location.pathname.startsWith(item.path + "/");
    },
    [location.pathname],
  );

  // 检查分组是否包含激活项（使用函数声明避免声明前访问问题）
  const hasActiveChild: (item: MenuItem) => boolean = useCallback(
    function hasActiveChildImpl(item: MenuItem): boolean {
      if (!hasChildren(item)) return false;

      const children = isMenuGroup(item) ? item.children : item.children;
      if (!children) return false;

      return children.some((child) => {
        if (isActive(child)) return true;
        if (hasChildren(child)) return hasActiveChildImpl(child);
        return false;
      });
    },
    [isActive],
  );

  // 渲染单个菜单项
  const renderMenuItem = useCallback(
    (item: MenuItem) => {
      // 分割线
      if (isMenuDivider(item)) {
        return (
          <div
            key={item.key}
            className={`my-2 mx-3 border-t transition-opacity border-subtle ${
              collapsed ? "opacity-50" : "opacity-60"
            }`}
          />
        );
      }

      // 分组或带子菜单的导航项
      if (hasChildren(item)) {
        return (
          <MenuGroupItem
            key={item.key}
            item={item}
            collapsed={collapsed}
            level={level}
            isOpen={openKeys.includes(item.key)}
            hasActiveChild={hasActiveChild(item)}
            onToggle={() => toggleOpenKey(item.key)}
          />
        );
      }

      // 普通导航项
      if (isMenuNavItem(item)) {
        return (
          <MenuNavItemComponent
            key={item.key}
            item={item}
            collapsed={collapsed}
            level={level}
            isActive={isActive(item)}
          />
        );
      }

      return null;
    },
    [collapsed, level, openKeys, toggleOpenKey, isActive, hasActiveChild],
  );

  // 防止超过最大嵌套层级
  if (level >= MAX_MENU_DEPTH) {
    console.warn(`Menu depth exceeded maximum of ${MAX_MENU_DEPTH}`);
    return null;
  }

  return <div className="space-y-1">{filteredItems.map(renderMenuItem)}</div>;
}

/**
 * 渲染菜单图标
 * 支持 React 组件（包括 ForwardRef）和 ReactNode
 */
function renderIcon(
  icon: MenuIcon | undefined,
  className: string = "w-5 h-5",
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
  // ForwardRef 组件有 $$typeof 属性，且可以作为 JSX 组件使用
  if (typeof icon === "object" && icon !== null) {
    // 检查是否是 React 组件（ForwardRef 或其他）
    // ForwardRef 有 $$typeof = Symbol(react.forward_ref)
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
 * 分组/子菜单项组件 Props
 */
interface MenuGroupItemProps {
  item: MenuItem;
  collapsed: boolean;
  level: number;
  isOpen: boolean;
  hasActiveChild: boolean;
  onToggle: () => void;
}

/**
 * SubMenu 子菜单组件
 * 可展开/收起的嵌套菜单
 */
function MenuGroupItem({
  item,
  collapsed,
  level,
  isOpen,
  hasActiveChild,
  onToggle,
}: MenuGroupItemProps) {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const label = isMenuGroup(item)
    ? item.label
    : (item as { label: string }).label;
  const icon = "icon" in item ? item.icon : undefined;
  const children = isMenuGroup(item)
    ? item.children
    : (item as { children?: MenuItem[] }).children;

  // 根据层级获取背景色（主题化：active 走 CSS 变量，hover 保持灰度）
  const getLevelBgClass = (_lvl: number, active: boolean) => {
    if (active) {
      // 激活状态：使用主题 primary light（避免写死 blue-*）
      return "menu-item-active";
    }
    // hover 状态：使用语义化变量
    return "hover:bg-hover";
  };

  // 文字颜色样式 - 使用 CSS 变量确保暗色模式正确
  const getTextStyle = (active: boolean): React.CSSProperties => {
    if (active) {
      return { color: "var(--color-primary)" };
    }
    return { color: "var(--color-text-tertiary)" };
  };

  // 折叠模式下的按钮（用于触发 Popover）
  const collapsedButton = (
    <button
      className={`
        w-full flex items-center justify-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 relative group cursor-pointer
        ${getLevelBgClass(level, hasActiveChild)}
      `}
      style={{
        paddingLeft: `${12 + level * 12}px`,
        ...(hasActiveChild ? MENU_ACTIVE_BG_STYLE : {}),
        ...getTextStyle(hasActiveChild),
      }}
    >
      {/* 激活指示条 */}
      <div
        className={`
          absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full transition-opacity duration-200
          ${hasActiveChild ? "opacity-60" : "opacity-0"}
        `}
        style={MENU_ACTIVE_BAR_STYLE}
      />

      {/* 图标 */}
      <span className="flex-shrink-0">{renderIcon(icon)}</span>
    </button>
  );

  // 折叠模式下的弹出菜单内容
  const popoverContent = (
    <div
      className="min-w-[160px] py-1"
      style={{
        backgroundColor: "var(--color-bg-elevated)",
        color: "var(--color-text-primary)",
      }}
    >
      <div
        className="px-3 py-2 text-sm font-medium border-b mb-1"
        style={{
          color: "var(--color-text-primary)",
          borderColor: "var(--color-border-secondary)",
        }}
      >
        {label}
      </div>
      {children && (
        <CollapsedSubMenuRenderer
          items={children}
          onClose={() => setPopoverOpen(false)}
        />
      )}
    </div>
  );

  // 折叠模式下使用 Popover 显示子菜单
  if (collapsed) {
    return (
      <Popover
        content={popoverContent}
        placement="rightTop"
        trigger="click"
        open={popoverOpen}
        onOpenChange={setPopoverOpen}
        arrow={false}
        overlayClassName="collapsed-menu-popover"
        overlayInnerStyle={{ padding: 0, borderRadius: "12px" }}
      >
        {collapsedButton}
      </Popover>
    );
  }

  // 展开模式下的完整内容
  const content = (
    <div>
      <button
        onClick={onToggle}
        className={`
          w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 relative group cursor-pointer
          ${getLevelBgClass(level, hasActiveChild)}
        `}
        style={{
          paddingLeft: `${12 + level * 12}px`,
          ...(hasActiveChild ? MENU_ACTIVE_BG_STYLE : {}),
          ...getTextStyle(hasActiveChild),
        }}
        onMouseEnter={(e) => {
          if (!hasActiveChild) {
            e.currentTarget.style.color = "var(--color-text-primary)";
          }
        }}
        onMouseLeave={(e) => {
          if (!hasActiveChild) {
            e.currentTarget.style.color = "var(--color-text-tertiary)";
          }
        }}
      >
        {/* 激活指示条 */}
        <div
          className={`
            absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full transition-opacity duration-200
            ${hasActiveChild ? "opacity-60" : "opacity-0"}
          `}
          style={MENU_ACTIVE_BAR_STYLE}
        />

        {/* 图标 */}
        <span className="flex-shrink-0">{renderIcon(icon)}</span>

        {/* 标签 */}
        <span
          className={`text-sm font-medium whitespace-nowrap overflow-hidden transition-all duration-300 flex-1 text-left ${
            collapsed ? "w-0 opacity-0" : "w-auto opacity-100"
          }`}
        >
          {label}
        </span>

        {/* 展开/折叠箭头 */}
        {!collapsed && (
          <span
            className={`transition-transform duration-200 ${
              isOpen ? "rotate-180" : ""
            }`}
          >
            <ChevronDown className="w-4 h-4" />
          </span>
        )}
      </button>

      {/* 子菜单 */}
      {!collapsed && (
        <div
          className={`overflow-hidden transition-all duration-300 ${
            isOpen ? "max-h-[1000px] opacity-100" : "max-h-0 opacity-0"
          }`}
        >
          <div className="pt-1">
            {children && (
              <MenuRenderer
                items={children}
                collapsed={collapsed}
                level={level + 1}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );

  return content;
}

/**
 * 折叠模式下的子菜单渲染器
 * 用于在 Popover 中渲染子菜单项
 */
function CollapsedSubMenuRenderer({
  items,
  onClose,
}: {
  items: MenuItem[];
  onClose: () => void;
}) {
  const location = useLocation();

  // 检查菜单项是否激活
  const isActive = useCallback(
    (item: MenuItem): boolean => {
      if (!isMenuNavItem(item) || !item.path) return false;
      if (location.pathname === item.path) return true;
      if (item.path === "/admin") {
        return (
          location.pathname === "/admin" || location.pathname === "/admin/"
        );
      }
      return location.pathname.startsWith(item.path + "/");
    },
    [location.pathname],
  );

  return (
    <div className="space-y-0.5">
      {items.map((subItem) => {
        if (isMenuDivider(subItem)) {
          return (
            <div key={subItem.key} className="my-1 border-t border-subtle" />
          );
        }

        if (hasChildren(subItem)) {
          // 嵌套子菜单 - 使用嵌套 Popover
          return (
            <CollapsedNestedSubMenu
              key={subItem.key}
              item={subItem}
              isActive={isActive}
              onClose={onClose}
            />
          );
        }

        if (isMenuNavItem(subItem) && subItem.path) {
          const active = isActive(subItem);
          return (
            <Link
              key={subItem.key}
              to={subItem.path}
              onClick={onClose}
              className={`
                flex items-center gap-2 px-3 py-2 mx-1 rounded-lg text-sm transition-colors
                hover:bg-hover
                ${active ? "font-medium" : ""}
              `}
              style={
                active
                  ? {
                      color: "var(--color-primary)",
                      backgroundColor: "var(--color-primary-light)",
                    }
                  : { color: "var(--color-text-secondary)" }
              }
              onMouseEnter={(e) => {
                if (!active) {
                  e.currentTarget.style.color = "var(--color-text-primary)";
                }
              }}
              onMouseLeave={(e) => {
                if (!active) {
                  e.currentTarget.style.color = "var(--color-text-secondary)";
                }
              }}
            >
              <span className="flex-shrink-0">
                {renderIcon(subItem.icon, "w-4 h-4")}
              </span>
              <span>{subItem.label}</span>
            </Link>
          );
        }

        return null;
      })}
    </div>
  );
}

/**
 * 折叠模式下的嵌套子菜单（三级及以上）
 */
function CollapsedNestedSubMenu({
  item,
  isActive,
  onClose,
}: {
  item: MenuItem;
  isActive: (item: MenuItem) => boolean;
  onClose: () => void;
}) {
  const [open, setOpen] = useState(false);
  const label = isMenuGroup(item)
    ? item.label
    : (item as { label: string }).label;
  const icon = "icon" in item ? item.icon : undefined;
  const children = isMenuGroup(item)
    ? item.children
    : (item as { children?: MenuItem[] }).children;

  // 检查是否有激活的子项
  const hasActiveChild =
    children?.some((child) => {
      if (isActive(child)) return true;
      if (hasChildren(child)) {
        const subChildren = isMenuGroup(child)
          ? child.children
          : (child as { children?: MenuItem[] }).children;
        return subChildren?.some((c) => isActive(c));
      }
      return false;
    }) ?? false;

  const nestedContent = (
    <div
      className="min-w-[140px] py-1"
      style={{
        backgroundColor: "var(--color-bg-elevated)",
        color: "var(--color-text-primary)",
      }}
    >
      {children && (
        <CollapsedSubMenuRenderer items={children} onClose={onClose} />
      )}
    </div>
  );

  return (
    <Popover
      content={nestedContent}
      placement="rightTop"
      trigger="hover"
      open={open}
      onOpenChange={setOpen}
      arrow={false}
      overlayClassName="collapsed-menu-popover"
      overlayInnerStyle={{ padding: 0, borderRadius: "8px" }}
    >
      <div
        className={`
          flex items-center justify-between gap-2 px-3 py-2 mx-1 rounded-lg text-sm cursor-pointer transition-colors
          hover:bg-hover
          ${hasActiveChild ? "font-medium" : ""}
        `}
        style={
          hasActiveChild
            ? { color: "var(--color-primary)" }
            : { color: "var(--color-text-secondary)" }
        }
        onMouseEnter={(e) => {
          if (!hasActiveChild) {
            e.currentTarget.style.color = "var(--color-text-primary)";
          }
        }}
        onMouseLeave={(e) => {
          if (!hasActiveChild) {
            e.currentTarget.style.color = "var(--color-text-secondary)";
          }
        }}
      >
        <div className="flex items-center gap-2">
          <span className="flex-shrink-0">{renderIcon(icon, "w-4 h-4")}</span>
          <span>{label}</span>
        </div>
        <ChevronRight
          className="w-3 h-3"
          style={{ color: "var(--color-text-muted)" }}
        />
      </div>
    </Popover>
  );
}

/**
 * 导航菜单项组件 Props
 */
interface MenuNavItemProps {
  item: MenuItem;
  collapsed: boolean;
  level: number;
  isActive: boolean;
}

/**
 * 导航菜单项组件
 */
function MenuNavItemComponent({
  item,
  collapsed,
  level,
  isActive,
}: MenuNavItemProps) {
  if (!isMenuNavItem(item)) return null;

  const { label, icon, path, externalLink, openInNewTab, badge } = item;

  // 根据层级获取背景色（主题化：active 走 CSS 变量，hover 保持灰度）
  const getLevelBgClass = (_lvl: number, active: boolean) => {
    if (active) {
      // 激活状态：使用主题 primary light（避免写死 blue-*）
      return "menu-item-active";
    }
    // hover 状态：使用语义化变量
    return "hover:bg-hover";
  };

  // 文字颜色样式 - 使用 CSS 变量确保暗色模式正确
  const getTextStyle = (active: boolean): React.CSSProperties => {
    if (active) {
      return { color: "var(--color-primary)" };
    }
    return { color: "var(--color-text-tertiary)" };
  };

  // 外部链接
  if (externalLink) {
    const linkContent = (
      <a
        href={externalLink}
        target={openInNewTab ? "_blank" : undefined}
        rel={openInNewTab ? "noopener noreferrer" : undefined}
        className={`
          flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 relative group
          hover:bg-hover
        `}
        style={{
          paddingLeft: `${12 + level * 12}px`,
          color: "var(--color-text-tertiary)",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = "var(--color-text-primary)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = "var(--color-text-tertiary)";
        }}
      >
        <span className="flex-shrink-0">{renderIcon(icon)}</span>
        <span
          className={`text-sm font-medium whitespace-nowrap overflow-hidden transition-all duration-300 flex-1 ${
            collapsed ? "w-0 opacity-0" : "w-auto opacity-100"
          }`}
        >
          {label}
        </span>
        {!collapsed && (
          <ExternalLink
            className="w-3.5 h-3.5"
            style={{ color: "var(--color-text-muted)" }}
          />
        )}
      </a>
    );

    if (collapsed) {
      return (
        <Tooltip title={label} placement="right">
          {linkContent}
        </Tooltip>
      );
    }

    return linkContent;
  }

  // 内部导航
  const navContent = (
    <Link
      to={path || "#"}
      className={`
        flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 relative overflow-hidden group
        ${getLevelBgClass(level, isActive)}
      `}
      style={{
        paddingLeft: `${12 + level * 12}px`,
        ...(isActive ? MENU_ACTIVE_BG_STYLE : {}),
        ...getTextStyle(isActive),
      }}
      onMouseEnter={(e) => {
        if (!isActive) {
          e.currentTarget.style.color = "var(--color-text-primary)";
        }
      }}
      onMouseLeave={(e) => {
        if (!isActive) {
          e.currentTarget.style.color = "var(--color-text-tertiary)";
        }
      }}
    >
      {/* 激活指示条 */}
      <div
        className={`
          absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full transition-all duration-200
          ${isActive ? "opacity-100" : "opacity-0 group-hover:opacity-50"}
        `}
        style={MENU_ACTIVE_BAR_STYLE}
      />

      {/* 图标 */}
      <span className="flex-shrink-0">{renderIcon(icon)}</span>

      {/* 标签 */}
      <span
        className={`text-sm font-medium whitespace-nowrap overflow-hidden transition-all duration-300 flex-1 ${
          collapsed ? "w-0 opacity-0" : "w-auto opacity-100"
        }`}
      >
        {label}
      </span>

      {/* 徽章 */}
      {!collapsed && badge && (
        <Badge
          count={badge.count}
          dot={badge.dot}
          overflowCount={badge.overflowCount}
          color={badge.color}
          size="small"
        />
      )}

      {/* 激活状态指示点 */}
      {!collapsed && (
        <div
          className={`absolute right-3 w-1.5 h-1.5 rounded-full animate-pulse transition-opacity duration-200 ${
            isActive ? "opacity-100" : "opacity-0"
          }`}
          style={MENU_ACTIVE_DOT_STYLE}
        />
      )}
    </Link>
  );

  // 折叠模式下显示 Tooltip
  if (collapsed) {
    return (
      <Tooltip title={label} placement="right">
        {navContent}
      </Tooltip>
    );
  }

  return navContent;
}

export default MenuRenderer;
