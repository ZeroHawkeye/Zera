/**
 * AI 自动翻译脚本
 * 
 * 该脚本用于自动翻译文档内容，支持多种 AI 提供商。
 * 
 * 使用方法:
 * 1. 设置环境变量 (可选):
 *    - OPENAI_API_KEY: OpenAI API 密钥
 *    - OPENAI_BASE_URL: OpenAI API 基础 URL (可选，用于自定义端点)
 *    - ANTHROPIC_API_KEY: Anthropic API 密钥
 *    - AI_PROVIDER: 选择 AI 提供商 (openai 或 anthropic，默认 openai)
 * 
 * 2. 运行脚本:
 *    bun run scripts/translate.mts --source zh --target en
 *    bun run scripts/translate.mts --source zh --target en --file guide/index.mdx
 *    bun run scripts/translate.mts --source zh --target en --dry-run
 * 
 * 参数说明:
 *   --source, -s: 源语言代码 (默认: zh)
 *   --target, -t: 目标语言代码 (默认: en)
 *   --file, -f: 指定要翻译的文件路径 (可选，不指定则翻译所有文件)
 *   --dry-run: 仅显示将要翻译的文件，不实际执行
 *   --force: 强制重新翻译已存在的文件
 */

import { readdir, readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname, relative } from 'path';
import { parseArgs } from 'util';

// ============= 配置 =============

interface TranslateConfig {
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
}

const config: TranslateConfig = {
  provider: (process.env.AI_PROVIDER as 'openai' | 'anthropic') || 'openai',
  openai: {
    apiKey: process.env.OPENAI_API_KEY || 'sk-5a7bd2e52ab541fbafbb7b39780e88fb',
    baseUrl: process.env.OPENAI_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    model: process.env.OPENAI_MODEL || 'qwen3-max-preview',
  },
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY || '',
    model: process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022',
  },
};

