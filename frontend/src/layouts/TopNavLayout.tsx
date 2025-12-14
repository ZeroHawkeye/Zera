/**
 * 顶部导航布局
 * 一级菜单在 Header 中横向展示，二级菜单在侧边栏动态切换
 * 参考 U-CENTER 布局风格
 */

import { Outlet, Link, useLocation, useNavigate } from "@tanstack/react-router";
import React, { useEffect, useMemo, useCallback, type ReactNode } from "react";
import {
  ChevronLeft,
  ChevronRight,
  LogOut,
  ChevronDown,
  Menu,
  X,
} from "lucide-react";
import { Dropdown, Avatar, Breadcrumb } from "antd";
import type { MenuProps } from "antd";
import { useResponsive } from "@/hooks";
import { useAuthStore, useMenuStore } from "@/stores";
import { MenuRenderer } from "@/components/menu";
import { TopNavMenu } from "@/components/menu/TopNavMenu";
import { GlobalSearchTrigger } from "@/components/GlobalSearch";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LayoutToggle } from "@/components/LayoutToggle";
import { initAdminMenus, generateBreadcrumbs, type MenuItem, hasChildren, isMenuNavItem } from "@/config/menu";
import { Logo } from "@/components";
import { getCasLogoutRedirectUrl } from "@/api/cas_auth";

const ADMIN_ACCENT_BG = "bg-primary";

interface TopNavLayoutProps {
  children?: ReactNode;
}

// 初始化菜单（只执行一次）
let menuInitialized = false;
function ensureMenuInitialized() {
  if (!menuInitialized) {
    initAdminMenus();
    menuInitialized = true;
  }
}

/**
 * 顶部导航布局
 * 一级菜单在 Header 中横向展示，二级菜单在侧边栏动态切换
 */
