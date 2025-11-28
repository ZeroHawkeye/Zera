import { RootProvider } from 'fumadocs-ui/provider/next';
import { defineI18nUI } from 'fumadocs-ui/i18n';
import { i18n } from '@/lib/i18n';
import '../global.css';
import { Inter } from 'next/font/google';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';

const inter = Inter({
  subsets: ['latin'],
});

// UI 翻译配置
const { provider } = defineI18nUI(i18n, {
  translations: {
    zh: {
      displayName: '简体中文',
      search: '搜索文档',
      searchNoResult: '没有找到结果',
      toc: '目录',
      tocNoHeadings: '没有标题',
      lastUpdate: '最后更新于',
      chooseTheme: '选择主题',
      nextPage: '下一页',
      previousPage: '上一页',
      editOnGithub: '在 GitHub 上编辑',
    },
    en: {
      displayName: 'English',
    },
  },
});

export const metadata: Metadata = {
  title: {
    default: 'Zera Admin',
    template: '%s | Zera Admin',
  },
  description: '一个基于 Protocol Buffers 的现代化全栈开发框架，让前后端开发更简单、更高效、更类型安全。',
  keywords: ['Zera', 'Admin', 'Protocol Buffers', 'Go', 'React', 'TypeScript', 'Connect-RPC'],
  authors: [{ name: 'Zera Team' }],
};

export default async function RootLayout({
  params,
  children,
}: {
  params: Promise<{ lang: string }>;
  children: ReactNode;
}) {
  const { lang } = await params;

  return (
    <html lang={lang} className={inter.className} suppressHydrationWarning>
      <body className="flex flex-col min-h-screen">
        <RootProvider i18n={provider(lang)}>{children}</RootProvider>
      </body>
    </html>
  );
}
