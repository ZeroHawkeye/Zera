#!/usr/bin/env node
/**
 * AI 自动翻译脚本 v2.0
 * 
 * 功能特性:
 * - ✅ 智能分段翻译（按语义边界分割，避免超出 token 限制）
 * - ✅ 上下文感知（理解文档结构和前后关系）
 * - ✅ 增量翻译（只翻译变更的内容，使用缓存）
 * - ✅ 并行处理（多文件和多段落并发翻译）
 * - ✅ 术语一致性（维护术语表，确保翻译统一）
 * - ✅ 多语言支持（一次翻译到多个目标语言）
 * 
 * 使用方法:
 * 1. 在 config.mts 中配置语言:
 *    - defaultLocale: 源语言（默认 zh）
 *    - targetLocales: 目标语言列表（如 ['en', 'ja']）
 * 
 * 2. 运行脚本:
 *    bun run translate                                    # 翻译到所有配置的目标语言
 *    bun run translate --target en                        # 只翻译到英语
 *    bun run translate --target en,ja                     # 翻译到英语和日语
 *    bun run translate --file guide/index.mdx            # 翻译单个文件
 *    bun run translate --dry-run                         # 预览将要翻译的文件
 *    bun run translate --force                           # 强制重新翻译
 *    bun run translate --clear-cache                     # 清除缓存
 * 
 * 参数说明:
 *   --source, -s:     源语言代码 (默认: 配置文件中的 defaultLocale)
 *   --target, -t:     目标语言代码，多个用逗号分隔 (默认: 配置文件中的 targetLocales)
 *   --all:            翻译到所有配置的目标语言
 *   --file, -f:       指定要翻译的文件路径 (可选)
 *   --dry-run:        仅显示将要翻译的文件，不实际执行
 *   --force:          强制重新翻译已存在的文件
 *   --clear-cache:    清除翻译缓存
 *   --concurrency, -c: 并发数 (默认: 3)
 */

import { parseArgs } from 'util';
import { join } from 'path';
import { existsSync } from 'fs';
import { getConfig, languageConfig } from './translate/config.mts';
import { TranslationEngine } from './translate/engine.mts';
import { getAllMdxFiles, filterSourceFiles, getTargetFilePath, getDisplayPath } from './translate/utils.mts';
import { languageNames } from './translate/types.mts';
import type { TranslationStats } from './translate/types.mts';

/**
 * 翻译到单个目标语言
 */
async function translateToLanguage(
  engine: TranslationEngine,
  filesToTranslate: string[],
  sourceLang: string,
  targetLang: string,
  docsDir: string,
  options: { dryRun: boolean; force: boolean }
): Promise<TranslationStats> {
  const stats: TranslationStats = {
    totalFiles: filesToTranslate.length,
    translated: 0,
    skipped: 0,
    failed: 0,
    cached: 0,
    totalChunks: 0,
    successfulChunks: 0,
    failedChunks: 0,
    startTime: Date.now(),
  };

  const targetName = languageNames[targetLang] || targetLang;
  console.log(`\n📝 Translating to ${targetName} (${targetLang})...`);
  console.log('─'.repeat(50));

  // Dry run 模式
  if (options.dryRun) {
    for (const sourceFile of filesToTranslate) {
      const targetFile = getTargetFilePath(sourceFile, targetLang, sourceLang, docsDir);
      const displaySource = getDisplayPath(sourceFile, docsDir);
      const displayTarget = getDisplayPath(targetFile, docsDir);
      
      const exists = existsSync(targetFile);
      const status = exists ? (options.force ? '🔄 Update' : '⏭️  Skip') : '✨ New';
      
      console.log(`${status}: ${displaySource} → ${displayTarget}`);
    }
    return stats;
  }

  // 实际翻译
  for (let i = 0; i < filesToTranslate.length; i++) {
    const sourceFile = filesToTranslate[i];
    const targetFile = getTargetFilePath(sourceFile, targetLang, sourceLang, docsDir);
    const displaySource = getDisplayPath(sourceFile, docsDir);
    const displayTarget = getDisplayPath(targetFile, docsDir);

    console.log(`[${i + 1}/${filesToTranslate.length}] ${displaySource}`);

    // 检查目标文件是否存在
    if (existsSync(targetFile) && !options.force) {
      console.log(`  ⏭️  Skipped (file exists)`);
      stats.skipped++;
      continue;
    }

    try {
      const result = await engine.translateFile(
        sourceFile,
        targetFile,
        sourceLang,
        targetLang,
        options.force
      );

      if (result.skipped) {
        console.log(`  ⏭️  Skipped: ${result.reason}`);
        stats.skipped++;
        if (result.reason?.includes('cached')) {
          stats.cached++;
        }
      } else if (result.success && result.translated) {
        console.log(`  ✅ → ${displayTarget}`);
        if (result.chunks) {
          stats.totalChunks += result.chunks.total;
          stats.successfulChunks += result.chunks.successful;
          stats.failedChunks += result.chunks.failed;
        }
        stats.translated++;
      } else {
        console.error(`  ❌ Failed: ${result.error || 'Unknown error'}`);
        stats.failed++;
      }
    } catch (error) {
      console.error(`  ❌ Error: ${error}`);
      stats.failed++;
    }
  }

  stats.endTime = Date.now();
  return stats;
}

