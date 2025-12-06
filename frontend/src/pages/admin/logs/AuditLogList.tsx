import { createLazyRoute } from '@tanstack/react-router'
import { useState, useEffect, useCallback } from 'react'
import {
  Table,
  Card,
  Tag,
  Input,
  Select,
  DatePicker,
  Button,
  Modal,
  Descriptions,
  Empty,
  Skeleton,
  Pagination,
  Tooltip,
} from 'antd'
import {
  Search,
  RefreshCw,
  Eye,
  Clock,
  User,
  Globe,
  Activity,
  AlertCircle,
  CheckCircle,
  Info,
  Bug,
  AlertTriangle,
  X,
  Filter,
} from 'lucide-react'
import type { ColumnsType } from 'antd/es/table'
import dayjs, { Dayjs } from 'dayjs'
import { useResponsive } from '@/hooks'
import {
  auditLogApi,
  LogLevel,
  LogLevelNames,
  type AuditLogEntry,
  type GetAuditLogStatsResponse,
} from '@/api/audit_log'

export const Route = createLazyRoute('/admin/logs/')({
  component: AuditLogList,
})

/**
 * 日志级别图标映射
 */
const LogLevelIcons: Record<LogLevel, React.ReactNode> = {
  [LogLevel.UNSPECIFIED]: <Info className="w-3.5 h-3.5" />,
  [LogLevel.DEBUG]: <Bug className="w-3.5 h-3.5" />,
  [LogLevel.INFO]: <CheckCircle className="w-3.5 h-3.5" />,
  [LogLevel.WARNING]: <AlertTriangle className="w-3.5 h-3.5" />,
  [LogLevel.ERROR]: <AlertCircle className="w-3.5 h-3.5" />,
}

/**
 * 日志级别 Tag 颜色
 */
const getLevelTagColor = (level: LogLevel): string => {
  const colors: Record<LogLevel, string> = {
    [LogLevel.UNSPECIFIED]: 'default',
    [LogLevel.DEBUG]: 'default',
    [LogLevel.INFO]: 'processing',
    [LogLevel.WARNING]: 'warning',
    [LogLevel.ERROR]: 'error',
  }
  return colors[level] || 'default'
}

/**
 * 筛选参数接口
 */
interface FilterParams {
  level: LogLevel
  module: string
  action: string
  username: string
  ip: string
  keyword: string
  dateRange: [Dayjs | null, Dayjs | null] | null
}

/**
 * 移动端日志卡片
 */
