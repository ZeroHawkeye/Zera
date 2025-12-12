import type { ThemeId } from "./themes";
import { defaultThemeId, isThemeId } from "./themes";

export type ThemeMode = "light" | "dark" | "system";

export interface ApplyThemeOptions {
  /**
   * Theme id to apply via: <html data-theme="...">
   * Must match CSS selectors in `@/theme/styles/themes.css`.
   */
  themeId: ThemeId;

  /**
   * Light/Dark mode to apply via toggling `dark` class on <html>.
   * - "light": remove `dark`
   * - "dark": add `dark`
   * - "system": follow OS preference (matchMedia)
   */
  mode: ThemeMode;
}

/**
 * Reads the current themeId from <html data-theme="..."> and validates it.
 */
export function getDomThemeId(): ThemeId {
  const el = document.documentElement;
  const raw = el.getAttribute("data-theme");
  if (raw && isThemeId(raw)) return raw;
  return defaultThemeId;
}

/**
 * Returns whether the DOM currently has dark mode active (`html.dark`).
 * Note: In "system" mode this reflects the resolved result.
 */
export function isDomDark(): boolean {
  return document.documentElement.classList.contains("dark");
}

/**
 *
 Resolves "system" mode into concrete "light" | "dark".
 */
export function resolveMode(mode: ThemeMode): Exclude<ThemeMode, "system"> {
  if (mode !== "system") return mode;

  const prefersDark =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;

  return prefersDark ? "dark" : "light";
}

/**
 * Apply theme to the DOM:
 * - sets <html data-theme="...">
 * - toggles <html class="dark"> based on resolved mode
 */
export function applyThemeToDom(options: ApplyThemeOptions): void {
  const el = document.documentElement;

  // Theme id for multi-theme CSS var overrides
  el.setAttribute("data-theme", options.themeId);

  // Expose in a CSS var too (useful for debugging / minor CSS logic)
  el.style.setProperty("--theme-id", options.themeId);

  const resolved = resolveMode(options.mode);
  if (resolved === "dark") {
    el.classList.add("dark");
  } else {
    el.classList.remove("dark");
  }
}

/**
 * Listen to OS color scheme changes.
 * Returns an unsubscribe function.
 *
 * Intended usage:
 * - If your app is in "system" mode, subscribe and re-apply on changes.
 * - If not in "system" mode, do not subscribe.
 */
export function subscribeSystemThemeChange(
  onChange: (resolved: Exclude<ThemeMode, "system">) => void,
): () => void {
  if (
    typeof window === "undefined" ||
    typeof window.matchMedia !== "function"
  ) {
    return () => {};
  }

  const mql = window.matchMedia("(prefers-color-scheme: dark)");

  const handler = () => {
    onChange(mql.matches ? "dark" : "light");
  };

  // Initial notify (optional but typically desired)
  handler();

  // Modern + legacy compatibility
  if (typeof mql.addEventListener === "function") {
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }

  // eslint-disable-next-line deprecation/deprecation
  mql.addListener(handler);
  // eslint-disable-next-line deprecation/deprecation
  return () => mql.removeListener(handler);
}

/**
 * Coerce any string to a safe ThemeId.
 */
export function coerceThemeId(value: string | null | undefined): ThemeId {
  if (value && isThemeId(value)) return value;
  return defaultThemeId;
}
