/**
 * CAS 登录按钮组件
 * 用于在登录页面显示 CAS 单点登录入口
 */

import { useState } from "react";
import { Button, message } from "antd";
import { Building2 } from "lucide-react";
import { casAuthApi } from "@/api/cas_auth";

interface CASLoginButtonProps {
  /** 登录成功后的重定向地址 */
  redirectUrl?: string;
  /** 按钮文本 */
  buttonText?: string;
  /** 是否禁用 */
  disabled?: boolean;
  /** 自定义类名 */
  className?: string;
}

/**
 * CAS 登录按钮
 * 点击后获取 CAS 登录 URL 并跳转到 CAS 服务器进行认证
 */
export function CASLoginButton({
  redirectUrl,
  buttonText = "使用企业账号登录",
  disabled = false,
  className = "",
}: CASLoginButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleCASLogin = async () => {
    setLoading(true);
    try {
      const response = await casAuthApi.getLoginURL(redirectUrl);

      if (!response.casEnabled) {
        message.warning("CAS 认证未启用");
        return;
      }

      if (!response.loginUrl) {
        message.error("获取 CAS 登录地址失败");
        return;
      }

      // 重定向到 CAS 登录页
      window.location.href = response.loginUrl;
    } catch (error) {
      console.error("CAS login error:", error);
      message.error("获取 CAS 登录地址失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      size="large"
      onClick={handleCASLogin}
      loading={loading}
      disabled={disabled}
      icon={<Building2 className="w-4 h-4" />}
      className={`!h-12 !rounded-xl !font-medium ${className}`}
      style={{
        borderColor:
          "color-mix(in srgb, var(--color-primary) 28%, transparent)",
        color: "var(--color-primary)",
      }}
      block
    >
      {buttonText}
    </Button>
  );
}

export default CASLoginButton;
