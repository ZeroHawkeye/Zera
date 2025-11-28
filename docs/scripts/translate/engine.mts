/**
 * 翻译引擎 - 协调所有翻译模块
 */

import { CacheManager, computeHash } from './cache.mts';
import { GlossaryManager } from './glossary.mts';
import { parseDocument, createTranslationChunks, reassembleDocument, detectDocumentType } from './parser.mts';
import { translateChunks, buildChunkContext } from './translator.mts';
import { safeReadFile, safeWriteFile } from './utils.mts';
import type { TranslateConfig, TranslationResult, DocumentSection } from './types.mts';

export class TranslationEngine {
  private cache: CacheManager;
  private glossary: GlossaryManager;
  private config: TranslateConfig;

  constructor(config: TranslateConfig, cacheDir: string, docsDir: string) {
    this.config = config;
    this.cache = new CacheManager(cacheDir);
    this.glossary = new GlossaryManager(docsDir);
  }

  /**
   * 初始化引擎
   */
  async initialize(): Promise<void> {
    if (this.config.cache.enabled) {
      await this.cache.load();
      const cacheStats = this.cache.getStats();
      if (cacheStats.totalFiles > 0) {
        console.log(`📦 Loaded cache: ${cacheStats.totalFiles} files, ${cacheStats.totalSections} sections`);
      }
    }

    await this.glossary.load();
    const glossaryStats = this.glossary.getStats();
    console.log(`📚 Loaded glossary: ${glossaryStats.totalTerms} terms`);
  }

  /**
   * 关闭引擎，保存状态
   */
  async shutdown(): Promise<void> {
    if (this.config.cache.enabled) {
      await this.cache.save();
    }
    await this.glossary.save();
  }

  /**
   * 翻译单个文件
   */
  async translateFile(
    sourceFile: string,
    targetFile: string,
    sourceLang: string,
    targetLang: string,
    force: boolean = false
  ): Promise<TranslationResult> {
    const result: TranslationResult = {
      success: false,
      sourceFile,
      targetFile,
      translated: false,
      skipped: false,
    };

    try {
      // 读取源文件
      const sourceContent = await safeReadFile(sourceFile);
      if (!sourceContent) {
        result.error = 'Failed to read source file';
        return result;
      }

      // 检查缓存
      if (this.config.cache.enabled && !force) {
        const needsTranslation = this.cache.needsTranslation(
          sourceFile,
          sourceContent,
          sourceLang,
          targetLang
        );

        if (!needsTranslation) {
          result.skipped = true;
          result.reason = 'No changes detected (cached)';
          return result;
        }
      }

      // 解析文档
      const parsed = parseDocument(sourceFile, sourceContent);
      const documentType = detectDocumentType(sourceFile, parsed.frontmatter);

      // 获取术语表
      const glossaryTerms = this.glossary.getTermsForLanguagePair(sourceLang, targetLang);

      // 检查是否有需要翻译的 section
      if (this.config.cache.enabled && !force) {
        const sectionsToTranslate = parsed.sections.filter(s => s.translatable);
        const changedSectionIds = this.cache.getChangedSections(
          sourceFile,
          sectionsToTranslate.map(s => ({ id: s.id, content: s.content }))
        );

        // 如果没有变更，跳过
        if (changedSectionIds.length === 0) {
          result.skipped = true;
          result.reason = 'No section changes detected';
          return result;
        }

        // 从缓存恢复未变更的 sections
        for (const section of sectionsToTranslate) {
          if (!changedSectionIds.includes(section.id)) {
            const cached = this.cache.getCachedSection(sourceFile, section.id);
            if (cached) {
              section.content = cached;
              section.translatable = false; // 标记为不需要翻译
            }
          }
        }
      }

      // 创建翻译块
      const chunks = createTranslationChunks(parsed.sections, this.config.chunking.maxTokensPerChunk);

      // 构建上下文
      const baseContext = {
        documentTitle: parsed.frontmatter?.title || '',
        documentDescription: parsed.frontmatter?.description || '',
        documentType,
        outline: [],
        glossary: glossaryTerms,
      };

      // 翻译所有 chunks
      const translatedSections = await translateChunks(
        chunks,
        sourceLang,
        targetLang,
        baseContext,
        this.config
      );

      // 重新组装文档
      const translatedContent = reassembleDocument(parsed.sections, translatedSections);

      // 写入目标文件
      const writeSuccess = await safeWriteFile(targetFile, translatedContent);
      if (!writeSuccess) {
        result.error = 'Failed to write target file';
        return result;
      }

      // 更新缓存
      if (this.config.cache.enabled) {
        const sectionsWithTranslation = parsed.sections
          .filter(s => s.translatable)
          .map(s => ({
            id: s.id,
            content: s.content,
            translatedContent: translatedSections.get(s.id) || s.content,
          }));

        this.cache.updateFileEntry(
          sourceFile,
          sourceContent,
          translatedContent,
          sourceLang,
          targetLang,
          sectionsWithTranslation
        );
      }

      result.success = true;
      result.translated = true;
      result.chunks = {
        total: chunks.length,
        successful: chunks.length,
        failed: 0,
      };

      return result;
    } catch (error) {
      result.error = error instanceof Error ? error.message : String(error);
      return result;
    }
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * 获取缓存管理器
   */
  getCacheManager(): CacheManager {
    return this.cache;
  }

  /**
   * 获取术语表管理器
   */
  getGlossaryManager(): GlossaryManager {
    return this.glossary;
  }
}
