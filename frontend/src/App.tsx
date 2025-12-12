import { RouterProvider } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { ConfigProvider, Spin, theme as antdTheme } from "antd";
import { router } from "./router/router";
import { useAuthStore, useSiteStore, useThemeStore } from "./stores";
import { useFavicon } from "./hooks";
import { darkModeTokens } from "./theme/themes";

// 创建 QueryClient 实例
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 分钟
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  const [isInitialized, setIsInitialized] = useState(false);
  const initializeAuth = useAuthStore((state) => state.initialize);
  const initializeSite = useSiteStore((state) => state.initialize);

  const initializeTheme = useThemeStore((state) => state.initialize);

  const resolvedMode = useThemeStore((state) => state.resolvedMode);
  const getThemeDefinition = useThemeStore((state) => state.getThemeDefinition);

  // 动态更新 favicon
  useFavicon();

  useEffect(() => {
    // Theme should be applied ASAP so the first paint uses correct CSS vars.
    initializeTheme();
  }, [initializeTheme]);

  useEffect(() => {
    const init = async () => {
      try {
        // 并行初始化认证和站点设置
        await Promise.all([initializeAuth(), initializeSite()]);
      } finally {
        setIsInitialized(true);
      }
    };
    init();
  }, [initializeAuth, initializeSite]);

  const antdConfig = useMemo(() => {
    const def = getThemeDefinition();
    const primary =
      resolvedMode === "dark" ? def.primary.dark : def.primary.light;

    const baseToken = {
      colorPrimary: primary,
      colorInfo: primary,
      borderRadius: def.tokens?.antdBorderRadius ?? 10,
    };

    return {
      algorithm:
        resolvedMode === "dark"
          ? antdTheme.darkAlgorithm
          : antdTheme.defaultAlgorithm,
      token: resolvedMode === "dark"
        ? { ...baseToken, ...darkModeTokens }
        : baseToken,
    };
  }, [getThemeDefinition, resolvedMode]);

  // 初始化加载状态
  if (!isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="text-center">
          <Spin size="large" />
          <p className="mt-4 text-gray-600">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <ConfigProvider theme={antdConfig}>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </ConfigProvider>
  );
}

export default App;
