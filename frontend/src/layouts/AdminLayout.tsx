import { Outlet, Link, useLocation, useNavigate } from '@tanstack/react-router'
import React, { useEffect, useMemo, type ReactNode } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  User,
  LogOut,
  Settings,
  ChevronDown,
  Sparkles,
  Menu,
  X,
} from 'lucide-react'
import { Dropdown, Avatar, Breadcrumb } from 'antd'
import type { MenuProps } from 'antd'
import { useResponsive } from '@/hooks'
import { useAuthStore, useMenuStore, useSiteStore } from '@/stores'
import { MenuRenderer } from '@/components/menu'
import { GlobalSearchTrigger } from '@/components/GlobalSearch'
import { initAdminMenus, generateBreadcrumbs } from '@/config/menu'

interface AdminLayoutProps {
  children?: ReactNode
}

// 初始化菜单（只执行一次）
let menuInitialized = false
function ensureMenuInitialized() {
  if (!menuInitialized) {
    initAdminMenus()
    menuInitialized = true
  }
}

/**
 * 后台管理布局
 * 包含侧边栏、顶部导航、面包屑等完整的后台管理界面布局
 * 采用现代 AI 产品风格：毛玻璃效果、柔和光晕
 */
export function AdminLayout({ children }: AdminLayoutProps) {
  // 确保菜单已初始化
  ensureMenuInitialized()

  const location = useLocation()
  const navigate = useNavigate()
  const { isMobile } = useResponsive()
  const { user, logout } = useAuthStore()
  
  // 使用菜单状态管理
  const {
    collapsed,
    mobileMenuOpen,
    setCollapsed,
    setMobileMenuOpen,
    updateByPath,
    getMenuItems,
  } = useMenuStore()

  // 获取站点设置
  const siteName = useSiteStore((state) => state.siteName)

  // 路由变化时更新菜单状态
  useEffect(() => {
    updateByPath(location.pathname)
  }, [location.pathname, updateByPath])

  // 路由变化时关闭移动端菜单
  useEffect(() => {
    setMobileMenuOpen(false)
  }, [location.pathname, setMobileMenuOpen])

  // 获取菜单项
  const menuItems = useMemo(() => getMenuItems(), [getMenuItems])

  // 用户菜单项
  const handleLogout = async () => {
    await logout()
    navigate({ to: '/login' })
  }

  const userMenuItems: MenuProps['items'] = [
    {
      key: 'profile',
      icon: <User className="w-4 h-4" />,
      label: '个人中心',
    },
    {
      key: 'settings',
      icon: <Settings className="w-4 h-4" />,
      label: '账号设置',
    },
    {
      type: 'divider',
    },
    {
      key: 'logout',
      icon: <LogOut className="w-4 h-4" />,
      label: '退出登录',
      danger: true,
      onClick: handleLogout,
    },
  ]

  // 动态生成面包屑
  const breadcrumbData = useMemo(
    () => generateBreadcrumbs(menuItems, location.pathname),
    [menuItems, location.pathname]
  )

  const breadcrumbItems = useMemo(() => {
    const items: Array<{ title: React.ReactNode }> = [{ title: <Link to="/admin">首页</Link> }]
    
    breadcrumbData.forEach((item, index) => {
      if (index === breadcrumbData.length - 1) {
        // 最后一项不可点击
        items.push({ title: item.label })
      } else if (item.path) {
        items.push({ title: <Link to={item.path}>{item.label}</Link> })
      } else {
        items.push({ title: item.label })
      }
    })
    
    return items
  }, [breadcrumbData])

  return (
    <div className="min-h-screen flex bg-slate-50 relative">
      {/* 移动端遮罩层 */}
      {isMobile && mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-30 transition-opacity duration-300"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* 侧边栏 - 桌面端固定，移动端抽屉式 */}
      <aside
        className={`
          fixed left-0 top-0 h-full glass border-r-0 transition-all duration-300 ease-out z-40
          ${isMobile 
            ? `w-64 ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}` 
            : collapsed ? 'w-[72px]' : 'w-64'
          }
        `}
        style={{
          boxShadow: '4px 0 24px rgba(0, 0, 0, 0.06)',
        }}
      >
        {/* Logo */}
        <div className="h-16 flex items-center justify-between border-b border-white/20 px-4">
          <Link to="/admin" className="flex items-center gap-3 group">
            <div className="w-9 h-9 flex-shrink-0 bg-indigo-500 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/25 group-hover:shadow-indigo-500/40 transition-shadow duration-300">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <span 
              className={`text-xl font-bold text-gray-900 whitespace-nowrap overflow-hidden transition-all duration-300 ${
                !isMobile && collapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'
              }`}
            >
              {siteName}
            </span>
          </Link>
          
          {/* 移动端关闭按钮 */}
          {isMobile && (
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="p-2 hover:bg-white/60 rounded-xl transition-all duration-200 text-gray-500 hover:text-gray-700"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* 菜单区域 - 使用新的菜单渲染器 */}
        <nav className="flex-1 overflow-y-auto py-4 px-3">
          <MenuRenderer
            items={menuItems}
            collapsed={!isMobile && collapsed}
          />
        </nav>

        {/* 折叠按钮 - 仅桌面端显示 */}
        {!isMobile && (
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="absolute -right-3 cursor-pointer  top-[54px] w-6 h-6 bg-white rounded-full flex items-center justify-center shadow-lg border border-gray-100 hover:bg-indigo-500 hover:border-transparent hover:text-white text-gray-400 transition-all duration-200 group"
          >
            {collapsed ? (
              <ChevronRight className="w-3.5 h-3.5" />
            ) : (
              <ChevronLeft className="w-3.5 h-3.5" />
            )}
          </button>
        )}
      </aside>

      {/* 主内容区 */}
      <div
        className={`flex-1 transition-all duration-300 ${
          isMobile ? 'ml-0' : collapsed ? 'ml-[72px]' : 'ml-64'
        }`}
      >
        {/* 顶部导航 */}
        <header className="h-16 glass border-b-0 flex items-center justify-between px-4 md:px-6 sticky top-0 z-30" style={{ boxShadow: '0 4px 24px rgba(0, 0, 0, 0.04)' }}>
          {/* 左侧：移动端菜单按钮 + 面包屑 */}
          <div className="flex items-center gap-3">
            {/* 移动端菜单按钮 */}
            {isMobile && (
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="p-2 hover:bg-white/60 rounded-xl transition-all duration-200 text-gray-500 hover:text-gray-700"
              >
                <Menu className="w-5 h-5" />
              </button>
            )}
            
            {/* 面包屑 - 移动端隐藏 */}
            <div className="hidden md:block">
              <Breadcrumb items={breadcrumbItems} />
            </div>
            
            {/* 移动端 Logo */}
            {isMobile && (
              <Link to="/admin" className="flex items-center gap-2">
                <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center shadow-md shadow-indigo-500/25">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <span className="text-lg font-bold text-gray-900">{siteName}</span>
              </Link>
            )}
          </div>

          {/* 右侧：工具栏 */}
          <div className="flex items-center gap-1 md:gap-2">
            {/* 搜索按钮 */}
            <GlobalSearchTrigger />

            <div className="hidden md:block w-px h-8 bg-gray-200/60 mx-2" />

            {/* 用户菜单 */}
            <Dropdown menu={{ items: userMenuItems }} trigger={['click']}>
              <button className="flex items-center gap-2 md:gap-3 py-1.5 px-1.5 md:px-2 hover:bg-white/60 rounded-xl transition-all duration-200 group">
                <div className="relative">
                  <Avatar 
                    size={isMobile ? 32 : 36} 
                    src={user?.avatar}
                    className="bg-indigo-500 shadow-md shadow-indigo-500/20"
                  >
                    {user?.nickname?.charAt(0) || user?.username?.charAt(0) || 'U'}
                  </Avatar>
                  <div className="absolute -bottom-0.5 -right-0.5 w-2.5 md:w-3 h-2.5 md:h-3 bg-green-500 rounded-full border-2 border-white" />
                </div>
                {/* 用户信息 - 移动端隐藏 */}
                <div className="hidden md:block text-left">
                  <p className="text-sm font-medium text-gray-700">{user?.nickname || user?.username || '用户'}</p>
                  <p className="text-xs text-gray-400">{user?.roles?.[0] || '普通用户'}</p>
                </div>
                <ChevronDown className="hidden md:block w-4 h-4 text-gray-400 group-hover:text-gray-600 transition-colors" />
              </button>
            </Dropdown>
          </div>
        </header>

        {/* 页面内容 */}
        <main className="p-4 md:p-6">
          {children ?? <Outlet />}
        </main>
      </div>
    </div>
  )
}
