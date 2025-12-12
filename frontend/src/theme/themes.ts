/**
 * Theme models and registry
 *
 * - Theme selection is applied via: <html data-theme="<id>">
 * - Light/Dark mode is applied via: <html class="dark">
 *
 * NOTE:
 * - Visual tokens (CSS variables) live in `@/theme/styles/themes.css`
 * - Ant Design tokens can be derived
 from `ThemeDefinition` (see `ThemeTokens`)
 */

export type ThemeId = "default" | "ocean" | "grape";

export interface ThemeTokens {
  /**
   * Ant Design v6 token candidates.
   * Keep this minimal and safe; you can extend later without breaking themes.
   */
  antdColorPrimary: string;
  antdColorInfo?: string;
  antdBorderRadius?: number;
}

/**
 * Antd 暗色模式额外的 token 配置
 * 这些值会在 darkAlgorithm 基础上覆盖
 */
export interface AntdDarkModeTokens {
  colorBgContainer: string;
  colorBgElevated: string;
  colorBgLayout: string;
  colorBgSpotlight: string;
  colorBorder: string;
  colorBorderSecondary: string;
  colorText: string;
  colorTextSecondary: string;
  colorTextTertiary: string;
  colorTextQuaternary: string;
}

/**
 * 默认的暗色模式 token 配置
 * 使用 slate 色系与 Tailwind 的暗色模式保持一致
 */
export const darkModeTokens: AntdDarkModeTokens = {
  colorBgContainer: "#1e293b",      // slate-800
  colorBgElevated: "#334155",       // slate-700
  colorBgLayout: "#0f172a",         // slate-900
  colorBgSpotlight: "#475569",      // slate-600
  colorBorder: "#334155",           // slate-700
  colorBorderSecondary: "#1e293b", // slate-800
  colorText: "#f1f5f9",             // slate-100
  colorTextSecondary: "#cbd5e1",    // slate-300
  colorTextTertiary: "#94a3b8",     // slate-400
  colorTextQuaternary: "#64748b",   // slate-500
};

export interface ThemeDefinition {
  /** Must match CSS `[data-theme="<id>"]` selectors. */
  id: ThemeId;
  /** Display name for UI selectors. */
  name: string;
  /** Optional short description for UI. */
  description?: string;

  /**
   * Primary color for light/dark.
   * Used by UI (e.g., theme picker preview) and can drive AntD token generation.
   */
  primary: {
    light: string;
    dark: string;
  };

  /**
   * Optional auth gradient preview (not required for runtime, CSS vars are source of truth).
   * Useful for theme picker thumbnails.
   */
  authGradient?: {
    light: { from: string; via: string; to: string };
    dark: { from: string; via: string; to: string };
  };

  /**
   * Optional tokens intended for component libraries (AntD).
   * If not provided, you can derive from `primary`.
   */
  tokens?: ThemeTokens;
}

export const themes: ReadonlyArray<ThemeDefinition> = [
  {
    id: "default",
    name: "Default",
    description: "Indigo brand with neutral glass",
    primary: {
      light: "#6366f1",
      dark: "#818cf8",
    },
    authGradient: {
      light: { from: "#2563eb", via: "#7c3aed", to: "#4338ca" },
      dark: { from: "#1d4ed8", via: "#6d28d9", to: "#3730a3" },
    },
    tokens: {
      antdColorPrimary: "#6366f1",
      antdColorInfo: "#6366f1",
      antdBorderRadius: 10,
    },
  },
  {
    id: "ocean",
    name: "Ocean",
    description: "Sky + green energy",
    primary: {
      light: "#0ea5e9",
      dark: "#38bdf8",
    },
    authGradient: {
      light: { from: "#0ea5e9", via: "#22c55e", to: "#2563eb" },
      dark: { from: "#0284c7", via: "#16a34a", to: "#1d4ed8" },
    },
    tokens: {
      antdColorPrimary: "#0ea5e9",
      antdColorInfo: "#0ea5e9",
      antdBorderRadius: 10,
    },
  },
  {
    id: "grape",
    name: "Grape",
    description: "Purple/pink modern AI vibe",
    primary: {
      light: "#a855f7",
      dark: "#c084fc",
    },
    authGradient: {
      light: { from: "#a855f7", via: "#ec4899", to: "#6366f1" },
      dark: { from: "#7e22ce", via: "#be185d", to: "#3730a3" },
    },
    tokens: {
      antdColorPrimary: "#a855f7",
      antdColorInfo: "#a855f7",
      antdBorderRadius: 10,
    },
  },
] as const;

export const defaultThemeId: ThemeId = "default";

export function isThemeId(value: string): value is ThemeId {
  return (themes as ReadonlyArray<ThemeDefinition>).some((t) => t.id === value);
}

export function getTheme(themeId: ThemeId): ThemeDefinition {
  const found = (themes as ReadonlyArray<ThemeDefinition>).find(
    (t) => t.id === themeId,
  );
  if (!found) {
    // Should be impossible if callers use ThemeId
    return (themes as ReadonlyArray<ThemeDefinition>).find(
      (t) => t.id === defaultThemeId,
    ) as ThemeDefinition;
  }
  return found;
}