export function TopNavLayout({ children }: TopNavLayoutProps) {
  // 确保菜单已初始化
  ensureMenuInitialized();

  const location = useLocation();
  const navigate = useNavigate();
  const { isMobile } = useResponsive();
  const { user, logout } = useAuthStore();

  // 使用菜单状态管理
  const {
    collapsed,
    mobileMenuOpen,
    activeTopMenuKey,
    setCollapsed,
    setMobileMenuOpen,
    setActiveTopMenuKey,
    updateByPath,
    getMenuItems,
  } = useMenuStore();

  // 获取菜单项
  const menuItems = useMemo(() => getMenuItems(), [getMenuItems]);

  // 获取顶级菜单项（只取第一级）
  const topMenuItems = useMemo(() => {
    return menuItems.filter(item => !item.hidden);
  }, [menuItems]);

  // 获取当前选中的顶级菜单的子菜单
  const sideMenuItems = useMemo((): MenuItem[] => {
    if (!activeTopMenuKey) return [];

    const activeTopMenu = menuItems.find(item => item.key === activeTopMenuKey);
    if (!activeTopMenu) return [];

    // 如果有子菜单，返回子菜单
    if (hasChildren(activeTopMenu)) {
      const children = 'children' in activeTopMenu ? activeTopMenu.children : [];
      return children || [];
    }

    return [];
  }, [menuItems, activeTopMenuKey]);

  // 判断是否显示侧边栏（只有当前选中的顶级菜单有子菜单时才显示）
  const showSidebar = useMemo(() => {
    return sideMenuItems.length > 0;
  }, [sideMenuItems]);

  // 检查子菜单中是否有匹配的路径
  const checkChildrenMatch = useCallback((children: MenuItem[], path: string): boolean => {
    for (const child of children) {
      if (isMenuNavItem(child) && child.path) {
        if (path === child.path || path.startsWith(child.path + '/')) {
          return true;
        }
      }
      if (hasChildren(child)) {
        const subChildren = 'children' in child ? child.children : [];
        if (subChildren && checkChildrenMatch(subChildren, path)) {
          return true;
        }
      }
    }
    return false;
  }, []);

  // 根据路径查找对应的顶级菜单 key
  const findTopMenuKeyByPath = useCallback((path: string): string | null => {
    for (const item of menuItems) {
      // 检查顶级菜单本身的路径
      if (isMenuNavItem(item) && item.path) {
        // 精确匹配
        if (path === item.path) {
          return item.key;
        }
        // 前缀匹配（但不是 /admin 这种根路径）
        if (item.path !== '/admin' && path.startsWith(item.path + '/')) {
          return item.key;
        }
      }

      // 检查子菜单中是否有匹配的路径
      if (hasChildren(item)) {
        const children = 'children' in item ? item.children : [];
        if (children && checkChildrenMatch(children, path)) {
          return item.key;
        }
      }
    }
    return null;
  }, [menuItems, checkChildrenMatch]);

  // 路由变化时更新菜单状态
  useEffect(() => {
    updateByPath(location.pathname);

    // 根据当前路径自动选中对应的顶级菜单
    const matchedKey = findTopMenuKeyByPath(location.pathname);

    if (matchedKey) {
      setActiveTopMenuKey(matchedKey);
    } else if (menuItems.length > 0) {
      // 默认选中第一个
      setActiveTopMenuKey(menuItems[0].key);
    }
  }, [location.pathname, menuItems, updateByPath, setActiveTopMenuKey, findTopMenuKeyByPath]);

  // 路由变化时关闭移动端菜单
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname, setMobileMenuOpen]);

  // 用户菜单项 - 退出登录后优先跳转到 Casdoor
  const handleLogout = async () => {
    await logout();

    // 尝试获取 CAS 登录 URL 并跳转
    const casLoginUrl = await getCasLogoutRedirectUrl("/admin");
    if (casLoginUrl) {
      window.location.href = casLoginUrl;
    } else {
      // CAS 未启用，回退到前端登录页面
      navigate({ to: "/login" });
    }
  };

  const userMenuItems: MenuProps["items"] = [
    {
      key: "logout",
      icon: <LogOut className="w-4 h-4" />,
      label: "退出登录",
      danger: true,
      onClick: handleLogout,
    },
  ];

  // 动态生成面包屑
  const breadcrumbData = useMemo(
    () => generateBreadcrumbs(menuItems, location.pathname),
    [menuItems, location.pathname],
  );

  const breadcrumbItems = useMemo(() => {
    const items: Array<{ title: React.ReactNode }> = [
      { title: <Link to="/admin">首页</Link> },
    ];

    breadcrumbData.forEach((item, index) => {
      if (index === breadcrumbData.length - 1) {
        // 最后一项不可点击
        items.push({ title: item.label });
      } else if (item.path) {
        items.push({ title: <Link to={item.path}>{item.label}</Link> });
      } else {
        items.push({ title: item.label });
      }
    });

    return items;
  }, [breadcrumbData]);

  // 处理顶级菜单点击
  const handleTopMenuClick = (key: string, path?: string) => {
    setActiveTopMenuKey(key);

    // 如果菜单项有路径，直接导航
    if (path) {
      navigate({ to: path });
    } else {
      // 如果没有路径，查找第一个有路径的子菜单
      const menuItem = menuItems.find(item => item.key === key);
      if (menuItem && hasChildren(menuItem)) {
        const children = 'children' in menuItem ? menuItem.children : [];
        if (children && children.length > 0) {
          const firstChildWithPath = findFirstPath(children);
          if (firstChildWithPath) {
            navigate({ to: firstChildWithPath });
          }
        }
      }
    }
  };

  // 查找第一个有路径的子菜单
  const findFirstPath = (items: MenuItem[]): string | undefined => {
    for (const item of items) {
      if (isMenuNavItem(item) && item.path) {
        return item.path;
      }
      if (hasChildren(item)) {
        const children = 'children' in item ? item.children : [];
        if (children) {
          const path = findFirstPath(children);
          if (path) return path;
        }
      }
    }
    return undefined;
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-900 relative">
      {/* 顶部导航 */}
      <header
        className="h-16 glass border-b-0 flex items-center justify-between px-4 md:px-6 sticky top-0 z-50"
        style={{ boxShadow: "0 4px 24px rgba(0, 0, 0, 0.04)" }}
      >
        {/* 左侧：Logo + 一级菜单 */}
        <div className="flex items-center gap-6">
          {/* Logo */}
          <Link to="/admin" className="flex items-center gap-3 group flex-shrink-0">
            <Logo size={36} />
          </Link>

          {/* 桌面端一级菜单 */}
          {!isMobile && (
            <TopNavMenu
              items={topMenuItems}
              activeKey={activeTopMenuKey}
              onItemClick={handleTopMenuClick}
            />
          )}

          {/* 移动端菜单按钮 */}
          {isMobile && (
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="p-2 hover:bg-interactive rounded-xl transition-all duration-200 text-tertiary hover:text-default"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* 右侧：工具栏 */}
        <div className="flex items-center gap-1 md:gap-2">
          {/* 搜索按钮 */}
          <GlobalSearchTrigger />

          {/* 布局切换 - 仅桌面端显示 */}
          <div className="hidden md:block">
            <LayoutToggle />
          </div>

          {/* 主题切换 */}
          <ThemeToggle />

          <div className="hidden md:block w-px h-8 bg-border-muted mx-2" />

          {/* 用户菜单 */}
          <Dropdown menu={{ items: userMenuItems }} trigger={["click"]}>
            <button className="flex items-center gap-2 md:gap-3 py-1.5 px-1.5 md:px-2 hover:bg-interactive rounded-xl transition-all duration-200 group">
              <div className="relative">
                <Avatar
                  size={isMobile ? 32 : 36}
                  src={user?.avatar}
                  className={`${ADMIN_ACCENT_BG} shadow-md shadow-blue-500/20`}
                >
                  {user?.nickname?.charAt(0) ||
                    user?.username?.charAt(0) ||
                    "U"}
                </Avatar>
                <div className="absolute -bottom-0.5 -right-0.5 w-2.5 md:w-3 h-2.5 md:h-3 bg-green-500 rounded-full border-2 border-container" />
              </div>
              {/* 用户信息 - 移动端隐藏 */}
              <div className="hidden md:block text-left">
                <p className="text-sm font-medium text-default">
                  {user?.nickname || user?.username || "用户"}
                </p>
                <p className="text-xs text-muted">
                  {user?.roles?.[0] || "普通用户"}
                </p>
              </div>
              <ChevronDown className="hidden md:block w-4 h-4 text-muted group-hover:text-secondary transition-colors" />
            </button>
          </Dropdown>
        </div>
      </header>

      {/* 主体区域 */}
      <div className="flex flex-1">
        {/* 移动端遮罩层 */}
        {isMobile && mobileMenuOpen && (
          <div
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-30 transition-opacity duration-300"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}

        {/* 侧边栏 - 仅在有二级菜单时显示 */}
        {showSidebar && (
          <aside
            className={`
              fixed left-0 top-16 h-[calc(100vh-4rem)] glass border-r-0 transition-all duration-300 ease-out z-40
              ${
                isMobile
                  ? `w-64 ${mobileMenuOpen ? "translate-x-0" : "-translate-x-full"}`
                  : collapsed
                    ? "w-[72px]"
                    : "w-56"
              }
            `}
            style={{
              boxShadow: "4px 0 24px rgba(0, 0, 0, 0.06)",
            }}
          >
            {/* 侧边栏标题 */}
            <div className="h-12 flex items-center justify-between border-b border-muted px-4">
              {!collapsed && (
                <span className="text-sm font-medium text-secondary truncate">
                  {topMenuItems.find(item => item.key === activeTopMenuKey)?.label || '菜单'}
                </span>
              )}

              {/* 移动端关闭按钮 */}
              {isMobile && (
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-2 hover:bg-interactive rounded-xl transition-all duration-200 text-tertiary hover:text-default"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>

            {/* 菜单区域 - 二级菜单 */}
            <nav className="flex-1 sidebar-nav py-4 px-3 overflow-y-auto" style={{ height: 'calc(100% - 3rem)' }}>
              <MenuRenderer items={sideMenuItems} collapsed={!isMobile && collapsed} />
            </nav>

            {/* 折叠按钮 - 仅桌面端显示 */}
            {!isMobile && (
              <button
                onClick={() => setCollapsed(!collapsed)}
                className="absolute -right-3 cursor-pointer top-6 w-6 h-6 bg-container rounded-full flex items-center justify-center shadow-lg border border-default hover:bg-primary hover:border-transparent hover:text-white text-muted transition-all duration-200 group"
              >
                {collapsed ? (
                  <ChevronRight className="w-3.5 h-3.5" />
                ) : (
                  <ChevronLeft className="w-3.5 h-3.5" />
                )}
              </button>
            )}
          </aside>
        )}

        {/* 主内容区 */}
        <div
          className={`flex-1 flex flex-col transition-all duration-300 ${
            showSidebar
              ? isMobile
                ? "ml-0"
                : collapsed
                  ? "ml-[72px]"
                  : "ml-56"
              : "ml-0"
          }`}
        >
          {/* 面包屑导航 */}
          <div className="px-4 md:px-6 py-3 border-b border-muted bg-container/50">
            <Breadcrumb items={breadcrumbItems} />
          </div>

          {/* 页面内容 */}
          <main className="flex-1 p-4 md:p-6">{children ?? <Outlet />}</main>
        </div>
      </div>
    </div>
  );
}
