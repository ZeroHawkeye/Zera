import { Outlet, Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useSiteStore } from "@/stores";

interface AuthLayoutProps {
  children?: ReactNode;
}

/**
 * 认证布局
 * 用于登录、注册、忘记密码等认证相关页面
 * 提供统一的认证页面风格
 */
export function AuthLayout({ children }: AuthLayoutProps) {
  const siteName = useSiteStore((state) => state.siteName);

  return (
    <div className="min-h-screen flex">
      {/* 左侧品牌区域 */}
      <div
        className="hidden lg:flex lg:w-1/2 relative overflow-hidden"
        style={{
          background: `linear-gradient(135deg, var(--auth-gradient-from), var(--auth-gradient-via), var(--auth-gradient-to))`,
        }}
      >
        {/* 装饰元素 */}
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-20 left-20 w-72 h-72 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-white/10 rounded-full blur-3xl" />
        </div>

        {/* 品牌内容 */}
        <div className="relative z-10 flex flex-col justify-between p-12 text-white">
          <div>
            <Link to="/" className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                <span className="text-white font-bold text-xl">
                  {siteName.charAt(0)}
                </span>
              </div>
              <span className="text-2xl font-bold">{siteName}</span>
            </Link>
          </div>

          <div className="max-w-md">
            <h1 className="text-4xl font-bold mb-4">
              欢迎使用 {siteName} 管理系统
            </h1>
            <p className="text-white/80 text-lg leading-relaxed">
              一个现代化、高效率的企业级管理平台， 助力您的业务数字化转型。
            </p>
          </div>

          <div>
            <blockquote className="text-white/80 italic">
              "简洁是复杂的最终形式"
              <footer className="mt-2 text-white/60 text-sm not-italic">
                — Leonardo da Vinci
              </footer>
            </blockquote>
          </div>
        </div>
      </div>

      {/* 右侧内容区域 */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 bg-gray-50 lg:px-8">
        <div className="w-full max-w-sm">
          {/* 移动端 Logo */}
          <div className="lg:hidden mb-8 text-center">
            <Link to="/" className="inline-flex items-center gap-2">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{
                  background: `linear-gradient(135deg, var(--auth-gradient-from), var(--auth-gradient-to))`,
                }}
              >
                <span className="text-white font-bold">
                  {siteName.charAt(0)}
                </span>
              </div>
              <span className="text-xl font-bold text-gray-900">
                {siteName}
              </span>
            </Link>
          </div>

          {/* 页面内容 */}
          {children ?? <Outlet />}

          {/* 页脚 */}
          <div className="mt-12 text-center">
            <p className="text-xs text-gray-400">
              © {new Date().getFullYear()} {siteName}. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