// 语言名称映射
const languageNames: Record<string, string> = {
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

// ============= AI 翻译函数 =============

async function translateWithOpenAI(content: string, sourceLang: string, targetLang: string): Promise<string> {
  const sourceName = languageNames[sourceLang] || sourceLang;
  const targetName = languageNames[targetLang] || targetLang;

  const response = await fetch(`${config.openai.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.openai.apiKey}`,
    },
    body: JSON.stringify({
      model: config.openai.model,
      messages: [
        {
          role: 'system',
          content: `You are a professional technical documentation translator. 
Translate the following MDX documentation from ${sourceName} to ${targetName}.

IMPORTANT RULES:
1. Preserve ALL MDX syntax, frontmatter, imports, and component tags exactly as they are
2. Only translate the human-readable text content
3. Keep code blocks, code snippets, and technical terms in their original form
4. Maintain the exact formatting, indentation, and structure
5. Do not add or remove any content
6. Preserve all links, but translate link text if it's in the source language
7. Keep frontmatter keys (like title, description) but translate their values
8. Return ONLY the translated content, no explanations

Output the translated MDX content directly.`,
        },
        {
          role: 'user',
          content: content,
        },
      ],
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

async function translateWithAnthropic(content: string, sourceLang: string, targetLang: string): Promise<string> {
  const sourceName = languageNames[sourceLang] || sourceLang;
  const targetName = languageNames[targetLang] || targetLang;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.anthropic.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: config.anthropic.model,
      max_tokens: 8192,
      system: `You are a professional technical documentation translator. 
Translate the following MDX documentation from ${sourceName} to ${targetName}.

IMPORTANT RULES:
1. Preserve ALL MDX syntax, frontmatter, imports, and component tags exactly as they are
2. Only translate the human-readable text content
3. Keep code blocks, code snippets, and technical terms in their original form
4. Maintain the exact formatting, indentation, and structure
5. Do not add or remove any content
6. Preserve all links, but translate link text if it's in the source language
7. Keep frontmatter keys (like title, description) but translate their values
8. Return ONLY the translated content, no explanations

Output the translated MDX content directly.`,
      messages: [
        {
          role: 'user',
          content: content,
        },
      ],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Anthropic API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.content[0].text;
}

async function translate(content: string, sourceLang: string, targetLang: string): Promise<string> {
  if (config.provider === 'anthropic') {
    return translateWithAnthropic(content, sourceLang, targetLang);
  }
  return translateWithOpenAI(content, sourceLang, targetLang);
}

// ============= 文件操作函数 =============

async function getAllMdxFiles(dir: string): Promise<string[]> {
  const files: string[] = [];
  
  async function walk(currentDir: string) {
    const entries = await readdir(currentDir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = join(currentDir, entry.name);
      
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.name.endsWith('.mdx') || entry.name.endsWith('.json')) {
        files.push(fullPath);
      }
    }
  }
  
  await walk(dir);
  return files;
}

async function ensureDir(filePath: string) {
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
}

// ============= 主函数 =============

async function main() {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      source: { type: 'string', short: 's', default: 'zh' },
      target: { type: 'string', short: 't', default: 'en' },
      file: { type: 'string', short: 'f' },
      'dry-run': { type: 'boolean', default: false },
      force: { type: 'boolean', default: false },
    },
  });

  const sourceLang = values.source!;
  const targetLang = values.target!;
  const specificFile = values.file;
  const dryRun = values['dry-run'];
  const force = values.force;

  // 验证配置
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

  console.log('🌐 AI Document Translation Tool');
  console.log('================================');
  console.log(`Provider: ${config.provider}`);
  console.log(`Source: ${sourceLang} (${languageNames[sourceLang] || sourceLang})`);
  console.log(`Target: ${targetLang} (${languageNames[targetLang] || targetLang})`);
  console.log(`Dry run: ${dryRun}`);
  console.log(`Force: ${force}`);
  console.log('');

  // 获取所有源文件（不带语言后缀的文件，或带源语言后缀的文件）
  const allFiles = await getAllMdxFiles(docsDir);
  
  // 过滤出需要翻译的源文件
  const sourceFiles = allFiles.filter(f => {
    const fileName = f.replace(/\\/g, '/').split('/').pop() || '';
    // 排除已经是目标语言的文件
    if (fileName.includes(`.${targetLang}.`)) return false;
    // 如果源语言是默认语言，选择不带语言后缀的文件
    if (sourceLang === 'zh') {
      // 不带语言后缀，或者明确是 zh 后缀
      return !fileName.match(/\.[a-z]{2}\.(mdx|json)$/);
    }
    // 否则选择带源语言后缀的文件
    return fileName.includes(`.${sourceLang}.`);
  });

  let filesToTranslate = sourceFiles;
  
  if (specificFile) {
    const fullPath = join(docsDir, specificFile);
    filesToTranslate = sourceFiles.filter(f => f === fullPath);
  }

  if (filesToTranslate.length === 0) {
    console.log('No files to translate.');
    return;
  }

  console.log(`Found ${filesToTranslate.length} file(s) to process:\n`);

  // 翻译文件
  let translated = 0;
  let skipped = 0;
  let errors = 0;

  for (const sourceFile of filesToTranslate) {
    // 生成目标文件路径
    const fileName = sourceFile.replace(/\\/g, '/').split('/').pop() || '';
    const dir = dirname(sourceFile);
    
    let targetFileName: string;
    if (fileName.endsWith('.mdx')) {
      targetFileName = fileName.replace('.mdx', `.${targetLang}.mdx`);
    } else if (fileName.endsWith('.json')) {
      targetFileName = fileName.replace('.json', `.${targetLang}.json`);
    } else {
      continue;
    }
    
    const targetPath = join(dir, targetFileName);
    const displaySource = relative(docsDir, sourceFile);
    const displayTarget = relative(docsDir, targetPath);

    // 检查目标文件是否已存在
    if (existsSync(targetPath) && !force) {
      console.log(`⏭️  Skip (exists): ${displaySource}`);
      skipped++;
      continue;
    }

    if (dryRun) {
      console.log(`📝 Would translate: ${displaySource} → ${displayTarget}`);
      continue;
    }

    try {
      console.log(`🔄 Translating: ${displaySource}`);
      
      const content = await readFile(sourceFile, 'utf-8');
      
      // 对于 meta.json，需要特殊处理
      let translatedContent: string;
      if (sourceFile.endsWith('.json')) {
        // meta.json 可能有需要翻译的 title 等字段
        const meta = JSON.parse(content);
        if (meta.title || meta.description) {
          translatedContent = await translate(content, sourceLang, targetLang);
        } else {
          translatedContent = content;
        }
      } else {
        translatedContent = await translate(content, sourceLang, targetLang);
      }

      await ensureDir(targetPath);
      await writeFile(targetPath, translatedContent, 'utf-8');
      
      console.log(`✅ Saved: ${displayTarget}`);
      translated++;

      // 添加延迟以避免 API 限制
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.error(`❌ Error translating ${displaySource}:`, error);
      errors++;
    }
  }

  console.log('\n================================');
  console.log('📊 Summary:');
  console.log(`   Translated: ${translated}`);
  console.log(`   Skipped: ${skipped}`);
  console.log(`   Errors: ${errors}`);
}

main().catch(console.error);
