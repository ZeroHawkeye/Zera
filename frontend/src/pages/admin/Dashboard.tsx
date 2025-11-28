import { createLazyRoute } from '@tanstack/react-router'
import { Card, Row, Col, Statistic } from 'antd'
import { Users, FileText, ShoppingCart, TrendingUp } from 'lucide-react'

export const Route = createLazyRoute('/admin/')({
  component: Dashboard,
})

/**
 * 仪表盘页面
 * 展示系统核心数据概览
 */
function Dashboard() {
  // TODO: 从 API 获取统计数据
  const stats = {
    totalUsers: 1234,
    totalOrders: 5678,
    totalRevenue: 123456,
    growthRate: 12.5,
  }

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">仪表盘</h1>
        <p className="mt-1 text-sm text-gray-500">
          欢迎回来，这是您的系统概览
        </p>
      </div>

      {/* 统计卡片 */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card className="hover:shadow-md transition-shadow">
            <Statistic
              title={
                <span className="flex items-center gap-2 text-gray-600">
                  <Users className="w-4 h-4" />
                  总用户数
                </span>
              }
              value={stats.totalUsers}
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="hover:shadow-md transition-shadow">
            <Statistic
              title={
                <span className="flex items-center gap-2 text-gray-600">
                  <ShoppingCart className="w-4 h-4" />
                  总订单数
                </span>
              }
              value={stats.totalOrders}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="hover:shadow-md transition-shadow">
            <Statistic
              title={
                <span className="flex items-center gap-2 text-gray-600">
                  <FileText className="w-4 h-4" />
                  总收入
                </span>
              }
              value={stats.totalRevenue}
              precision={2}
              prefix="¥"
              valueStyle={{ color: '#cf1322' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="hover:shadow-md transition-shadow">
            <Statistic
              title={
                <span className="flex items-center gap-2 text-gray-600">
                  <TrendingUp className="w-4 h-4" />
                  增长率
                </span>
              }
              value={stats.growthRate}
              precision={1}
              suffix="%"
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
      </Row>

      {/* TODO: 添加图表和更多数据展示 */}
      <Card title="最近活动" className="mt-6">
        <p className="text-gray-500 text-center py-8">
          暂无数据
        </p>
      </Card>
    </div>
  )
}
