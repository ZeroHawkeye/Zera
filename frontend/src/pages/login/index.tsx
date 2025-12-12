import {
  createLazyRoute,
  useNavigate,
  useSearch,
} from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Card, Form, Input, Button, Checkbox, message, Divider } from "antd";
import { Mail, Lock, Sparkles } from "lucide-react";
import { useAuthStore, useSiteStore } from "@/stores";
import { CASLoginButton } from "@/components/CASLoginButton";
import { casAuthApi } from "@/api/cas_auth";

export const Route = createLazyRoute("/login")({
  component: LoginPage,
});

/**
 * 登录页面
 * 现代 AI 产品风格
 */
function LoginPage() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [casEnabled, setCasEnabled] = useState(false);
  const [casButtonText, setCasButtonText] = useState("使用企业账号登录");
  const navigate = useNavigate();
  const search = useSearch({ from: "/login" });
  const login = useAuthStore((state) => state.login);
  const siteName = useSiteStore((state) => state.siteName);

  // 获取 CAS 公开设置
  useEffect(() => {
    const fetchCASSettings = async () => {
      try {
        const settings = await casAuthApi.getPublicSettings();
        setCasEnabled(settings.casEnabled);
        if (settings.loginButtonText) {
          setCasButtonText(settings.loginButtonText);
        }
      } catch (error) {
        // CAS 设置获取失败，静默处理，不影响本地登录
        console.debug("Failed to fetch CAS settings:", error);
      }
    };
    fetchCASSettings();
  }, []);

  const handleLogin = async (values: {
    username: string;
    password: string;
    rememberMe?: boolean;
  }) => {
    setLoading(true);
    try {
      await login(values.username, values.password, values.rememberMe);
      message.success("登录成功");

      // 重定向到目标页面或首页
      const redirect = (search as { redirect?: string }).redirect || "/admin";
      navigate({ to: redirect });
    } catch (err) {
      // 错误已在 store 中处理
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        background:
          "linear-gradient(135deg, rgba(248, 250, 252, 1) 0%, var(--color-primary-light) 55%, rgba(236, 253, 245, 0.35) 100%)",
      }}
    >
      {/* 背景装饰 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute top-20 left-10 w-72 h-72 rounded-full blur-3xl"
          style={{
            background:
              "color-mix(in srgb, var(--color-primary) 20%, transparent)",
          }}
        />
        <div
          className="absolute bottom-20 right-10 w-96 h-96 rounded-full blur-3xl"
          style={{
            background:
              "color-mix(in srgb, var(--color-primary) 16%, transparent)",
          }}
        />
      </div>

      {/* 登录卡片 */}
      <Card className="w-full max-w-md relative z-10 !rounded-3xl !border-white/50 !bg-white/70 backdrop-blur-xl shadow-2xl">
        {/* Logo 和标题 */}
        <div className="text-center mb-8">
          <div
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl shadow-lg mb-4"
            style={{
              background:
                "linear-gradient(135deg, var(--auth-gradient-from), var(--auth-gradient-to))",
              boxShadow: "var(--glow-primary)",
            }}
          >
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
            欢迎回来
          </h1>
          <p className="mt-2 text-gray-500">登录到 {siteName} 管理系统</p>
        </div>

        {/* 登录表单 */}
        <Form
          form={form}
          layout="vertical"
          onFinish={handleLogin}
          initialValues={{
            username: "",
            password: "",
            rememberMe: true,
          }}
          requiredMark={false}
        >
          <Form.Item
            name="username"
            label="用户名"
            rules={[{ required: true, message: "请输入用户名" }]}
          >
            <Input
              prefix={<Mail className="w-4 h-4 text-gray-400" />}
              placeholder="请输入用户名"
              size="large"
              className="!rounded-xl"
            />
          </Form.Item>

          <Form.Item
            name="password"
            label="密码"
            rules={[{ required: true, message: "请输入密码" }]}
          >
            <Input.Password
              prefix={<Lock className="w-4 h-4 text-gray-400" />}
              placeholder="请输入密码"
              size="large"
              className="!rounded-xl"
            />
          </Form.Item>

          <Form.Item name="rememberMe" valuePropName="checked">
            <div className="flex items-center justify-between">
              <Checkbox>记住我</Checkbox>
              <a
                className="text-sm hover:opacity-90"
                style={{ color: "var(--color-primary)" }}
              >
                忘记密码？
              </a>
            </div>
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              size="large"
              loading={loading}
              block
              className="!h-12 !rounded-xl !font-medium !border-0 !shadow-lg"
              style={{
                background:
                  "linear-gradient(90deg, var(--auth-gradient-from), var(--auth-gradient-to))",
                boxShadow: "var(--glow-primary)",
              }}
            >
              登录
            </Button>
          </Form.Item>
        </Form>

        {/* CAS 登录按钮 */}
        {casEnabled && (
          <>
            <Divider className="!text-gray-400 !text-sm">或</Divider>
            <CASLoginButton
              buttonText={casButtonText}
              redirectUrl={(search as { redirect?: string }).redirect}
            />
          </>
        )}

        {/* 提示信息 */}
        <div
          className="mt-6 p-4 rounded-xl border"
          style={{
            background:
              "color-mix(in srgb, var(--color-primary) 8%, transparent)",
            borderColor:
              "color-mix(in srgb, var(--color-primary) 18%, transparent)",
          }}
        >
          <p className="text-xs text-gray-600 text-center">
            <strong>默认账号：</strong> admin / admin123
          </p>
        </div>
      </Card>
    </div>
  );
}
