import { defineI18n } from 'fumadocs-core/i18n';

export const i18n = defineI18n({
  defaultLanguage: 'zh',
  languages: ['zh', 'en', 'ja'],
  // 使用目录模式，如 content/docs/zh/index.mdx, content/docs/en/index.mdx
  parser: 'dir',
});

// 语言显示名称
export const languageLabels: Record<string, string> = {
  zh: '简体中文',
  en: 'English',
  ja: '日本語',
};
