import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  // 设置别名
  resolve: {
    alias: {
      '@': '/src',
    },
  },
  plugins: [
    // 项目使用代码路由（code-based routing），不需要 tanstackRouter 文件路由生成器
    react({
      babel: {
        plugins: [['babel-plugin-react-compiler']],
      },
    }),
    tailwindcss(),
  ],
})
