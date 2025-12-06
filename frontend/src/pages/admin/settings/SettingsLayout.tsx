import { createLazyRoute, Outlet, Link, useLocation } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { Settings, Shield, Building2 } from 'lucide-react'
import { Menu } from 'antd'
import type { MenuProps } from 'antd'

export const Route = createLazyRoute('/admin/settings')({  
  component: SettingsLayout,
})

type MenuItem = Required<MenuProps>['items'][number]

/**
 * 自定义 Hook：检测是否为移动端
 */
function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(() => 
    typeof window !== 'undefined' ? window.innerWidth < breakpoint : false
  )

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < breakpoint)
    }
    
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [breakpoint])

  return isMobile
}

/**
 * 设置页面布局
 * 包含左侧设置菜单导航
 */
function SettingsLayout() {
  const location = useLocation()
  const isMobile = useIsMobile()

  // TODO: 添加更多设置路由时需要在 routes.tsx 中同步注册
  const menuItems: MenuItem[] = [
    {
      key: '/admin/settings/general',
      icon: <Settings className="w-4 h-4" />,
      label: <Link to="/admin/settings/general">基础设置</Link>,
    },
    {
      key: '/admin/settings/security',
      icon: <Shield className="w-4 h-4" />,
      label: <Link to="/admin/settings/security">安全设置</Link>,
    },
    {
      key: '/admin/settings/cas',
      icon: <Building2 className="w-4 h-4" />,
      label: <Link to="/admin/settings/cas">CAS 单点登录</Link>,
    },
    // TODO: 实现通知设置路由
    // {
    //   key: '/admin/settings/notifications',
    //   icon: <Bell className="w-4 h-4" />,
    //   label: <Link to="/admin/settings/notifications">通知设置</Link>,
    // },
    // TODO: 实现备份管理路由
    // {
    //   key: '/admin/settings/backup',
    //   icon: <Database className="w-4 h-4" />,
    //   label: <Link to="/admin/settings/backup">备份管理</Link>,
    // },
  ]

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div>
        <h1 className="text-xl md:text-2xl font-semibold text-gray-900">系统设置</h1>
        <p className="mt-1 text-sm text-gray-500">
          配置系统的各项参数和选项
        </p>
      </div>

      {/* 设置内容区域 */}
      <div className="flex flex-col md:flex-row gap-4 md:gap-6">
        {/* 菜单 - 移动端水平显示，桌面端垂直显示 */}
        <div className="w-full md:w-56 flex-shrink-0 overflow-x-auto">
          <Menu
            mode={isMobile ? 'horizontal' : 'vertical'}
            selectedKeys={[location.pathname]}
            items={menuItems}
            className={`rounded-lg border border-gray-200 ${isMobile ? 'min-w-max' : ''}`}
          />
        </div>

        {/* 右侧内容 */}
        <div className="flex-1 min-w-0">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
