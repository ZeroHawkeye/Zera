/**
 * Logo 组件
 * 可配置的项目 Logo，支持自定义图片或默认 Sparkles 图标
 */

import { useState, useEffect } from "react";
import { Sparkles } from "lucide-react";
import { useSiteStore } from "@/stores";
import { config } from "@/config";

interface LogoProps {
  /** 尺寸：small(24px), medium(36px), large(48px) 或自定义数字 */
  size?: "small" | "medium" | "large" | number;
  /** 自定义类名 */
  className?: string;
  /** 是否只显示图标（不显示文字） */
  iconOnly?: boolean;
}

/** 尺寸映射 */
const SIZE_MAP = {
  small: 24,
  medium: 36,
  large: 48,
};

/** 图标尺寸映射（相对于容器尺寸） */
const ICON_SIZE_MAP = {
  small: 14,
  medium: 20,
  large: 28,
};

/**
 * 默认 Logo - 使用 Sparkles 图标
 */
function DefaultLogo({ size, iconSize }: { size: number; iconSize: number }) {
  return (
    <div
      className="bg-primary rounded-xl flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <Sparkles
        className="text-white"
        style={{ width: iconSize, height: iconSize }}
      />
    </div>
  );
}

/**
 * 获取完整的 Logo URL
 */
function getFullLogoUrl(url: string): string {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }
  return `${config.apiBaseUrl}${url}`;
}

/**
 * Logo 组件
 * 支持自定义图片 URL（从后台设置获取）或使用默认 Sparkles 图标
 */
export function Logo({
  size = "medium",
  className = "",
  iconOnly = false,
}: LogoProps) {
  const siteName = useSiteStore((state) => state.siteName);
  const logoUrl = useSiteStore((state) => state.siteLogo);
  const [imageError, setImageError] = useState(false);

  const sizeValue = typeof size === "number" ? size : SIZE_MAP[size];
  const iconSizeValue =
    typeof size === "number" ? Math.round(size * 0.55) : ICON_SIZE_MAP[size];

  const fullLogoUrl = getFullLogoUrl(logoUrl);

  // 当 logoUrl 变化时重置错误状态
  useEffect(() => {
    setImageError(false);
  }, [logoUrl]);

  const showCustomLogo = fullLogoUrl && !imageError;

  if (showCustomLogo) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <img
          src={fullLogoUrl}
          alt={siteName}
          width={sizeValue}
          height={sizeValue}
          className="rounded-xl object-contain"
          style={{ width: sizeValue, height: sizeValue }}
          onError={() => setImageError(true)}
        />
        {!iconOnly && (
          <span className="text-xl font-bold text-gray-900 dark:text-white">
            {siteName}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <DefaultLogo size={sizeValue} iconSize={iconSizeValue} />
      {!iconOnly && (
        <span className="text-xl font-bold text-gray-900 dark:text-white">
          {siteName}
        </span>
      )}
    </div>
  );
}

/**
 * Logo 图标组件（仅图标，无文字）
 */
export function LogoIcon({
  size = "medium",
  className = "",
}: Omit<LogoProps, "iconOnly">) {
  return <Logo size={size} className={className} iconOnly />;
}

export default Logo;
