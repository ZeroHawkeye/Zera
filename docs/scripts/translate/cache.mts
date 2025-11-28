/**
 * 缓存管理模块
 * 
 * 使用内容哈希来检测文件变更，避免重复翻译
 */

import { createHash } from 'crypto';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import type { TranslationCache, FileCacheEntry, SectionCacheEntry } from './types.mts';

const CACHE_VERSION = '1.0.0';

/**
 * 计算内容的 SHA256 哈希
 */
export function computeHash(content: string): string {
  return createHash('sha256').update(content, 'utf-8').digest('hex').slice(0, 16);
}

/**
 * 缓存管理器
 */
export class CacheManager {
  private cacheDir: string;
  private cacheFile: string;
  private cache: TranslationCache;
  private dirty: boolean = false;

  constructor(cacheDir: string) {
    this.cacheDir = cacheDir;
    this.cacheFile = join(cacheDir, 'cache.json');
    this.cache = { version: CACHE_VERSION, files: {} };
  }

  /**
   * 加载缓存
   */
  async load(): Promise<void> {
    try {
      if (existsSync(this.cacheFile)) {
        const content = await readFile(this.cacheFile, 'utf-8');
        const loaded = JSON.parse(content) as TranslationCache;
        
        // 检查版本兼容性
        if (loaded.version === CACHE_VERSION) {
          this.cache = loaded;
        } else {
          console.log('📦 Cache version mismatch, starting fresh');
          this.cache = { version: CACHE_VERSION, files: {} };
        }
      }
    } catch (error) {
      console.warn('⚠️ Failed to load cache, starting fresh:', error);
      this.cache = { version: CACHE_VERSION, files: {} };
    }
  }

  /**
   * 保存缓存
   */
  async save(): Promise<void> {
    if (!this.dirty) return;

    try {
      if (!existsSync(this.cacheDir)) {
        await mkdir(this.cacheDir, { recursive: true });
      }
      await writeFile(this.cacheFile, JSON.stringify(this.cache, null, 2), 'utf-8');
      this.dirty = false;
    } catch (error) {
      console.warn('⚠️ Failed to save cache:', error);
    }
  }

  /**
   * 获取文件缓存条目
   */
  getFileEntry(filePath: string): FileCacheEntry | undefined {
    return this.cache.files[filePath];
  }

  /**
   * 检查文件是否需要翻译
   * 返回 true 表示需要翻译，false 表示可以使用缓存
   */
  needsTranslation(
    filePath: string, 
    sourceContent: string, 
    sourceLang: string, 
    targetLang: string
  ): boolean {
    const entry = this.cache.files[filePath];
    if (!entry) return true;

    // 检查语言对是否匹配
    if (entry.sourceLang !== sourceLang || entry.targetLang !== targetLang) {
      return true;
    }

    // 检查源内容是否变更
    const currentHash = computeHash(sourceContent);
    return entry.sourceHash !== currentHash;
  }

  /**
   * 获取需要更新的段落
   * 返回需要重新翻译的 section IDs
   */
  getChangedSections(
    filePath: string,
    sections: Array<{ id: string; content: string }>
  ): string[] {
    const entry = this.cache.files[filePath];
    if (!entry || !entry.sections) {
      // 没有缓存，所有段落都需要翻译
      return sections.map(s => s.id);
    }

    const sectionCache = new Map(entry.sections.map(s => [s.id, s]));
    const changed: string[] = [];

    for (const section of sections) {
      const cached = sectionCache.get(section.id);
      if (!cached || cached.sourceHash !== computeHash(section.content)) {
        changed.push(section.id);
      }
    }

    return changed;
  }

  /**
   * 获取缓存的段落翻译
   */
  getCachedSection(filePath: string, sectionId: string): string | undefined {
    const entry = this.cache.files[filePath];
    if (!entry || !entry.sections) return undefined;

    const section = entry.sections.find(s => s.id === sectionId);
    return section?.translatedContent;
  }

  /**
   * 更新文件缓存
   */
  updateFileEntry(
    filePath: string,
    sourceContent: string,
    targetContent: string,
    sourceLang: string,
    targetLang: string,
    sections?: Array<{ id: string; content: string; translatedContent: string }>
  ): void {
    const sectionEntries: SectionCacheEntry[] | undefined = sections?.map(s => ({
      id: s.id,
      sourceHash: computeHash(s.content),
      translatedContent: s.translatedContent,
    }));

    this.cache.files[filePath] = {
      sourceHash: computeHash(sourceContent),
      targetHash: computeHash(targetContent),
      translatedAt: new Date().toISOString(),
      sourceLang,
      targetLang,
      sections: sectionEntries,
    };
    
    this.dirty = true;
  }

  /**
   * 清除特定文件的缓存
   */
  invalidateFile(filePath: string): void {
    delete this.cache.files[filePath];
    this.dirty = true;
  }

  /**
   * 清除所有缓存
   */
  clear(): void {
    this.cache = { version: CACHE_VERSION, files: {} };
    this.dirty = true;
  }

  /**
   * 获取缓存统计
   */
  getStats(): { totalFiles: number; totalSections: number } {
    let totalSections = 0;
    for (const entry of Object.values(this.cache.files)) {
      totalSections += entry.sections?.length || 0;
    }
    return {
      totalFiles: Object.keys(this.cache.files).length,
      totalSections,
    };
  }
}
