import { createLazyRoute } from "@tanstack/react-router";
import {
  Card,
  Form,
  InputNumber,
  Button,
  Switch,
  Skeleton,
  message,
  Alert,
  theme,
} from "antd";
import { Save, Shield, RefreshCw } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  systemSettingApi,
  type UpdateSettingsParams,
} from "@/api/system_setting";
import { useState, useEffect } from "react";

export const Route = createLazyRoute("/admin/settings/security")({
  component: SecuritySettings,
});

/**
 * 安全设置表单值类型
 */
interface SecurityFormValues {
  maxLoginAttempts: number;
  lockoutDuration: number;
  sessionTimeout: number;
  passwordMinLength: number;
  passwordRequireUppercase: boolean;
  passwordRequireNumber: boolean;
  passwordRequireSpecial: boolean;
}

/**
 * 安全设置页面
 */
function SecuritySettings() {
  const [form] = Form.useForm<SecurityFormValues>();
  const queryClient = useQueryClient();
  const { token } = theme.useToken();
  const [hasChanges, setHasChanges] = useState(false);

  // 获取系统设置
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["systemSettings"],
    queryFn: () => systemSettingApi.getSettings(),
  });

  // 更新系统设置
  const updateMutation = useMutation({
    mutationFn: (params: UpdateSettingsParams) =>
      systemSettingApi.updateSettings(params),
    onSuccess: () => {
      message.success("安全设置已保存");
      setHasChanges(false);
      queryClient.invalidateQueries({ queryKey: ["systemSettings"] });
    },
    onError: () => {
      message.error("保存安全设置失败");
    },
  });

  // 初始化表单值
  useEffect(() => {
    if (data?.settings?.security) {
      form.setFieldsValue({
        maxLoginAttempts: data.settings.security.maxLoginAttempts || 5,
        lockoutDuration: data.settings.security.lockoutDuration || 30,
        sessionTimeout: data.settings.security.sessionTimeout || 60,
        passwordMinLength: data.settings.security.passwordMinLength || 8,
        passwordRequireUppercase:
          data.settings.security.passwordRequireUppercase ?? true,
        passwordRequireNumber:
          data.settings.security.passwordRequireNumber ?? true,
        passwordRequireSpecial:
          data.settings.security.passwordRequireSpecial ?? false,
      });
    }
  }, [data, form]);

  // 表单值变化检测
  const handleValuesChange = () => {
    setHasChanges(true);
  };

  // 保存设置
  const handleSave = async (values: SecurityFormValues) => {
    await updateMutation.mutateAsync({
      security: {
        maxLoginAttempts: values.maxLoginAttempts,
        lockoutDuration: values.lockoutDuration,
        sessionTimeout: values.sessionTimeout,
        passwordMinLength: values.passwordMinLength,
        passwordRequireUppercase: values.passwordRequireUppercase,
        passwordRequireNumber: values.passwordRequireNumber,
        passwordRequireSpecial: values.passwordRequireSpecial,
      },
    });
  };

  // 重置表单
  const handleReset = () => {
    if (data?.settings?.security) {
      form.setFieldsValue({
        maxLoginAttempts: data.settings.security.maxLoginAttempts || 5,
        lockoutDuration: data.settings.security.lockoutDuration || 30,
        sessionTimeout: data.settings.security.sessionTimeout || 60,
        passwordMinLength: data.settings.security.passwordMinLength || 8,
        passwordRequireUppercase:
          data.settings.security.passwordRequireUppercase ?? true,
        passwordRequireNumber:
          data.settings.security.passwordRequireNumber ?? true,
        passwordRequireSpecial:
          data.settings.security.passwordRequireSpecial ?? false,
      });
      setHasChanges(false);
    }
  };

  if (error) {
    return (
      <div className="flex flex-col gap-4 md:gap-6 min-w-0">
        <Alert
          type="error"
          title="加载设置失败"
          description="无法获取安全设置，请检查网络连接后重试。"
          action={
            <Button size="small" onClick={() => refetch()}>
              重试
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 md:gap-6 min-w-0">
      <Alert
        title="安全提示"
        description="修改安全设置可能会影响系统的安全性，请谨慎操作。"
        type="warning"
        showIcon
        icon={<Shield className="w-4 h-4" />}
      />

      <Form
        form={form}
        layout="vertical"
        onFinish={handleSave}
        onValuesChange={handleValuesChange}
        className="flex flex-col gap-4 md:gap-6"
      >
        <Card
          title="登录安全"
          className="overflow-hidden !rounded-2xl !border-default !bg-container backdrop-blur-sm shadow-sm"
        >
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton.Input active block style={{ height: 32 }} />
              <Skeleton.Input active block style={{ height: 32 }} />
              <Skeleton.Input active block style={{ height: 32 }} />
            </div>
          ) : (
            <>
              <Form.Item
                name="maxLoginAttempts"
                label="最大登录尝试次数"
                tooltip="超过此次数后账号将被临时锁定"
                rules={[{ required: true, message: "请输入最大登录尝试次数" }]}
              >
                <InputNumber min={1} max={10} className="w-full" />
              </Form.Item>

              <Form.Item
                name="lockoutDuration"
                label="账号锁定时长（分钟）"
                tooltip="账号被锁定后需要等待的时间"
                rules={[{ required: true, message: "请输入账号锁定时长" }]}
              >
                <InputNumber min={5} max={1440} className="w-full" />
              </Form.Item>

              <Form.Item
                name="sessionTimeout"
                label="会话超时时间（分钟）"
                tooltip="用户无操作后自动退出的时间"
                rules={[{ required: true, message: "请输入会话超时时间" }]}
                className="mb-0"
              >
                <InputNumber min={5} max={1440} className="w-full" />
              </Form.Item>
            </>
          )}
        </Card>

        <Card
          title="密码策略"
          className="overflow-hidden !rounded-2xl !border-default !bg-container backdrop-blur-sm shadow-sm"
        >
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton active paragraph={{ rows: 3 }} />
            </div>
          ) : (
            <>
              <Form.Item
                name="passwordMinLength"
                label="密码最小长度"
                tooltip="用户密码必须达到的最小字符数"
                rules={[{ required: true, message: "请输入密码最小长度" }]}
              >
                <InputNumber min={6} max={32} className="w-full" />
              </Form.Item>

              <div className="space-y-4">
                {/* 要求包含大写字母 */}
                <div
                  className="flex items-start sm:items-center justify-between gap-4 flex-col sm:flex-row p-3 rounded-lg transition-colors"
                  style={{ backgroundColor: token.colorBgTextHover }}
                >
                  <div className="min-w-0 flex-1">
                    <div
                      className="font-medium"
                      style={{ color: token.colorText }}
                    >
                      要求包含大写字母
                    </div>
                    <div
                      className="text-sm"
                      style={{ color: token.colorTextSecondary }}
                    >
                      密码必须包含至少一个大写字母
                    </div>
                  </div>
                  <Form.Item
                    name="passwordRequireUppercase"
                    valuePropName="checked"
                    className="mb-0"
                  >
                    <Switch className="flex-shrink-0" />
                  </Form.Item>
                </div>

                {/* 要求包含数字 */}
                <div
                  className="flex items-start sm:items-center justify-between gap-4 flex-col sm:flex-row p-3 rounded-lg transition-colors"
                  style={{ backgroundColor: token.colorBgTextHover }}
                >
                  <div className="min-w-0 flex-1">
                    <div
                      className="font-medium"
                      style={{ color: token.colorText }}
                    >
                      要求包含数字
                    </div>
                    <div
                      className="text-sm"
                      style={{ color: token.colorTextSecondary }}
                    >
                      密码必须包含至少一个数字
                    </div>
                  </div>
                  <Form.Item
                    name="passwordRequireNumber"
                    valuePropName="checked"
                    className="mb-0"
                  >
                    <Switch className="flex-shrink-0" />
                  </Form.Item>
                </div>

                {/* 要求包含特殊字符 */}
                <div
                  className="flex items-start sm:items-center justify-between gap-4 flex-col sm:flex-row p-3 rounded-lg transition-colors"
                  style={{ backgroundColor: token.colorBgTextHover }}
                >
                  <div className="min-w-0 flex-1">
                    <div
                      className="font-medium"
                      style={{ color: token.colorText }}
                    >
                      要求包含特殊字符
                    </div>
                    <div
                      className="text-sm"
                      style={{ color: token.colorTextSecondary }}
                    >
                      密码必须包含至少一个特殊字符（如 !@#$%^&*）
                    </div>
                  </div>
                  <Form.Item
                    name="passwordRequireSpecial"
                    valuePropName="checked"
                    className="mb-0"
                  >
                    <Switch className="flex-shrink-0" />
                  </Form.Item>
                </div>
              </div>
            </>
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
  );
}
