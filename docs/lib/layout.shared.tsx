import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import { Home } from 'lucide-react';
import { i18n } from '@/lib/i18n';

// 多语言导航文本
const navTexts = {
  zh: {
    home: '首页',
  },
  en: {
    home: 'Home',
  },
};

export function baseOptions(locale: string): BaseLayoutProps {
  const t = navTexts[locale as keyof typeof navTexts] || navTexts.zh;
  
  return {
    i18n,
    nav: {
      enabled: true,
      title: (
        <span className="font-bold text-lg text-primary">
          Zera Admin
        </span>
      ),
    },
    links: [
      {
        text: t.home,
        url: `/${locale}`,
        icon: <Home className="w-4 h-4" />,
      },
    ],
    githubUrl: 'https://github.com/ZeroHawkeye/Zera',
  };
}
