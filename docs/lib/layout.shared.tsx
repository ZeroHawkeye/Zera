import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import { BookOpen, Home } from 'lucide-react';

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      enabled: true,
      title: (
        <span className="font-bold text-lg bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
          Zera
        </span>
      ),
    },
    links: [
      {
        text: '首页',
        url: '/',
        icon: <Home className="w-4 h-4" />,
      },
      {
        text: '文档',
        url: '/docs',
        icon: <BookOpen className="w-4 h-4" />,
      },
    ],
    githubUrl: 'https://github.com/ZeroHawkeye/Zera',
  };
}