async function main() {
  const startTime = Date.now();

  // 解析命令行参数
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      source: { type: 'string', short: 's' },
      target: { type: 'string', short: 't' },
      all: { type: 'boolean', default: false },
      file: { type: 'string', short: 'f' },
      'dry-run': { type: 'boolean', default: false },
      force: { type: 'boolean', default: false },
      'clear-cache': { type: 'boolean', default: false },
      concurrency: { type: 'string', short: 'c', default: '3' },
    },
  });

  // 配置
  const config = getConfig({
    parallel: {
      maxConcurrency: parseInt(values.concurrency!, 10),
      delayBetweenRequests: 300,
    },
  });

  // 确定源语言和目标语言
  const sourceLang = values.source || config.languages.defaultLocale;
  
  // 确定目标语言列表
  let targetLangs: string[];
  if (values.target) {
    // 命令行指定的目标语言（支持逗号分隔）
    targetLangs = values.target.split(',').map(l => l.trim()).filter(Boolean);
  } else if (values.all) {
    // --all 参数：使用配置中的所有目标语言
    targetLangs = config.languages.targetLocales;
  } else {
    // 默认：使用配置中的所有目标语言
    targetLangs = config.languages.targetLocales;
  }

  const specificFile = values.file;
  const dryRun = values['dry-run']!;
  const force = values.force!;
  const clearCache = values['clear-cache'];

  // 验证 API 密钥
  if (config.provider === 'openai' && !config.openai.apiKey) {
    console.error('❌ Error: OPENAI_API_KEY environment variable is not set');
    console.log('\nPlease set your API key:');
    console.log('  export OPENAI_API_KEY="your-api-key"');
    process.exit(1);
  }

  if (config.provider === 'anthropic' && !config.anthropic.apiKey) {
    console.error('❌ Error: ANTHROPIC_API_KEY environment variable is not set');
    console.log('\nPlease set your API key:');
    console.log('  export ANTHROPIC_API_KEY="your-api-key"');
    process.exit(1);
  }

  const docsDir = join(process.cwd(), 'content', 'docs');
  const cacheDir = join(process.cwd(), config.cache.dir);

  // 打印配置信息
  console.log('🌐 AI Document Translation Tool v2.0');
  console.log('=====================================');
  console.log(`Provider:    ${config.provider} (${config.provider === 'openai' ? config.openai.model : config.anthropic.model})`);
  console.log(`Source:      ${sourceLang} (${languageNames[sourceLang] || sourceLang})`);
  console.log(`Targets:     ${targetLangs.map(l => `${l} (${languageNames[l] || l})`).join(', ')}`);
  console.log(`Concurrency: ${config.parallel.maxConcurrency}`);
  console.log(`Cache:       ${config.cache.enabled ? 'enabled' : 'disabled'}`);
  console.log(`Dry run:     ${dryRun}`);
  console.log(`Force:       ${force}`);

  // 初始化翻译引擎
  const engine = new TranslationEngine(config, cacheDir, docsDir);
  await engine.initialize();

  // 处理清除缓存
  if (clearCache) {
    console.log('\n🗑️  Clearing translation cache...');
    engine.clearCache();
    await engine.shutdown();
    console.log('✅ Cache cleared');
    return;
  }

  // 验证目标语言
  if (targetLangs.length === 0) {
    console.error('\n❌ Error: No target languages specified');
    console.log('Configure targetLocales in config.mts or use --target <lang>');
    process.exit(1);
  }

  // 获取所有源文件
  const allFiles = await getAllMdxFiles(docsDir);
  
  // 对每个目标语言过滤源文件（目录模式下，源文件在 sourceLang 目录下）
  const sourceFiles = filterSourceFiles(allFiles, sourceLang, targetLangs[0], docsDir);

  // 过滤特定文件
  let filesToTranslate = sourceFiles;
  if (specificFile) {
    // 目录模式：文件路径相对于源语言目录，如 guide/index.mdx
    const fullPath = join(docsDir, sourceLang, specificFile);
    filesToTranslate = sourceFiles.filter(f => f === fullPath);
    
    if (filesToTranslate.length === 0) {
      console.error(`\n❌ File not found: ${sourceLang}/${specificFile}`);
      process.exit(1);
    }
  }

  if (filesToTranslate.length === 0) {
    console.log('\nNo files to translate.');
    await engine.shutdown();
    return;
  }

  console.log(`\n📁 Found ${filesToTranslate.length} source file(s)`);
  console.log(`📊 Will translate to ${targetLangs.length} language(s): ${targetLangs.join(', ')}`);

  // 汇总统计
  const allStats: Map<string, TranslationStats> = new Map();

  // 翻译到每个目标语言
  for (const targetLang of targetLangs) {
    const stats = await translateToLanguage(
      engine,
      filesToTranslate,
      sourceLang,
      targetLang,
      docsDir,
      { dryRun, force }
    );
    allStats.set(targetLang, stats);
  }

  // 保存状态
  await engine.shutdown();

  // 最终统计
  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(2);

  console.log('\n=====================================');
  console.log('📊 Translation Summary');
  console.log('=====================================');

  let totalTranslated = 0;
  let totalSkipped = 0;
  let totalFailed = 0;

  for (const [lang, stats] of allStats) {
    const langName = languageNames[lang] || lang;
    console.log(`\n${langName} (${lang}):`);
    console.log(`  ✅ Translated: ${stats.translated}`);
    console.log(`  ⏭️  Skipped:    ${stats.skipped}`);
    console.log(`  ❌ Failed:     ${stats.failed}`);
    
    totalTranslated += stats.translated;
    totalSkipped += stats.skipped;
    totalFailed += stats.failed;
  }

  if (targetLangs.length > 1) {
    console.log('\n' + '─'.repeat(30));
    console.log(`Total: ${totalTranslated} translated, ${totalSkipped} skipped, ${totalFailed} failed`);
  }

  console.log(`\n⏱️  Time: ${duration}s`);
  console.log('');

  // 退出码
  process.exit(totalFailed > 0 ? 1 : 0);
}

main().catch(error => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});
