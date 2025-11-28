import { createLazyRoute } from '@tanstack/react-router'
import { Card, Row, Col, Statistic } from 'antd'
import { Users, UserCheck, UserX, Activity } from 'lucide-react'
import { useAuthStore } from '@/stores'

export const Route = createLazyRoute('/admin/')({
  component: Dashboard,
})

/**
 * 仪表盘页面
 */
function Dashboard() {
  const user = useAuthStore((state) => state.user)

  return (
    <div className="space-y-6">
      {/* 欢迎信息 */}
      <div className="p-6 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/25">
        <h1 className="text-2xl md:text-3xl font-bold mb-2">
          欢迎回来，{user?.nickname || user?.username}！
        </h1>
        <p className="text-indigo-100">
          这是您的管理仪表盘，可以查看系统概况和快速访问各项功能。
        </p>
      </div>

      {/* 统计卡片 */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card className="!rounded-2xl !border-white/50 !bg-white/70 backdrop-blur-sm shadow-sm hover:shadow-md transition-shadow">
            <Statistic
              title="总用户数"
              value={1234}
              prefix={<Users className="w-5 h-5 text-indigo-500" />}
              valueStyle={{ color: '#6366f1' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="!rounded-2xl !border-white/50 !bg-white/70 backdrop-blur-sm shadow-sm hover:shadow-md transition-shadow">
            <Statistic
              title="活跃用户"
              value={856}
              prefix={<UserCheck className="w-5 h-5 text-green-500" />}
              valueStyle={{ color: '#22c55e' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="!rounded-2xl !border-white/50 !bg-white/70 backdrop-blur-sm shadow-sm hover:shadow-md transition-shadow">
            <Statistic
              title="未激活"
              value={378}
              prefix={<UserX className="w-5 h-5 text-orange-500" />}
              valueStyle={{ color: '#f97316' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="!rounded-2xl !border-white/50 !bg-white/70 backdrop-blur-sm shadow-sm hover:shadow-md transition-shadow">
            <Statistic
              title="今日活跃"
              value={234}
              prefix={<Activity className="w-5 h-5 text-purple-500" />}
              valueStyle={{ color: '#a855f7' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 快速操作 */}
      <Card 
        title="快速操作" 
        className="!rounded-2xl !border-white/50 !bg-white/70 backdrop-blur-sm shadow-sm"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <QuickActionCard
            icon={<Users className="w-6 h-6" />}
            title="用户管理"
            description="管理系统用户"
            link="/admin/users"
          />
          <QuickActionCard
            icon={<Activity className="w-6 h-6" />}
            title="系统日志"
            description="查看系统日志"
            link="/admin/logs"
          />
          <QuickActionCard
            icon={<Activity className="w-6 h-6" />}
            title="系统设置"
            description="配置系统参数"
            link="/admin/settings"
          />
        </div>
      </Card>
    </div>
  )
}

/**
 * 快速操作卡片
 */
function QuickActionCard({
  icon,
  title,
  description,
  link,
}: {
  icon: React.ReactNode
  title: string
  description: string
  link: string
}) {
  return (
    <a
      href={link}
      className="block p-4 rounded-xl bg-gradient-to-br from-white to-gray-50 border border-gray-100 hover:border-indigo-200 hover:shadow-md transition-all duration-200 group"
    >
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 w-12 h-12 flex items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/25 group-hover:scale-110 transition-transform">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 mb-1">{title}</h3>
          <p className="text-sm text-gray-500">{description}</p>
        </div>
      </div>
    </a>
  )
}
