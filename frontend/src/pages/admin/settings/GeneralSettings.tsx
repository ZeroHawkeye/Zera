import { createLazyRoute } from '@tanstack/react-router'
import { Card, Form, Input, Button, Switch, Skeleton, message, Alert, theme, Select } from 'antd'
import { Save, RefreshCw } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { systemSettingApi, type UpdateSettingsParams } from '@/api/system_setting'
import { roleApi } from '@/api/role'
import { useState, useEffect } from 'react'

export const Route = createLazyRoute('/admin/settings/general')({
  component: GeneralSettings,
})

/**
 * 表单值类型
 */
interface FormValues {
  siteName: string
  siteDescription: string
  enableRegistration: boolean
  maintenanceMode: boolean
  defaultRegisterRole: string
}

/**
 * 基础设置页面
 */
function GeneralSettings() {
  const [form] = Form.useForm<FormValues>()
  const queryClient = useQueryClient()
  const { token } = theme.useToken()
  const [hasChanges, setHasChanges] = useState(false)

  // 获取系统设置
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['systemSettings'],
    queryFn: () => systemSettingApi.getSettings(),
  })

  // 获取角色列表
  const { data: rolesData } = useQuery({
    queryKey: ['roles'],
    queryFn: () => roleApi.listRoles({ page: 1, pageSize: 100 }),
  })

  // 更新系统设置
  const updateMutation = useMutation({
    mutationFn: (params: UpdateSettingsParams) => systemSettingApi.updateSettings(params),
    onSuccess: () => {
      message.success('设置已保存')
      setHasChanges(false)
      queryClient.invalidateQueries({ queryKey: ['systemSettings'] })
      queryClient.invalidateQueries({ queryKey: ['publicSettings'] })
    },
    onError: () => {
      message.error('保存设置失败')
    },
  })

  // 初始化表单值
  useEffect(() => {
    if (data?.settings) {
      form.setFieldsValue({
        siteName: data.settings.general?.siteName ?? 'Zera',
        siteDescription: data.settings.general?.siteDescription ?? '',
        enableRegistration: data.settings.features?.enableRegistration ?? true,
        maintenanceMode: data.settings.features?.maintenanceMode ?? false,
        defaultRegisterRole: data.settings.features?.defaultRegisterRole ?? 'user',
      })
    }
  }, [data, form])

  // 表单值变化检测
  const handleValuesChange = () => {
    setHasChanges(true)
  }

  // 保存设置
  const handleSave = async (values: FormValues) => {
    await updateMutation.mutateAsync({
      general: {
        siteName: values.siteName,
        siteDescription: values.siteDescription,
      },
      features: {
        enableRegistration: values.enableRegistration,
        maintenanceMode: values.maintenanceMode,
        defaultRegisterRole: values.defaultRegisterRole,
      },
    })
  }

  // 重置表单
  const handleReset = () => {
    if (data?.settings) {
      form.setFieldsValue({
        siteName: data.settings.general?.siteName ?? 'Zera',
        siteDescription: data.settings.general?.siteDescription ?? '',
        enableRegistration: data.settings.features?.enableRegistration ?? true,
        maintenanceMode: data.settings.features?.maintenanceMode ?? false,
        defaultRegisterRole: data.settings.features?.defaultRegisterRole ?? 'user',
      })
      setHasChanges(false)
    }
  }

  // 角色选项
  const roleOptions = rolesData?.roles?.map(role => ({
    label: role.name,
    value: role.code,
  })) ?? [{ label: '普通用户', value: 'user' }]

  if (error) {
    return (
      <div className="space-y-4 md:space-y-6 min-w-0">
        <Alert
          type="error"
          message="加载设置失败"
          description="无法获取系统设置，请检查网络连接后重试。"
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
      {/* 维护模式警告 */}
      {data?.settings?.features?.maintenanceMode && (
        <Alert
          type="warning"
          message="维护模式已启用"
          description="系统当前处于维护模式，普通用户无法访问。"
          showIcon
        />
      )}

      <Form
        form={form}
        layout="vertical"
        onFinish={handleSave}
        onValuesChange={handleValuesChange}
      >
        <Card title="站点信息" className="overflow-hidden">
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton.Input active block style={{ height: 32 }} />
              <Skeleton.Input active block style={{ height: 80 }} />
            </div>
          ) : (
            <>
              <Form.Item
                name="siteName"
                label="站点名称"
                rules={[{ required: true, message: '请输入站点名称' }]}
              >
                <Input placeholder="请输入站点名称" maxLength={100} showCount />
              </Form.Item>

              <Form.Item
                name="siteDescription"
                label="站点描述"
                extra="用于 SEO 和站点介绍"
                className="mb-0"
              >
                <Input.TextArea
                  rows={3}
                  placeholder="请输入站点描述"
                  maxLength={500}
                  showCount
                />
              </Form.Item>
            </>
          )}
        </Card>

        <Card title="功能开关" className="overflow-hidden">
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton active paragraph={{ rows: 2 }} />
            </div>
          ) : (
            <div className="space-y-4">
              {/* 启用注册 */}
              <div
                className="flex items-start sm:items-center justify-between gap-4 flex-col sm:flex-row p-3 rounded-lg transition-colors"
                style={{ backgroundColor: token.colorBgTextHover }}
              >
                <div className="min-w-0 flex-1">
                  <div
                    className="font-medium"
                    style={{ color: token.colorText }}
                  >
                    启用注册
                  </div>
                  <div
                    className="text-sm"
                    style={{ color: token.colorTextSecondary }}
                  >
                    允许新用户自行注册账号。关闭后，只有管理员可以创建新用户。
                  </div>
                </div>
                <Form.Item name="enableRegistration" valuePropName="checked" className="mb-0">
                  <Switch className="flex-shrink-0" />
                </Form.Item>
              </div>

              {/* 默认注册角色 */}
              <div
                className="flex items-start sm:items-center justify-between gap-4 flex-col sm:flex-row p-3 rounded-lg transition-colors"
                style={{ backgroundColor: token.colorBgTextHover }}
              >
                <div className="min-w-0 flex-1">
                  <div
                    className="font-medium"
                    style={{ color: token.colorText }}
                  >
                    默认注册角色
                  </div>
                  <div
                    className="text-sm"
                    style={{ color: token.colorTextSecondary }}
                  >
                    新注册用户将自动获得此角色的权限
                  </div>
                </div>
                <Form.Item name="defaultRegisterRole" className="mb-0 min-w-[140px]">
                  <Select
                    options={roleOptions}
                    placeholder="选择角色"
                    className="w-full"
                  />
                </Form.Item>
              </div>

              {/* 维护模式 */}
              <div
                className="flex items-start sm:items-center justify-between gap-4 flex-col sm:flex-row p-3 rounded-lg transition-colors"
                style={{
                  backgroundColor: data?.settings?.features?.maintenanceMode
                    ? token.colorWarningBg
                    : token.colorBgTextHover,
                }}
              >
                <div className="min-w-0 flex-1">
                  <div
                    className="font-medium"
                    style={{ color: token.colorText }}
                  >
                    维护模式
                  </div>
                  <div
                    className="text-sm"
                    style={{ color: token.colorTextSecondary }}
                  >
                    开启后普通用户将无法访问系统，仅管理员可正常使用。适用于系统维护期间。
                  </div>
                </div>
                <Form.Item name="maintenanceMode" valuePropName="checked" className="mb-0">
                  <Switch className="flex-shrink-0" />
                </Form.Item>
              </div>
            </div>
          )}
        </Card>

        {/* 保存按钮 */}
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
