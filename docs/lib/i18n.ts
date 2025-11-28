import { defineI18n } from 'fumadocs-core/i18n';

export const i18n = defineI18n({
  defaultLanguage: 'zh',
  languages: ['zh', 'en'],
  // 使用文件名后缀模式，如 index.en.mdx
  parser: 'dot',
});

// 语言显示名称
export const languageLabels: Record<string, string> = {
  zh: '简体中文',
  en: 'English',
  // 日语
  ja: '日本語',
};
