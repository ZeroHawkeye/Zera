import { createLazyRoute } from '@tanstack/react-router'
import { Card, Form, Input, Button, Switch, Skeleton, message, Alert, theme, Select } from 'antd'
import { Save, Building2, RefreshCw, Plug, CheckCircle, XCircle } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { casAuthApi, type CASConfigParams } from '@/api/cas_auth'
import { roleApi } from '@/api/role'
import { useState, useEffect } from 'react'

export const Route = createLazyRoute('/admin/settings/cas')({
  component: CASSettings,
})

/**
 * CAS 设置表单值类型
 */
interface CASFormValues {
  enabled: boolean
  serverUrl: string
  organization: string
  application: string
  serviceUrl: string
  defaultRole: string
  autoCreateUser: boolean
  clientId: string
  clientSecret: string
  jwtPublicKey: string
  syncToCasdoor: boolean
}

/**
 * CAS 设置页面
 */
function CASSettings() {
  const [form] = Form.useForm<CASFormValues>()
  const queryClient = useQueryClient()
  const { token } = theme.useToken()
  const [hasChanges, setHasChanges] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)

  // 获取 CAS 配置
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['casConfig'],
    queryFn: () => casAuthApi.getConfig(),
  })

  // 获取角色列表（用于默认角色选择）
  const { data: rolesData } = useQuery({
    queryKey: ['roles'],
    queryFn: () => roleApi.listRoles({ page: 1, pageSize: 100 }),
  })

  // 更新 CAS 配置
  const updateMutation = useMutation({
    mutationFn: (params: CASConfigParams) => casAuthApi.updateConfig(params),
    onSuccess: () => {
      message.success('CAS 配置已保存')
      setHasChanges(false)
      setTestResult(null)
      queryClient.invalidateQueries({ queryKey: ['casConfig'] })
    },
    onError: () => {
      message.error('保存 CAS 配置失败')
    },
  })

  // 测试连接
  const testMutation = useMutation({
    mutationFn: (params: CASConfigParams) => casAuthApi.testConnection(params),
    onSuccess: (response) => {
      if (response.success) {
        setTestResult({
          success: true,
          message: `连接成功！服务器版本: ${response.serverVersion || 'Unknown'}`,
        })
        message.success('CAS 连接测试成功')
      } else {
        setTestResult({
          success: false,
          message: response.errorMessage || '连接失败',
        })
        message.error(`CAS 连接测试失败: ${response.errorMessage}`)
      }
    },
    onError: (error) => {
      setTestResult({
        success: false,
        message: error instanceof Error ? error.message : '连接测试失败',
      })
      message.error('CAS 连接测试失败')
    },
  })

  // 初始化表单值
  useEffect(() => {
    if (data?.config) {
      form.setFieldsValue({
        enabled: data.config.enabled || false,
        serverUrl: data.config.serverUrl || '',
        organization: data.config.organization || 'built-in',
        application: data.config.application || 'zera',
        serviceUrl: data.config.serviceUrl || '',
        defaultRole: data.config.defaultRole || 'user',
        autoCreateUser: data.config.autoCreateUser ?? true,
        clientId: data.config.clientId || '',
        clientSecret: data.config.clientSecret || '',
        jwtPublicKey: data.config.jwtPublicKey || '',
        syncToCasdoor: data.config.syncToCasdoor || false,
      })
    }
  }, [data, form])

  // 表单值变化检测
  const handleValuesChange = () => {
    setHasChanges(true)
    setTestResult(null)
  }

  // 保存设置
  const handleSave = async (values: CASFormValues) => {
    await updateMutation.mutateAsync({
      enabled: values.enabled,
      serverUrl: values.serverUrl,
      organization: values.organization,
      application: values.application,
      serviceUrl: values.serviceUrl,
      defaultRole: values.defaultRole,
      autoCreateUser: values.autoCreateUser,
      clientId: values.clientId,
      clientSecret: values.clientSecret,
      jwtPublicKey: values.jwtPublicKey,
      syncToCasdoor: values.syncToCasdoor,
    })
  }

  // 测试连接
  const handleTestConnection = async () => {
    const values = form.getFieldsValue()
    await testMutation.mutateAsync({
      enabled: values.enabled,
      serverUrl: values.serverUrl,
      organization: values.organization,
      application: values.application,
      serviceUrl: values.serviceUrl,
      defaultRole: values.defaultRole,
      autoCreateUser: values.autoCreateUser,
      clientId: values.clientId,
      clientSecret: values.clientSecret,
      jwtPublicKey: values.jwtPublicKey,
      syncToCasdoor: values.syncToCasdoor,
    })
  }

  // 重置表单
  const handleReset = () => {
    if (data?.config) {
      form.setFieldsValue({
        enabled: data.config.enabled || false,
        serverUrl: data.config.serverUrl || '',
        organization: data.config.organization || 'built-in',
        application: data.config.application || 'zera',
        serviceUrl: data.config.serviceUrl || '',
        defaultRole: data.config.defaultRole || 'user',
        autoCreateUser: data.config.autoCreateUser ?? true,
        clientId: data.config.clientId || '',
        clientSecret: data.config.clientSecret || '',
        jwtPublicKey: data.config.jwtPublicKey || '',
        syncToCasdoor: data.config.syncToCasdoor || false,
      })
      setHasChanges(false)
      setTestResult(null)
    }
  }

  // 自动填充默认服务 URL
  const handleAutoFillServiceUrl = () => {
    const currentOrigin = window.location.origin
    form.setFieldValue('serviceUrl', `${currentOrigin}/cas/callback`)
    setHasChanges(true)
  }

  if (error) {
    return (
      <div className="space-y-4 md:space-y-6 min-w-0">
        <Alert
          type="error"
          message="加载设置失败"
          description="无法获取 CAS 配置，请检查网络连接后重试。"
          action={
            <Button size="small" onClick={() => refetch()}>
              重试
            </Button>
          }
        />
      </div>
    )
  }

  return (
    <div className="space-y-4 md:space-y-6 min-w-0">
      <Alert
        message="CAS 单点登录"
        description="配置 CAS (Central Authentication Service) 单点登录，允许用户使用企业统一身份认证系统登录本系统。"
        type="info"
        showIcon
        icon={<Building2 className="w-4 h-4" />}
      />

      <Form
        form={form}
        layout="vertical"
        onFinish={handleSave}
        onValuesChange={handleValuesChange}
      >
        {/* 启用开关 */}
        <Card title="基本设置" className="overflow-hidden">
          {isLoading ? (
            <Skeleton active paragraph={{ rows: 2 }} />
          ) : (
            <div
              className="flex items-start sm:items-center justify-between gap-4 flex-col sm:flex-row p-3 rounded-lg transition-colors"
              style={{ backgroundColor: token.colorBgTextHover }}
            >
              <div className="min-w-0 flex-1">
                <div className="font-medium" style={{ color: token.colorText }}>
                  启用 CAS 认证
                </div>
                <div className="text-sm" style={{ color: token.colorTextSecondary }}>
                  启用后，登录页面将显示 CAS 单点登录入口
                </div>
              </div>
              <Form.Item name="enabled" valuePropName="checked" className="mb-0">
                <Switch className="flex-shrink-0" />
              </Form.Item>
            </div>
          )}
        </Card>

        {/* CAS 服务器配置 */}
        <Card title="CAS 服务器配置" className="overflow-hidden">
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton.Input active block style={{ height: 32 }} />
              <Skeleton.Input active block style={{ height: 32 }} />
              <Skeleton.Input active block style={{ height: 32 }} />
            </div>
          ) : (
            <>
              <Form.Item
                name="serverUrl"
                label="CAS 服务器地址"
                tooltip="Casdoor 服务的访问地址，例如 http://localhost:8000"
                rules={[
                  { required: true, message: '请输入 CAS 服务器地址' },
                  { type: 'url', message: '请输入有效的 URL' },
                ]}
              >
                <Input placeholder="http://localhost:8000" />
              </Form.Item>

              <Form.Item
                name="organization"
                label="组织名称"
                tooltip="Casdoor 中配置的组织名称"
                rules={[{ required: true, message: '请输入组织名称' }]}
              >
                <Input placeholder="built-in" />
              </Form.Item>

              <Form.Item
                name="application"
                label="应用名称"
                tooltip="Casdoor 中配置的应用名称"
                rules={[{ required: true, message: '请输入应用名称' }]}
              >
                <Input placeholder="zera" />
              </Form.Item>

              <Form.Item
                name="serviceUrl"
                label="回调地址"
                tooltip="CAS 认证成功后的回调地址，需要在 Casdoor 应用中配置"
                rules={[
                  { required: true, message: '请输入回调地址' },
                  { type: 'url', message: '请输入有效的 URL' },
                ]}
                className="mb-0"
              >
                <Input
                  placeholder={`${window.location.origin}/cas/callback`}
                  addonAfter={
                    <Button
                      type="link"
                      size="small"
                      className="!p-0 !h-auto"
                      onClick={handleAutoFillServiceUrl}
                    >
                      自动填充
                    </Button>
                  }
                />
              </Form.Item>
            </>
          )}
        </Card>

        {/* 用户同步配置 */}
        <Card title="用户同步" className="overflow-hidden">
          {isLoading ? (
            <Skeleton active paragraph={{ rows: 2 }} />
          ) : (
            <>
              <div
                className="flex items-start sm:items-center justify-between gap-4 flex-col sm:flex-row p-3 rounded-lg transition-colors mb-4"
                style={{ backgroundColor: token.colorBgTextHover }}
              >
                <div className="min-w-0 flex-1">
                  <div className="font-medium" style={{ color: token.colorText }}>
                    自动创建用户
                  </div>
                  <div className="text-sm" style={{ color: token.colorTextSecondary }}>
                    首次通过 CAS 登录时自动创建本地用户账号
                  </div>
                </div>
                <Form.Item name="autoCreateUser" valuePropName="checked" className="mb-0">
                  <Switch className="flex-shrink-0" />
                </Form.Item>
              </div>

              <Form.Item
                name="defaultRole"
                label="默认角色"
                tooltip="通过 CAS 自动创建的用户将被分配此角色"
                rules={[{ required: true, message: '请选择默认角色' }]}
                className="mb-0"
              >
                <Select placeholder="选择默认角色">
                  {rolesData?.roles.map((role) => (
                    <Select.Option key={role.code} value={role.code}>
                      {role.name}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </>
          )}
        </Card>

        {/* Casdoor SDK 配置 (用于双向同步) */}
        <Card title="Casdoor SDK 配置" className="overflow-hidden">
          {isLoading ? (
            <Skeleton active paragraph={{ rows: 4 }} />
          ) : (
            <>
              <Alert
                message="双向同步配置"
                description="配置 Casdoor SDK 凭证以启用将本地创建的用户同步到 Casdoor。这些凭证可在 Casdoor 应用设置中获取。"
                type="info"
                showIcon
                className="mb-4"
              />

              <div
                className="flex items-start sm:items-center justify-between gap-4 flex-col sm:flex-row p-3 rounded-lg transition-colors mb-4"
                style={{ backgroundColor: token.colorBgTextHover }}
              >
                <div className="min-w-0 flex-1">
                  <div className="font-medium" style={{ color: token.colorText }}>
                    同步到 Casdoor
                  </div>
                  <div className="text-sm" style={{ color: token.colorTextSecondary }}>
                    启用后，本地创建的用户将自动同步到 Casdoor
                  </div>
                </div>
                <Form.Item name="syncToCasdoor" valuePropName="checked" className="mb-0">
                  <Switch className="flex-shrink-0" />
                </Form.Item>
              </div>

              <Form.Item
                name="clientId"
                label="Client ID"
                tooltip="Casdoor 应用的 Client ID"
                rules={[
                  {
                    required: form.getFieldValue('syncToCasdoor'),
                    message: '启用同步时必须填写 Client ID',
                  },
                ]}
              >
                <Input placeholder="请输入 Casdoor 应用 Client ID" />
              </Form.Item>

              <Form.Item
                name="clientSecret"
                label="Client Secret"
                tooltip="Casdoor 应用的 Client Secret"
                rules={[
                  {
                    required: form.getFieldValue('syncToCasdoor'),
                    message: '启用同步时必须填写 Client Secret',
                  },
                ]}
              >
                <Input.Password placeholder="请输入 Casdoor 应用 Client Secret" />
              </Form.Item>

              <Form.Item
                name="jwtPublicKey"
                label="JWT 公钥证书"
                tooltip="Casdoor 应用的 JWT 公钥证书，用于验证 Token"
                className="mb-0"
              >
                <Input.TextArea
                  rows={4}
                  placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
                />
              </Form.Item>
            </>
          )}
        </Card>

        {/* 连接测试结果 */}
        {testResult && (
          <Alert
            type={testResult.success ? 'success' : 'error'}
            message={testResult.success ? '连接测试成功' : '连接测试失败'}
            description={testResult.message}
            icon={testResult.success ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
            showIcon
          />
        )}

        {/* 操作按钮 */}
        {!isLoading && (
          <div
            className="sticky bottom-4 p-4 rounded-lg shadow-lg backdrop-blur-sm"
            style={{
              backgroundColor: token.colorBgElevated,
              border: `1px solid ${token.colorBorderSecondary}`,
            }}
          >
            <div className="flex flex-wrap gap-2 justify-end">
              <Button
                onClick={handleTestConnection}
                loading={testMutation.isPending}
                icon={<Plug className="w-4 h-4" />}
              >
                测试连接
              </Button>
              <Button
                onClick={handleReset}
                disabled={!hasChanges}
                icon={<RefreshCw className="w-4 h-4" />}
              >
                重置
              </Button>
              <Button
                type="primary"
                htmlType="submit"
                loading={updateMutation.isPending}
                icon={<Save className="w-4 h-4" />}
                disabled={!hasChanges}
              >
                保存设置
              </Button>
            </div>
          </div>
        )}
      </Form>
    </div>
  )
}
