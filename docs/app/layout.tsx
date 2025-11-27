import { RootProvider } from 'fumadocs-ui/provider/next';
import './global.css';
import { Inter } from 'next/font/google';
import type { Metadata } from 'next';

const inter = Inter({
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: {
    default: 'Zera Framework',
    template: '%s | Zera',
  },
  description: '一个基于 Protocol Buffers 的现代化全栈开发框架，让前后端开发更简单、更高效、更类型安全。',
  keywords: ['Zera', 'Framework', 'Protocol Buffers', 'Go', 'React', 'TypeScript', 'Connect-RPC'],
  authors: [{ name: 'Zera Team' }],
};

export default function Layout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="zh-CN" className={inter.className} suppressHydrationWarning>
      <body className="flex flex-col min-h-screen">
        <RootProvider>{children}</RootProvider>
      </body>
    </html>
  );
}
