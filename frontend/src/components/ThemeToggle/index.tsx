/**
 * 主题切换下拉菜单组件
 * 支持浅色、深色、跟随系统三种模式
 */

import { Dropdown } from "antd";
import type { MenuProps } from "antd";
import { Sun, Moon, Monitor, Check } from "lucide-react";
import { useThemeStore } from "@/stores";
import type { ThemeMode } from "@/theme/applyTheme";

/** 模式配置 */
const MODE_CONFIG: Record<
  ThemeMode,
  { icon: React.ReactNode; label: string }
> = {
  light: {
    icon: <Sun className="w-4 h-4" />,
    label: "浅色模式",
  },
  dark: {
    icon: <Moon className="w-4 h-4" />,
    label: "深色模式",
  },
  system: {
    icon: <Monitor className="w-4 h-4" />,
    label: "跟随系统",
  },
};

/** 当前模式对应的触发器图标 */
function ModeIcon({ mode }: { mode: ThemeMode }) {
  const iconClass = "w-5 h-5";
  switch (mode) {
    case "light":
      return <Sun className={iconClass} />;
    case "dark":
      return <Moon className={iconClass} />;
    case "system":
      return <Monitor className={iconClass} />;
  }
}

export function ThemeToggle() {
  const mode = useThemeStore((state) => state.mode);
  const setMode = useThemeStore((state) => state.setMode);

  const menuItems: MenuProps["items"] = (
    Object.keys(MODE_CONFIG) as ThemeMode[]
  ).map((key) => ({
    key,
    icon: MODE_CONFIG[key].icon,
    label: (
      <span className="flex items-center justify-between gap-4">
        {MODE_CONFIG[key].label}
        {mode === key && (
          <Check className="w-4 h-4 text-primary" />
        )}
      </span>
    ),
    onClick: () => setMode(key),
  }));

  return (
    <Dropdown
      menu={{ items: menuItems, selectedKeys: [mode] }}
      trigger={["click"]}
      placement="bottomRight"
    >
      <button
        className="p-2 hover:bg-interactive rounded-xl transition-all duration-200 text-tertiary hover:text-default"
        title={MODE_CONFIG[mode].label}
      >
        <ModeIcon mode={mode} />
      </button>
    </Dropdown>
  );
}