function LogCard({
  log,
  onViewDetail,
}: {
  log: AuditLogEntry
  onViewDetail: (log: AuditLogEntry) => void
}) {
  return (
    <div
      className="p-4 rounded-2xl bg-white/70 backdrop-blur-sm border border-white/50 shadow-sm hover:shadow-md transition-all duration-300 cursor-pointer active:scale-[0.99]"
      onClick={() => onViewDetail(log)}
    >
      {/* 头部：级别 + 时间 */}
      <div className="flex items-center justify-between mb-3">
        <Tag
          color={getLevelTagColor(log.level)}
          icon={LogLevelIcons[log.level]}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
        >
          {LogLevelNames[log.level]}
        </Tag>
        <span className="text-xs text-gray-400">
          {log.createdAt ? dayjs(log.createdAt).format('MM-DD HH:mm:ss') : '-'}
        </span>
      </div>

      {/* 操作信息 */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm">
          <Activity className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <span className="text-gray-600 truncate">
            {log.module && <span className="font-medium">[{log.module}]</span>} {log.action}
          </span>
        </div>

        {/* 用户信息 */}
        <div className="flex items-center gap-2 text-sm">
          <User className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <span className="text-gray-500 truncate">{log.username || '系统'}</span>
        </div>

        {/* IP + 路径 */}
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <Globe className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="truncate">{log.ip || '-'}</span>
          <span className="mx-1">•</span>
          <span className="truncate flex-1">{log.path || '-'}</span>
        </div>
      </div>

      {/* 错误信息 */}
      {log.errorMessage && (
        <div className="mt-2 p-2 rounded-lg bg-red-50 text-red-600 text-xs truncate">
          {log.errorMessage}
        </div>
      )}
    </div>
  )
}

/**
 * 统计卡片组件
 */
function StatsCards({
  stats,
  loading,
  isMobile,
}: {
  stats: GetAuditLogStatsResponse | null
  loading: boolean
  isMobile: boolean
}) {
  if (loading) {
    return (
      <div 
        className="grid gap-3 md:gap-4"
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}
      >
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="!rounded-xl !bg-white/70 backdrop-blur-sm !p-3 md:!p-4">
            <Skeleton.Input active className="!w-full !h-12 md:!h-16" />
          </Card>
        ))}
      </div>
    )
  }

  if (!stats) return null

  const infoCount = stats.levelCounts['info'] ?? BigInt(0)
  const warningCount = stats.levelCounts['warning'] ?? BigInt(0)
  const errorCount = stats.levelCounts['error'] ?? BigInt(0)

  const statItems = [
    {
      title: '总日志',
      value: Number(stats.total),
      icon: <Activity className="w-4 h-4 md:w-5 md:h-5" />,
      color: 'from-blue-500 to-blue-600',
      bgColor: 'bg-blue-50',
      textColor: 'text-blue-600',
    },
    {
      title: 'INFO',
      value: Number(infoCount),
      icon: <CheckCircle className="w-4 h-4 md:w-5 md:h-5" />,
      color: 'from-green-500 to-green-600',
      bgColor: 'bg-green-50',
      textColor: 'text-green-600',
    },
    {
      title: 'WARN',
      value: Number(warningCount),
      icon: <AlertTriangle className="w-4 h-4 md:w-5 md:h-5" />,
      color: 'from-orange-500 to-orange-600',
      bgColor: 'bg-orange-50',
      textColor: 'text-orange-600',
    },
    {
      title: 'ERROR',
      value: Number(errorCount),
      icon: <AlertCircle className="w-4 h-4 md:w-5 md:h-5" />,
      color: 'from-red-500 to-red-600',
      bgColor: 'bg-red-50',
      textColor: 'text-red-600',
    },
  ]

  return (
    <div 
      className="grid gap-3 md:gap-4"
      style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}
    >
      {statItems.map((item) => (
        <Card
          key={item.title}
          className="!rounded-xl !border-white/50 !bg-white/70 backdrop-blur-sm hover:shadow-md transition-shadow"
          styles={{ body: { padding: isMobile ? '12px' : '16px' } }}
        >
          <div className="flex items-center gap-2 md:gap-3">
            <div className={`p-2 md:p-2.5 rounded-lg md:rounded-xl ${item.bgColor}`}>
              <div className={item.textColor}>{item.icon}</div>
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs text-gray-500 truncate">{item.title}</div>
              <div className={`text-lg md:text-xl font-bold ${item.textColor} truncate`}>
                {item.value.toLocaleString()}
              </div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}

/**
 * 日志详情模态框
 */
function LogDetailModal({
  log,
  open,
  onClose,
  isMobile,
}: {
  log: AuditLogEntry | null
  open: boolean
  onClose: () => void
  isMobile: boolean
}) {
  if (!log) return null

  return (
    <Modal
      title={
        <div className="flex items-center gap-2">
          <Eye className="w-5 h-5 text-blue-500" />
          <span>日志详情</span>
        </div>
      }
      open={open}
      onCancel={onClose}
      footer={
        <Button onClick={onClose} block={isMobile}>关闭</Button>
      }
      width={isMobile ? '100%' : 720}
      style={isMobile ? { top: 20, maxWidth: '100%', margin: '0 10px' } : undefined}
      className="!rounded-2xl"
    >
      <Descriptions column={{ xs: 1, sm: 2 }} bordered size="small" className="mt-4">
        <Descriptions.Item label="日志级别">
          <Tag
            color={getLevelTagColor(log.level)}
            icon={LogLevelIcons[log.level]}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
          >
            {LogLevelNames[log.level]}
          </Tag>
        </Descriptions.Item>
        <Descriptions.Item label="创建时间">
          {log.createdAt ? dayjs(log.createdAt).format('YYYY-MM-DD HH:mm:ss') : '-'}
        </Descriptions.Item>
        <Descriptions.Item label="模块">{log.module || '-'}</Descriptions.Item>
        <Descriptions.Item label="操作">{log.action || '-'}</Descriptions.Item>
        <Descriptions.Item label="资源类型">{log.resource || '-'}</Descriptions.Item>
        <Descriptions.Item label="资源ID">{log.resourceId || '-'}</Descriptions.Item>
        <Descriptions.Item label="操作用户">{log.username || '系统'}</Descriptions.Item>
        <Descriptions.Item label="用户ID">{log.userId || '-'}</Descriptions.Item>
        <Descriptions.Item label="IP地址">{log.ip || '-'}</Descriptions.Item>
        <Descriptions.Item label="请求方法">
          <Tag color="blue">{log.method || '-'}</Tag>
        </Descriptions.Item>
        <Descriptions.Item label="请求路径" span={2}>
          <code className="text-xs bg-gray-100 px-2 py-1 rounded">{log.path || '-'}</code>
        </Descriptions.Item>
        <Descriptions.Item label="状态码">
          <Tag color={log.statusCode >= 400 ? 'error' : 'success'}>
            {log.statusCode || '-'}
          </Tag>
        </Descriptions.Item>
        <Descriptions.Item label="耗时">
          {log.durationMs ? `${log.durationMs}ms` : '-'}
        </Descriptions.Item>
        <Descriptions.Item label="User-Agent" span={2}>
          <div className="text-xs text-gray-500 break-all max-h-20 overflow-auto">
            {log.userAgent || '-'}
          </div>
        </Descriptions.Item>
        {log.errorMessage && (
          <Descriptions.Item label="错误信息" span={2}>
            <div className="text-red-600 text-sm bg-red-50 p-2 rounded">
              {log.errorMessage}
            </div>
          </Descriptions.Item>
        )}
        {log.details && (
          <Descriptions.Item label="详细信息" span={2}>
            <pre className="text-xs bg-gray-50 p-2 rounded overflow-auto max-h-40">
              {log.details}
            </pre>
          </Descriptions.Item>
        )}
      </Descriptions>
    </Modal>
  )
}

/**
 * 审计日志列表页面
 */
function AuditLogList() {
  const { isMobile } = useResponsive()

  // 数据状态
  const [logs, setLogs] = useState<AuditLogEntry[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [stats, setStats] = useState<GetAuditLogStatsResponse | null>(null)
  const [statsLoading, setStatsLoading] = useState(false)
  const [modules, setModules] = useState<string[]>([])

  // 分页状态
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20 })

  // 筛选状态
  const [filters, setFilters] = useState<FilterParams>({
    level: LogLevel.UNSPECIFIED,
    module: '',
    action: '',
    username: '',
    ip: '',
    keyword: '',
    dateRange: null,
  })

  // 展开筛选面板
  const [showFilters, setShowFilters] = useState(false)

  // 详情模态框
  const [detailModalOpen, setDetailModalOpen] = useState(false)
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null)

  // 加载日志列表
  const loadLogs = useCallback(async () => {
    setLoading(true)
    try {
      const params = {
        page: pagination.page,
        pageSize: pagination.pageSize,
        level: filters.level,
        module: filters.module,
        action: filters.action,
        username: filters.username,
        ip: filters.ip,
        keyword: filters.keyword,
        startTime: filters.dateRange?.[0]?.toISOString() ?? '',
        endTime: filters.dateRange?.[1]?.toISOString() ?? '',
        descending: true,
      }
      const response = await auditLogApi.listAuditLogs(params)
      setLogs(response.logs)
      setTotal(Number(response.total))
    } catch (error) {
      console.error('Failed to load audit logs:', error)
    } finally {
      setLoading(false)
    }
  }, [pagination, filters])

  // 加载统计数据
  const loadStats = useCallback(async () => {
    setStatsLoading(true)
    try {
      const response = await auditLogApi.getAuditLogStats({
        startTime: filters.dateRange?.[0]?.toISOString() ?? '',
        endTime: filters.dateRange?.[1]?.toISOString() ?? '',
      })
      setStats(response)
    } catch (error) {
      console.error('Failed to load audit log stats:', error)
    } finally {
      setStatsLoading(false)
    }
  }, [filters.dateRange])

  // 加载模块列表
  const loadModules = useCallback(async () => {
    try {
      const response = await auditLogApi.listAuditLogModules()
      setModules(response.modules)
    } catch (error) {
      console.error('Failed to load modules:', error)
    }
  }, [])

  // 初始化加载
  useEffect(() => {
    loadModules()
  }, [loadModules])

  useEffect(() => {
    loadLogs()
  }, [loadLogs])

  useEffect(() => {
    loadStats()
  }, [loadStats])

  // 刷新数据
  const handleRefresh = () => {
    loadLogs()
    loadStats()
  }

  // 重置筛选
  const handleResetFilters = () => {
    setFilters({
      level: LogLevel.UNSPECIFIED,
      module: '',
      action: '',
      username: '',
      ip: '',
      keyword: '',
      dateRange: null,
    })
    setPagination({ page: 1, pageSize: 20 })
  }

  // 查看详情
  const handleViewDetail = (log: AuditLogEntry) => {
    setSelectedLog(log)
    setDetailModalOpen(true)
  }

  // 表格列配置
  const columns: ColumnsType<AuditLogEntry> = [
    {
      title: '级别',
      dataIndex: 'level',
      key: 'level',
      width: 100,
      render: (level: LogLevel) => (
        <Tag
          color={getLevelTagColor(level)}
          icon={LogLevelIcons[level]}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
        >
          {LogLevelNames[level]}
        </Tag>
      ),
    },
    {
      title: '模块/操作',
      key: 'moduleAction',
      width: 200,
      render: (_, record) => (
        <div>
          <div className="font-medium text-gray-900">
            {record.module && <span className="text-blue-600">[{record.module}]</span>} {record.action}
          </div>
          {record.resource && (
            <div className="text-xs text-gray-400 mt-0.5">
              资源: {record.resource} {record.resourceId && `#${record.resourceId}`}
            </div>
          )}
        </div>
      ),
    },
    {
      title: '操作用户',
      dataIndex: 'username',
      key: 'username',
      width: 120,
      render: (username: string) => (
        <div className="flex items-center gap-2">
          <User className="w-4 h-4 text-gray-400" />
          <span>{username || '系统'}</span>
        </div>
      ),
    },
    {
      title: 'IP地址',
      dataIndex: 'ip',
      key: 'ip',
      width: 130,
      render: (ip: string) => (
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-gray-400" />
          <span className="font-mono text-sm">{ip || '-'}</span>
        </div>
      ),
    },
    {
      title: '请求路径',
      dataIndex: 'path',
      key: 'path',
      width: 200,
      ellipsis: true,
      render: (path: string, record) => (
        <Tooltip title={path}>
          <div className="flex items-center gap-2">
            {record.method && (
              <Tag color="blue" className="!text-xs">
                {record.method}
              </Tag>
            )}
            <span className="truncate text-gray-600">{path || '-'}</span>
          </div>
        </Tooltip>
      ),
    },
    {
      title: '状态',
      key: 'status',
      width: 100,
      render: (_, record) => (
        <div className="flex flex-col gap-1">
          {record.statusCode > 0 && (
            <Tag color={record.statusCode >= 400 ? 'error' : 'success'} className="!text-xs">
              {record.statusCode}
            </Tag>
          )}
          {record.durationMs > 0 && (
            <span className="text-xs text-gray-400">{Number(record.durationMs)}ms</span>
          )}
        </div>
      ),
    },
    {
      title: '时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
      render: (createdAt: string) => (
        <div className="flex items-center gap-2 text-gray-500">
          <Clock className="w-4 h-4" />
          <span>{createdAt ? dayjs(createdAt).format('YYYY-MM-DD HH:mm:ss') : '-'}</span>
        </div>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 80,
      fixed: 'right',
      render: (_, record) => (
        <Tooltip title="查看详情">
          <Button
            type="text"
            size="small"
            icon={<Eye className="w-4 h-4" />}
            onClick={() => handleViewDetail(record)}
            className="!text-gray-500 hover:!text-blue-600 hover:!bg-blue-50"
          />
        </Tooltip>
      ),
    },
  ]

  return (
    <div className="space-y-4 md:space-y-6">
      {/* 页面标题 */}
      <div>
        <h1 className="text-xl md:text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
          审计日志
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          查看系统操作日志，追踪用户行为和系统事件
        </p>
      </div>

      {/* 统计卡片 */}
      <StatsCards stats={stats} loading={statsLoading} isMobile={isMobile} />

      {/* 搜索和筛选 - 紧凑单行布局 */}
      <Card 
        className="!rounded-xl !border-white/50 !bg-white/70 backdrop-blur-sm"
        styles={{ body: { padding: isMobile ? '12px' : '12px 16px' } }}
      >
        {/* 桌面端：单行紧凑布局 */}
        {!isMobile ? (
          <div className="flex items-center gap-2">
            {/* 搜索框 */}
            <Input
              placeholder="搜索关键词..."
              prefix={<Search className="w-4 h-4 text-gray-400" />}
              value={filters.keyword}
              onChange={(e) => setFilters((prev) => ({ ...prev, keyword: e.target.value }))}
              onPressEnter={() => {
                setPagination((prev) => ({ ...prev, page: 1 }))
                loadLogs()
              }}
              allowClear
              style={{ width: 180 }}
              size="middle"
            />

            {/* 日志级别 */}
            <Select
              placeholder="级别"
              value={filters.level}
              onChange={(value) => {
                setFilters((prev) => ({ ...prev, level: value }))
                setPagination((prev) => ({ ...prev, page: 1 }))
              }}
              style={{ width: 100 }}
              size="middle"
              options={[
                { value: LogLevel.UNSPECIFIED, label: '全部级别' },
                { value: LogLevel.DEBUG, label: 'DEBUG' },
                { value: LogLevel.INFO, label: 'INFO' },
                { value: LogLevel.WARNING, label: 'WARNING' },
                { value: LogLevel.ERROR, label: 'ERROR' },
              ]}
            />

            {/* 时间范围 */}
            <DatePicker.RangePicker
              value={filters.dateRange}
              onChange={(dates) => {
                setFilters((prev) => ({ ...prev, dateRange: dates }))
                setPagination((prev) => ({ ...prev, page: 1 }))
              }}
              format="MM-DD HH:mm"
              placeholder={['开始', '结束']}
              size="middle"
              style={{ width: 240 }}
              allowClear
            />

            {/* 更多筛选按钮 */}
            <Button
              type={showFilters ? 'primary' : 'default'}
              ghost={showFilters}
              icon={<Filter className="w-3.5 h-3.5" />}
              onClick={() => setShowFilters(!showFilters)}
              size="middle"
            >
              筛选
            </Button>

            {/* 重置按钮 */}
            <Button 
              onClick={handleResetFilters} 
              icon={<X className="w-3.5 h-3.5" />}
              size="middle"
            >
              重置
            </Button>

            {/* 刷新按钮移到右侧 */}
            <div className="flex-1" />
            <Button
              icon={<RefreshCw className="w-3.5 h-3.5" />}
              onClick={handleRefresh}
              loading={loading}
              size="middle"
            >
              刷新
            </Button>
          </div>
        ) : (
          /* 移动端：紧凑垂直布局 */
          <div className="space-y-2">
            {/* 第一行：搜索 + 级别 */}
            <div className="flex gap-2">
              <Input
                placeholder="搜索..."
                prefix={<Search className="w-4 h-4 text-gray-400" />}
                value={filters.keyword}
                onChange={(e) => setFilters((prev) => ({ ...prev, keyword: e.target.value }))}
                onPressEnter={() => {
                  setPagination((prev) => ({ ...prev, page: 1 }))
                  loadLogs()
                }}
                allowClear
                className="flex-1 !rounded-lg"
                size="middle"
              />
              <Select
                placeholder="级别"
                value={filters.level}
                onChange={(value) => {
                  setFilters((prev) => ({ ...prev, level: value }))
                  setPagination((prev) => ({ ...prev, page: 1 }))
                }}
                className="w-24"
                size="middle"
                options={[
                  { value: LogLevel.UNSPECIFIED, label: '全部' },
                  { value: LogLevel.DEBUG, label: 'DEBUG' },
                  { value: LogLevel.INFO, label: 'INFO' },
                  { value: LogLevel.WARNING, label: 'WARN' },
                  { value: LogLevel.ERROR, label: 'ERROR' },
                ]}
              />
            </div>

            {/* 第二行：日期 + 操作按钮 */}
            <div className="flex gap-2">
              <DatePicker
                value={filters.dateRange?.[0]}
                onChange={(date) => {
                  if (date) {
                    setFilters((prev) => ({ 
                      ...prev, 
                      dateRange: [date.startOf('day'), date.endOf('day')] 
                    }))
                  } else {
                    setFilters((prev) => ({ ...prev, dateRange: null }))
                  }
                  setPagination((prev) => ({ ...prev, page: 1 }))
                }}
                placeholder="日期"
                className="flex-1"
                size="middle"
                allowClear
              />
              <Button
                type={showFilters ? 'primary' : 'default'}
                ghost={showFilters}
                icon={<Filter className="w-3.5 h-3.5" />}
                onClick={() => setShowFilters(!showFilters)}
                size="middle"
              />
              <Button 
                onClick={handleResetFilters} 
                icon={<X className="w-3.5 h-3.5" />}
                size="middle"
              />
            </div>
          </div>
        )}

        {/* 展开的高级筛选 */}
        {showFilters && (
          <div className={`mt-3 pt-3 border-t border-gray-100 ${isMobile ? 'space-y-2' : ''}`}>
            {isMobile ? (
              /* 移动端筛选 */
              <>
                <div className="flex gap-2">
                  <Select
                    placeholder="选择模块"
                    value={filters.module || undefined}
                    onChange={(value) => {
                      setFilters((prev) => ({ ...prev, module: value || '' }))
                      setPagination((prev) => ({ ...prev, page: 1 }))
                    }}
                    allowClear
                    className="flex-1"
                    size="middle"
                    options={modules.map((m) => ({ value: m, label: m }))}
                  />
                  <Input
                    placeholder="用户名"
                    value={filters.username}
                    onChange={(e) => setFilters((prev) => ({ ...prev, username: e.target.value }))}
                    allowClear
                    className="flex-1"
                    size="middle"
                  />
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="IP地址"
                    value={filters.ip}
                    onChange={(e) => setFilters((prev) => ({ ...prev, ip: e.target.value }))}
                    allowClear
                    className="flex-1"
                    size="middle"
                  />
                  <Input
                    placeholder="操作"
                    value={filters.action}
                    onChange={(e) => setFilters((prev) => ({ ...prev, action: e.target.value }))}
                    allowClear
                    className="flex-1"
                    size="middle"
                  />
                </div>
              </>
            ) : (
              /* 桌面端筛选 - 单行布局 */
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400 shrink-0">高级筛选:</span>
                <Select
                  placeholder="选择模块"
                  value={filters.module || undefined}
                  onChange={(value) => {
                    setFilters((prev) => ({ ...prev, module: value || '' }))
                    setPagination((prev) => ({ ...prev, page: 1 }))
                  }}
                  allowClear
                  style={{ width: 120 }}
                  size="middle"
                  options={modules.map((m) => ({ value: m, label: m }))}
                />
                <Input
                  placeholder="用户名"
                  value={filters.username}
                  onChange={(e) => setFilters((prev) => ({ ...prev, username: e.target.value }))}
                  onPressEnter={() => {
                    setPagination((prev) => ({ ...prev, page: 1 }))
                    loadLogs()
                  }}
                  allowClear
                  style={{ width: 100 }}
                  size="middle"
                />
                <Input
                  placeholder="IP地址"
                  value={filters.ip}
                  onChange={(e) => setFilters((prev) => ({ ...prev, ip: e.target.value }))}
                  onPressEnter={() => {
                    setPagination((prev) => ({ ...prev, page: 1 }))
                    loadLogs()
                  }}
                  allowClear
                  style={{ width: 120 }}
                  size="middle"
                />
                <Input
                  placeholder="操作"
                  value={filters.action}
                  onChange={(e) => setFilters((prev) => ({ ...prev, action: e.target.value }))}
                  onPressEnter={() => {
                    setPagination((prev) => ({ ...prev, page: 1 }))
                    loadLogs()
                  }}
                  allowClear
                  style={{ width: 100 }}
                  size="middle"
                />
              </div>
            )}
          </div>
        )}
      </Card>

      {/* 日志列表 */}
      {loading ? (
        isMobile ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="!rounded-xl !bg-white/70 backdrop-blur-sm">
                <Skeleton active paragraph={{ rows: 3 }} />
              </Card>
            ))}
          </div>
        ) : (
          <Card className="!rounded-xl !bg-white/70 backdrop-blur-sm">
            <Skeleton active paragraph={{ rows: 8 }} />
          </Card>
        )
      ) : logs.length === 0 ? (
        <Card className="!rounded-xl !bg-white/70 backdrop-blur-sm">
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="暂无日志数据"
            className="!my-16"
          />
        </Card>
      ) : isMobile ? (
        /* 移动端：卡片列表 */
        <div className="space-y-3">
          {logs.map((log, index) => (
            <LogCard key={log.id || index} log={log} onViewDetail={handleViewDetail} />
          ))}
          {/* 移动端分页 */}
          <div className="flex justify-center pt-4">
            <Pagination
              current={pagination.page}
              total={total}
              pageSize={pagination.pageSize}
              onChange={(page, pageSize) => setPagination({ page, pageSize })}
              simple
              showSizeChanger={false}
            />
          </div>
        </div>
      ) : (
        /* 桌面端：表格 */
        <Card className="overflow-hidden !rounded-2xl !border-white/50 !bg-white/70 backdrop-blur-sm shadow-sm">
          <Table
            columns={columns}
            dataSource={logs}
            rowKey={(record, index) => record.id || String(index)}
            scroll={{ x: 1200 }}
            pagination={{
              current: pagination.page,
              total,
              pageSize: pagination.pageSize,
              onChange: (page, pageSize) => setPagination({ page, pageSize }),
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total) => `共 ${total} 条`,
              pageSizeOptions: ['10', '20', '50', '100'],
            }}
            size="middle"
            className="audit-log-table"
          />
        </Card>
      )}

      {/* 日志详情模态框 */}
      <LogDetailModal
        log={selectedLog}
        open={detailModalOpen}
        onClose={() => {
          setDetailModalOpen(false)
          setSelectedLog(null)
        }}
        isMobile={isMobile}
      />
    </div>
  )
}

