/**
 * 翻译系统配置
 */

import type { TranslateConfig, LanguageConfig } from './types.mts';

// ============= 语言配置 =============
// 在这里配置默认语言和目标翻译语言

export const languageConfig: LanguageConfig = {
  /** 默认/源语言 - 文档的原始语言 */
  defaultLocale: 'zh',
  
  /** 目标语言列表 - 需要翻译成的语言 */
  targetLocales: [
    'en',  // 英语
    // 'ja',  // 日语（取消注释启用）
    // 'ko',  // 韩语
    // 'es',  // 西班牙语
    // 'fr',  // 法语
    // 'de',  // 德语
  ],
};

// ============= 翻译配置 =============

export const defaultConfig: TranslateConfig = {
  provider: (process.env.AI_PROVIDER as 'openai' | 'anthropic') || 'openai',
  openai: {
    apiKey: process.env.OPENAI_API_KEY || 'sk-5a7bd2e52ab541fbafbb7b39780e88fb',
    baseUrl: process.env.OPENAI_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    model: process.env.OPENAI_MODEL || 'qwen-plus',
  },
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY || '',
    model: process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022',
  },
  languages: languageConfig,
  chunking: {
    maxTokensPerChunk: 3000, // 保守估计，留出上下文空间
    overlapLines: 2, // 段落之间重叠的行数，用于保持连贯性
  },
  parallel: {
    maxConcurrency: 3, // 最大并发翻译数
    delayBetweenRequests: 300, // 请求间延迟（毫秒）
  },
  cache: {
    enabled: true,
    dir: '.translate-cache',
  },
};

/**
 * 获取配置，合并默认配置和自定义配置
 */
export function getConfig(overrides?: Partial<TranslateConfig>): TranslateConfig {
  if (!overrides) return defaultConfig;
  
  return {
    ...defaultConfig,
    ...overrides,
    openai: { ...defaultConfig.openai, ...overrides.openai },
    anthropic: { ...defaultConfig.anthropic, ...overrides.anthropic },
    languages: { ...defaultConfig.languages, ...overrides.languages },
    chunking: { ...defaultConfig.chunking, ...overrides.chunking },
    parallel: { ...defaultConfig.parallel, ...overrides.parallel },
    cache: { ...defaultConfig.cache, ...overrides.cache },
  };
}
