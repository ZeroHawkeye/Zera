/**
 * Theme state management (persisted)
 *
 * Responsibilities:
 * - Persist theme selection + color mode
 * - Apply theme to DOM (<html data-theme="..."> + "dark" class)
 * - Optionally follow system color scheme when mode === "system"
 *
 * NOTE:
 * - Visual tokens are defined in `@/theme/styles/themes.css`
 * - DOM application helpers live in `@/theme/applyTheme`
 */

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  applyThemeToDom,
  resolveMode,
  subscribeSystemThemeChange,
  type ThemeMode,
} from "@/theme/applyTheme";
import { defaultThemeId, getTheme, type ThemeId } from "@/theme/themes";

export interface ThemeState {
  /** Current theme id (maps to CSS `[data-theme="<id>"]`) */
  themeId: ThemeId;

  /** Light/Dark selection behavior */
  mode: ThemeMode;

  /** The resolved mode currently applied on DOM */
  resolvedMode: Exclude<ThemeMode, "system">;

  /** Initialize from persisted state and apply to DOM */
  initialize: () => void;

  /** Set theme id and apply to DOM */
  setThemeId: (themeId: ThemeId) => void;

  /** Set mode and apply to DOM; if system, subscribe to OS changes */
  setMode: (mode: ThemeMode) => void;

  /** Convenience helpers */
  toggleMode: () => void;
  toggleDark: () => void;

  /** Obtain theme definition for UI/AntD token generation */
  getThemeDefinition: () => ReturnType<typeof getTheme>;

  /** Internal: unsubscribe from system listener (only active when mode === "system") */
  _systemUnsubscribe: (() => void) | null;
}

const STORAGE_KEY = "theme-storage";

/**
 * Apply state to DOM consistently.
 * Centralizes side effects so actions remain small and safe.
 */
function applyStateToDom(
  themeId: ThemeId,
  mode: ThemeMode,
): Exclude<ThemeMode, "system"> {
  applyThemeToDom({ themeId, mode });
  return resolveMode(mode);
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      themeId: defaultThemeId,
      mode: "system",
      resolvedMode: "light",

      _systemUnsubscribe: null,

      initialize: () => {
        const { themeId, mode, _systemUnsubscribe } = get();

        // Apply once on init
        const resolved = applyStateToDom(themeId, mode);
        set({ resolvedMode: resolved });

        // Reset any existing subscription
        if (_systemUnsubscribe) {
          _systemUnsubscribe();
          set({ _systemUnsubscribe: null });
        }

        // If following system, subscribe to changes and re-apply
        if (mode === "system") {
          const unsub = subscribeSystemThemeChange(() => {
            const { themeId: currentThemeId, mode: currentMode } = get();
            const nextResolved = applyStateToDom(currentThemeId, currentMode);
            set({ resolvedMode: nextResolved });
          });
          set({ _systemUnsubscribe: unsub });
        }
      },

      setThemeId: (themeId) => {
        const { mode } = get();
        const resolved = applyStateToDom(themeId, mode);
        set({ themeId, resolvedMode: resolved });
      },

      setMode: (mode) => {
        const { themeId, _systemUnsubscribe } = get();

        // Stop previous system subscription if present
        if (_systemUnsubscribe) {
          _systemUnsubscribe();
          set({ _systemUnsubscribe: null });
        }

        const resolved = applyStateToDom(themeId, mode);
        set({ mode, resolvedMode: resolved });

        if (mode === "system") {
          const unsub = subscribeSystemThemeChange(() => {
            const { themeId: currentThemeId, mode: currentMode } = get();
            const nextResolved = applyStateToDom(currentThemeId, currentMode);
            set({ resolvedMode: nextResolved });
          });
          set({ _systemUnsubscribe: unsub });
        }
      },

      toggleMode: () => {
        const { mode } = get();
        if (mode === "light") get().setMode("dark");
        else if (mode === "dark") get().setMode("system");
        else get().setMode("light");
      },

      toggleDark: () => {
        const { resolvedMode } = get();
        get().setMode(resolvedMode === "dark" ? "light" : "dark");
      },

      getThemeDefinition: () => {
        const { themeId } = get();
        return getTheme(themeId);
      },
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      version: 1,
      partialize: (state) => ({
        themeId: state.themeId,
        mode: state.mode,
      }),
    },
  ),
);
