/**
 * 翻译系统类型定义
 */

// ============= 语言配置类型 =============

export interface LanguageConfig {
  /** 默认/源语言代码 */
  defaultLocale: string;
  /** 目标翻译语言列表 */
  targetLocales: string[];
}

// ============= 配置类型 =============

export interface TranslateConfig {
  provider: 'openai' | 'anthropic';
  openai: {
    apiKey: string;
    baseUrl: string;
    model: string;
  };
  anthropic: {
    apiKey: string;
    model: string;
  };
  // 语言配置
  languages: LanguageConfig;
  // 分段配置
  chunking: {
    maxTokensPerChunk: number;
    overlapLines: number;
  };
  // 并行配置
  parallel: {
    maxConcurrency: number;
    delayBetweenRequests: number;
  };
  // 缓存配置
  cache: {
    enabled: boolean;
    dir: string;
  };
}

// ============= 文档解析类型 =============

export interface Frontmatter {
  title?: string;
  description?: string;
  [key: string]: unknown;
}

export interface DocumentSection {
  id: string;
  type: 'frontmatter' | 'import' | 'heading' | 'content' | 'codeblock' | 'component';
  level?: number; // 标题级别 1-6
  title?: string;
  content: string;
  startLine: number;
  endLine: number;
  translatable: boolean; // 是否需要翻译
  children?: DocumentSection[];
}

export interface ParsedDocument {
  filePath: string;
  frontmatter: Frontmatter | null;
  sections: DocumentSection[];
  rawContent: string;
  hash: string; // 内容哈希，用于检测变更
}

// ============= 翻译块类型 =============

export interface TranslationChunk {
  id: string;
  sectionIds: string[]; // 包含的 section IDs
  content: string;
  translatedContent?: string;
  context: ChunkContext;
  tokenEstimate: number;
  status: 'pending' | 'translating' | 'completed' | 'failed';
  error?: string;
}

export interface ChunkContext {
  // 文档级上下文
  documentTitle: string;
  documentDescription: string;
  documentType: 'api' | 'guide' | 'tutorial' | 'reference' | 'other';
  
  // 结构上下文
  outline: string[]; // 所有标题
  currentPosition: number; // 当前在大纲中的位置
  previousSummary?: string; // 前一段摘要
  nextSummary?: string; // 后一段摘要
  
  // 术语表
  glossary: Record<string, string>;
}

// ============= 缓存类型 =============

export interface TranslationCache {
  version: string;
  files: Record<string, FileCacheEntry>;
}

export interface FileCacheEntry {
  sourceHash: string;
  targetHash: string;
  translatedAt: string;
  sourceLang: string;
  targetLang: string;
  sections?: SectionCacheEntry[];
}

export interface SectionCacheEntry {
  id: string;
  sourceHash: string;
  translatedContent: string;
}

// ============= 术语表类型 =============

export interface Glossary {
  version: string;
  lastUpdated: string;
  terms: GlossaryEntry[];
}

export interface GlossaryEntry {
  source: string;
  translations: Record<string, string>; // lang -> translation
  context?: string; // 使用上下文说明
  category?: string; // 分类：技术术语、产品名称等
}

// ============= 翻译结果类型 =============

export interface TranslationResult {
  success: boolean;
  sourceFile: string;
  targetFile: string;
  translated: boolean;
  skipped: boolean;
  reason?: string;
  error?: string;
  chunks?: {
    total: number;
    successful: number;
    failed: number;
  };
}

export interface TranslationStats {
  totalFiles: number;
  translated: number;
  skipped: number;
  failed: number;
  cached: number;
  totalChunks: number;
  successfulChunks: number;
  failedChunks: number;
  startTime: number;
  endTime?: number;
}

// ============= 语言映射 =============

export const languageNames: Record<string, string> = {
  zh: 'Chinese (Simplified)',
  en: 'English',
  ja: 'Japanese',
  ko: 'Korean',
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  pt: 'Portuguese',
  ru: 'Russian',
};
