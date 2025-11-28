/**
 * 术语表管理模块
 * 
 * 维护项目术语表，确保翻译一致性
 */

import { readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import type { Glossary, GlossaryEntry } from './types.mts';

const GLOSSARY_VERSION = '1.0.0';

/**
 * 默认术语表
 * 包含常见技术术语的翻译
 */
const defaultTerms: GlossaryEntry[] = [
  // 通用技术术语
  { source: '认证', translations: { en: 'authentication' }, category: 'tech' },
  { source: '授权', translations: { en: 'authorization' }, category: 'tech' },
  { source: '令牌', translations: { en: 'token' }, category: 'tech' },
  { source: '接口', translations: { en: 'API' }, category: 'tech' },
  { source: '端点', translations: { en: 'endpoint' }, category: 'tech' },
  { source: '请求', translations: { en: 'request' }, category: 'tech' },
  { source: '响应', translations: { en: 'response' }, category: 'tech' },
  { source: '服务', translations: { en: 'service' }, category: 'tech' },
  { source: '客户端', translations: { en: 'client' }, category: 'tech' },
  { source: '服务端', translations: { en: 'server' }, category: 'tech' },
  { source: '中间件', translations: { en: 'middleware' }, category: 'tech' },
  { source: '路由', translations: { en: 'routing' }, category: 'tech' },
  { source: '部署', translations: { en: 'deployment' }, category: 'tech' },
  { source: '配置', translations: { en: 'configuration' }, category: 'tech' },
  { source: '依赖', translations: { en: 'dependency' }, category: 'tech' },
  { source: '模块', translations: { en: 'module' }, category: 'tech' },
  { source: '组件', translations: { en: 'component' }, category: 'tech' },
  { source: '钩子', translations: { en: 'hook' }, category: 'tech' },
  { source: '状态', translations: { en: 'state' }, category: 'tech' },
  { source: '属性', translations: { en: 'property' }, category: 'tech' },
  { source: '参数', translations: { en: 'parameter' }, category: 'tech' },
  { source: '返回值', translations: { en: 'return value' }, category: 'tech' },
  { source: '类型', translations: { en: 'type' }, category: 'tech' },
  { source: '枚举', translations: { en: 'enum' }, category: 'tech' },
  { source: '结构体', translations: { en: 'struct' }, category: 'tech' },
  { source: '协议', translations: { en: 'protocol' }, category: 'tech' },
  
  // 文档相关
  { source: '快速开始', translations: { en: 'Quick Start' }, category: 'doc' },
  { source: '入门指南', translations: { en: 'Getting Started' }, category: 'doc' },
  { source: '安装', translations: { en: 'Installation' }, category: 'doc' },
  { source: '使用方法', translations: { en: 'Usage' }, category: 'doc' },
  { source: '示例', translations: { en: 'Example' }, category: 'doc' },
  { source: '注意', translations: { en: 'Note' }, category: 'doc' },
  { source: '警告', translations: { en: 'Warning' }, category: 'doc' },
  { source: '提示', translations: { en: 'Tip' }, category: 'doc' },
  { source: '另请参阅', translations: { en: 'See Also' }, category: 'doc' },
  { source: '相关链接', translations: { en: 'Related Links' }, category: 'doc' },
];

/**
 * 术语表管理器
 */
export class GlossaryManager {
  private glossaryFile: string;
  private glossary: Glossary;
  private termMap: Map<string, GlossaryEntry> = new Map();
  private dirty: boolean = false;

  constructor(docsDir: string) {
    this.glossaryFile = join(docsDir, 'glossary.json');
    this.glossary = {
      version: GLOSSARY_VERSION,
      lastUpdated: new Date().toISOString(),
      terms: [],
    };
  }

  /**
   * 加载术语表
   */
  async load(): Promise<void> {
    try {
      if (existsSync(this.glossaryFile)) {
        const content = await readFile(this.glossaryFile, 'utf-8');
        const loaded = JSON.parse(content) as Glossary;
        
        if (loaded.version === GLOSSARY_VERSION) {
          this.glossary = loaded;
        } else {
          // 版本不匹配，合并默认术语
          this.glossary = {
            ...loaded,
            version: GLOSSARY_VERSION,
            terms: this.mergeTerms(loaded.terms, defaultTerms),
          };
          this.dirty = true;
        }
      } else {
        // 使用默认术语表
        this.glossary.terms = [...defaultTerms];
        this.dirty = true;
      }

      // 构建查找映射
      this.buildTermMap();
    } catch (error) {
      console.warn('⚠️ Failed to load glossary, using defaults:', error);
      this.glossary.terms = [...defaultTerms];
      this.buildTermMap();
    }
  }

  /**
   * 保存术语表
   */
  async save(): Promise<void> {
    if (!this.dirty) return;

    try {
      this.glossary.lastUpdated = new Date().toISOString();
      await writeFile(this.glossaryFile, JSON.stringify(this.glossary, null, 2), 'utf-8');
      this.dirty = false;
      console.log('📚 Glossary saved');
    } catch (error) {
      console.warn('⚠️ Failed to save glossary:', error);
    }
  }

  /**
   * 构建术语查找映射
   */
  private buildTermMap(): void {
    this.termMap.clear();
    for (const term of this.glossary.terms) {
      this.termMap.set(term.source.toLowerCase(), term);
    }
  }

  /**
   * 合并术语表
   */
  private mergeTerms(existing: GlossaryEntry[], defaults: GlossaryEntry[]): GlossaryEntry[] {
    const merged = new Map<string, GlossaryEntry>();
    
    // 先添加默认术语
    for (const term of defaults) {
      merged.set(term.source.toLowerCase(), term);
    }
    
    // 用已存在的术语覆盖（保留用户自定义）
    for (const term of existing) {
      merged.set(term.source.toLowerCase(), term);
    }
    
    return Array.from(merged.values());
  }

  /**
   * 获取术语翻译
   */
  getTranslation(source: string, targetLang: string): string | undefined {
    const term = this.termMap.get(source.toLowerCase());
    return term?.translations[targetLang];
  }

  /**
   * 添加或更新术语
   */
  addTerm(entry: GlossaryEntry): void {
    const existing = this.termMap.get(entry.source.toLowerCase());
    if (existing) {
      // 合并翻译
      existing.translations = { ...existing.translations, ...entry.translations };
      if (entry.context) existing.context = entry.context;
      if (entry.category) existing.category = entry.category;
    } else {
      this.glossary.terms.push(entry);
      this.termMap.set(entry.source.toLowerCase(), entry);
    }
    this.dirty = true;
  }

  /**
   * 获取特定语言对的所有术语
   */
  getTermsForLanguagePair(sourceLang: string, targetLang: string): Record<string, string> {
    const terms: Record<string, string> = {};
    
    for (const entry of this.glossary.terms) {
      const translation = entry.translations[targetLang];
      if (translation) {
        terms[entry.source] = translation;
      }
    }
    
    return terms;
  }

  /**
   * 格式化术语表为 prompt 友好的格式
   */
  formatForPrompt(targetLang: string): string {
    const terms = this.getTermsForLanguagePair('zh', targetLang);
    const entries = Object.entries(terms);
    
    if (entries.length === 0) {
      return '';
    }
    
    const lines = entries.map(([source, target]) => `- "${source}" → "${target}"`);
    return lines.join('\n');
  }

  /**
   * 获取统计信息
   */
  getStats(): { totalTerms: number; categories: Record<string, number> } {
    const categories: Record<string, number> = {};
    
    for (const term of this.glossary.terms) {
      const cat = term.category || 'other';
      categories[cat] = (categories[cat] || 0) + 1;
    }
    
    return {
      totalTerms: this.glossary.terms.length,
      categories,
    };
  }
}
