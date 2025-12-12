/**
 * 布局切换组件
 * 用于在侧边栏布局和顶部导航布局之间切换
 */

import { LayoutDashboard, LayoutPanelTop } from 'lucide-react'
import { Tooltip } from 'antd'
import { useLayoutStore, type LayoutMode } from '@/stores'

/**
 * 布局切换按钮
 */
export function LayoutToggle() {
  const { layoutMode, setLayoutMode } = useLayoutStore()

  const layouts: Array<{
    mode: LayoutMode
    icon: typeof LayoutDashboard
    label: string
  }> = [
    {
      mode: 'sidebar',
      icon: LayoutDashboard,
      label: '侧边栏布局',
    },
    {
      mode: 'topnav',
      icon: LayoutPanelTop,
      label: '顶部导航布局',
    },
  ]

  return (
    <div className="flex items-center gap-0.5 p-1 rounded-lg bg-subtle">
      {layouts.map(({ mode, icon: Icon, label }) => {
        const isActive = layoutMode === mode

        return (
          <Tooltip key={mode} title={label} placement="bottom">
            <button
              onClick={() => setLayoutMode(mode)}
              className={`
                p-2 rounded-md transition-all duration-200 cursor-pointer
                ${
                  isActive
                    ? 'bg-container text-primary shadow-sm'
                    : 'text-muted hover:text-secondary'
                }
              `}
            >
              <Icon className="w-4 h-4" />
            </button>
          </Tooltip>
        )
      })}
    </div>
  )
}

export default LayoutToggle
