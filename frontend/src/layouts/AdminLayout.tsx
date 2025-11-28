import { Outlet, Link, useLocation, useNavigate } from '@tanstack/react-router'
import { useState, useEffect, type ReactNode } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  Bell,
  Search,
  User,
  LogOut,
  Settings,
  ChevronDown,
  LayoutDashboard,
  Users,
  Sparkles,
  Menu,
  X,
  Shield,
} from 'lucide-react'
import { Dropdown, Avatar, Badge, Breadcrumb } from 'antd'
import type { MenuProps } from 'antd'
import { useResponsive } from '@/hooks'
import { useAuthStore } from '@/stores'

interface AdminLayoutProps {
  children?: ReactNode
}

const SIDEBAR_COLLAPSED_KEY = 'admin_sidebar_collapsed'

/**
 * 后台管理布局
 * 包含侧边栏、顶部导航、面包屑等完整的后台管理界面布局
 * 采用现代 AI 产品风格：毛玻璃效果、柔和光晕
 */
export function AdminLayout({ children }: AdminLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_COLLAPSED_KEY)
    return saved === 'true'
  })
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const { isMobile } = useResponsive()
  const { user, logout } = useAuthStore()

  // 持久化侧边栏状态
  useEffect(() => {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(sidebarCollapsed))
  }, [sidebarCollapsed])

  // 路由变化时关闭移动端菜单
  useEffect(() => {
    setMobileMenuOpen(false)
  }, [location.pathname])
  
  // 检查菜单项是否激活
  const isMenuActive = (path: string) => {
    if (path === '/admin') {
      return location.pathname === '/admin' || location.pathname === '/admin/'
    }
    return location.pathname.startsWith(path)
  }

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

  // TODO: 从路由配置中动态生成面包屑
  const breadcrumbItems = [
    { title: <Link to="/admin">首页</Link> },
    { title: '当前页面' },
  ]

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
            : sidebarCollapsed ? 'w-[72px]' : 'w-64'
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
                !isMobile && sidebarCollapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'
              }`}
            >
              Zera
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

        {/* 菜单区域 */}
        <nav className="flex-1 overflow-y-auto py-6 px-3">
          {/* TODO: 动态渲染菜单项 */}
          <div className="space-y-1.5">
            <SidebarMenuItem
              icon={<LayoutDashboard className="w-5 h-5" />}
              label="仪表盘"
              to="/admin"
              collapsed={!isMobile && sidebarCollapsed}
              active={isMenuActive('/admin')}
            />
            <SidebarMenuItem
              icon={<Users className="w-5 h-5" />}
              label="用户管理"
              to="/admin/users"
              collapsed={!isMobile && sidebarCollapsed}
              active={isMenuActive('/admin/users')}
            />
            <SidebarMenuItem
              icon={<Shield className="w-5 h-5" />}
              label="角色管理"
              to="/admin/roles"
              collapsed={!isMobile && sidebarCollapsed}
              active={isMenuActive('/admin/roles')}
            />
            <SidebarMenuItem
              icon={<Settings className="w-5 h-5" />}
              label="系统设置"
              to="/admin/settings"
              collapsed={!isMobile && sidebarCollapsed}
              active={isMenuActive('/admin/settings')}
            />
          </div>
        </nav>

        {/* 折叠按钮 - 仅桌面端显示 */}
        {!isMobile && (
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="absolute -right-3 top-[54px] w-6 h-6 bg-white rounded-full flex items-center justify-center shadow-lg border border-gray-100 hover:bg-indigo-500 hover:border-transparent hover:text-white text-gray-400 transition-all duration-200 group"
          >
            {sidebarCollapsed ? (
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
          isMobile ? 'ml-0' : sidebarCollapsed ? 'ml-[72px]' : 'ml-64'
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
                <span className="text-lg font-bold text-gray-900">Zera</span>
              </Link>
            )}
          </div>

          {/* 右侧：工具栏 */}
          <div className="flex items-center gap-1 md:gap-2">
            {/* 搜索 - 移动端隐藏 */}
            <button className="hidden md:flex p-2.5 hover:bg-white/60 rounded-xl transition-all duration-200 text-gray-500 hover:text-gray-700 hover:shadow-sm">
              <Search className="w-5 h-5" />
            </button>

            {/* 通知 */}
            <Badge count={5} size="small" offset={[-2, 2]}>
              <button className="p-2 md:p-2.5 hover:bg-white/60 rounded-xl transition-all duration-200 text-gray-500 hover:text-gray-700 hover:shadow-sm">
                <Bell className="w-5 h-5" />
              </button>
            </Badge>

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

/**
 * 侧边栏菜单项
 * 带有悬停动效
 */
interface SidebarMenuItemProps {
  icon: ReactNode
  label: string
  to: string
  collapsed?: boolean
  active?: boolean
}

function SidebarMenuItem({
  icon,
  label,
  to,
  collapsed,
  active,
}: SidebarMenuItemProps) {
  return (
    <Link
      to={to}
      className={`
        flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 relative overflow-hidden group
        ${active 
          ? 'bg-indigo-50 text-indigo-600 shadow-sm' 
          : 'text-gray-500 hover:bg-white/60 hover:text-gray-700 hover:shadow-sm'
        }
      `}
      title={collapsed ? label : undefined}
    >
      {/* 激活指示条 */}
      <div 
        className={`
          absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full bg-indigo-500 transition-all duration-200
          ${active ? 'opacity-100' : 'opacity-0 group-hover:opacity-50'}
        `}
      />
      
      <span className={`flex-shrink-0 transition-transform duration-200 ${active ? 'scale-110' : 'group-hover:scale-105'}`}>
        {icon}
      </span>
      
      {/* 使用固定宽度和 overflow hidden 避免换行抖动 */}
      <span 
        className={`text-sm font-medium whitespace-nowrap overflow-hidden transition-all duration-300 ${
          collapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'
        }`}
      >
        {label}
      </span>
      
      {/* 激活状态指示点 - 仅在展开时显示 */}
      {!collapsed && (
        <div 
          className={`absolute right-3 w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse transition-opacity duration-200 ${
            active ? 'opacity-100' : 'opacity-0'
          }`}
        />
      )}
    </Link>
  )
}
