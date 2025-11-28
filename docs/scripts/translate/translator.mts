/**
 * AI 翻译模块
 * 
 * 实现上下文感知的翻译，支持多种 AI 提供商
 */

import type { TranslateConfig, ChunkContext, DocumentSection } from './types.mts';
import { languageNames } from './types.mts';
import { extractOutline } from './parser.mts';

/**
 * 构建翻译系统提示
 */
function buildSystemPrompt(
  sourceLang: string,
  targetLang: string,
  context: ChunkContext
): string {
  const sourceName = languageNames[sourceLang] || sourceLang;
  const targetName = languageNames[targetLang] || targetLang;

  let prompt = `You are a professional technical documentation translator specializing in software documentation.

## Task
Translate the following MDX documentation from ${sourceName} to ${targetName}.

## Document Context
- **Document Title**: ${context.documentTitle || 'Technical Documentation'}
- **Document Type**: ${context.documentType}
${context.documentDescription ? `- **Description**: ${context.documentDescription}` : ''}

## Document Structure
This content is part of a larger document with the following outline:
${context.outline.map((h, i) => `${i === context.currentPosition ? '→ ' : '  '}${h}`).join('\n')}

${context.previousSummary ? `## Previous Section Context\n${context.previousSummary}\n` : ''}
${context.nextSummary ? `## Next Section Context\n${context.nextSummary}\n` : ''}
`;

  // 添加术语表
  const glossaryEntries = Object.entries(context.glossary);
  if (glossaryEntries.length > 0) {
    prompt += `
## Terminology Glossary
Use these standardized translations for consistency:
${glossaryEntries.map(([source, target]) => `- "${source}" → "${target}"`).join('\n')}
`;
  }

  prompt += `
## Translation Example

### Source (Chinese):
\`\`\`mdx
---
title: 快速开始
description: 学习如何使用框架
---

## 安装

使用以下命令安装依赖：

\`\`\`bash
npm install example
\`\`\`

### 配置文件

在 \`config.ts\` 中添加配置：

\`\`\`typescript
export const config = {
  name: "example"
};
\`\`\`

<Callout type="info">
  这是一个提示信息。
</Callout>
\`\`\`

### Correct Output (${targetName}):
\`\`\`mdx
---
title: ${targetLang === 'ja' ? 'クイックスタート' : 'Quick Start'}
description: ${targetLang === 'ja' ? 'フレームワークの使い方を学ぶ' : 'Learn how to use the framework'}
---

## ${targetLang === 'ja' ? 'インストール' : 'Installation'}

${targetLang === 'ja' ? '以下のコマンドで依存関係をインストールします：' : 'Install dependencies using the following command:'}

\`\`\`bash
npm install example
\`\`\`

### ${targetLang === 'ja' ? '設定ファイル' : 'Configuration File'}

${targetLang === 'ja' ? '`config.ts` に設定を追加します：' : 'Add configuration in `config.ts`:'}

\`\`\`typescript
export const config = {
  name: "example"
};
\`\`\`

<Callout type="info">
  ${targetLang === 'ja' ? 'これはヒント情報です。' : 'This is a tip message.'}
</Callout>
\`\`\`

## Key Rules (from the example above)
1. Translate ONLY: title, description, headings (##, ###), paragraph text, Callout text
2. Keep UNCHANGED: code blocks, inline code (\`config.ts\`), imports, component tags (<Callout>)
3. Same structure: same number of headings, same blank lines, same code blocks
4. NO additions: do not add any content that doesn't exist in source

## Output Format
Return ONLY the translated MDX content. No explanations, no wrapper.`;

  return prompt;
}

/**
 * 使用 OpenAI 兼容 API 翻译
 */
async function translateWithOpenAI(
  content: string,
  sourceLang: string,
  targetLang: string,
  context: ChunkContext,
  config: TranslateConfig
): Promise<string> {
  const systemPrompt = buildSystemPrompt(sourceLang, targetLang, context);

  const response = await fetch(`${config.openai.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.openai.apiKey}`,
    },
    body: JSON.stringify({
      model: config.openai.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: content },
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

/**
 * 使用 Anthropic API 翻译
 */
async function translateWithAnthropic(
  content: string,
  sourceLang: string,
  targetLang: string,
  context: ChunkContext,
  config: TranslateConfig
): Promise<string> {
  const systemPrompt = buildSystemPrompt(sourceLang, targetLang, context);

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
      system: systemPrompt,
      messages: [
        { role: 'user', content: content },
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

/**
 * 翻译内容（自动选择 provider）
 */
export async function translateContent(
  content: string,
  sourceLang: string,
  targetLang: string,
  context: ChunkContext,
  config: TranslateConfig
): Promise<string> {
  if (config.provider === 'anthropic') {
    return translateWithAnthropic(content, sourceLang, targetLang, context, config);
  }
  return translateWithOpenAI(content, sourceLang, targetLang, context, config);
}

/**
 * 构建翻译上下文
 */
export function buildChunkContext(
  sections: DocumentSection[],
  chunkIndex: number,
  totalChunks: number,
  frontmatter: { title?: string; description?: string } | null,
  documentType: 'api' | 'guide' | 'tutorial' | 'reference' | 'other',
  glossary: Record<string, string>,
  previousSummary?: string,
  nextSummary?: string
): ChunkContext {
  const outline = extractOutline(sections);
  
  return {
    documentTitle: frontmatter?.title || '',
    documentDescription: frontmatter?.description || '',
    documentType,
    outline,
    currentPosition: chunkIndex,
    previousSummary,
    nextSummary,
    glossary,
  };
}

/**
 * 生成段落摘要（用于上下文传递）
 */
export function generateSummary(content: string, maxLength: number = 100): string {
  // 提取第一段非空内容
  const lines = content.split('\n').filter(l => l.trim());
  const firstParagraph = lines.find(l => !l.startsWith('#') && !l.startsWith('```') && !l.startsWith('import'));
  
  if (!firstParagraph) return '';
  
  // 截断到最大长度
  if (firstParagraph.length <= maxLength) {
    return firstParagraph;
  }
  
  return firstParagraph.slice(0, maxLength) + '...';
}

/**
 * 并行翻译控制器
 * 使用简单的并发限制器，避免复杂的队列管理
 */
export class ParallelTranslator {
  private config: TranslateConfig;
  private activeRequests: number = 0;

  constructor(config: TranslateConfig) {
    this.config = config;
  }

  /**
   * 获取当前活动请求数
   */
  get active(): number {
    return this.activeRequests;
  }

  /**
   * 执行带并发限制的任务
   */
  async run<T>(task: () => Promise<T>): Promise<T> {
    // 等待直到有可用槽位
    while (this.activeRequests >= this.config.parallel.maxConcurrency) {
      await new Promise(r => setTimeout(r, 50));
    }

    this.activeRequests++;
    try {
      // 添加请求间延迟
      if (this.config.parallel.delayBetweenRequests > 0) {
        await new Promise(r => setTimeout(r, this.config.parallel.delayBetweenRequests));
      }
      return await task();
    } finally {
      this.activeRequests--;
    }
  }
}

/**
 * 批量翻译 chunks
 */
export async function translateChunks(
  chunks: DocumentSection[][],
  sourceLang: string,
  targetLang: string,
  context: Omit<ChunkContext, 'currentPosition' | 'previousSummary' | 'nextSummary'>,
  config: TranslateConfig
): Promise<Map<string, string>> {
  const translator = new ParallelTranslator(config);
  const results = new Map<string, string>();
  const summaries: string[] = [];

  // 先生成所有摘要用于上下文
  for (const chunk of chunks) {
    const content = chunk.map(s => s.content).join('\n\n');
    summaries.push(generateSummary(content));
  }

  // 并行翻译，使用 Promise.all 配合并发控制
  const promises = chunks.map((chunk, index) => {
    // 不可翻译的 chunk 直接处理
    if (chunk.every(s => !s.translatable)) {
      for (const section of chunk) {
        results.set(section.id, section.content);
      }
      return Promise.resolve();
    }

    return translator.run(async () => {
      // 使用单个换行连接，保持原始格式
      const content = chunk.map(s => s.content).join('\n\n');
      
      const chunkContext: ChunkContext = {
        ...context,
        currentPosition: index,
        previousSummary: index > 0 ? summaries[index - 1] : undefined,
        nextSummary: index < chunks.length - 1 ? summaries[index + 1] : undefined,
      };

      try {
        let translated = await translateContent(
          content,
          sourceLang,
          targetLang,
          chunkContext,
          config
        );
        
        // 清理翻译结果中的多余空行
        translated = translated.replace(/\n{3,}/g, '\n\n');
        // 移除可能被 AI 添加的 markdown 代码块包装
        translated = translated.replace(/^```[\w]*\n/, '').replace(/\n```$/, '');

        // 如果只有一个 section，直接存储
        if (chunk.length === 1) {
          results.set(chunk[0].id, translated);
        } else {
          // 多个 section 需要分割（简单实现：整体存储）
          for (let i = 0; i < chunk.length; i++) {
            if (i === 0) {
              results.set(chunk[i].id, translated);
            } else {
              results.set(chunk[i].id, ''); // 后续 section 标记为空，合并到第一个
            }
          }
        }
      } catch (error) {
        console.error(`❌ Failed to translate chunk ${index}:`, error);
        // 失败时保留原文
        for (const section of chunk) {
          results.set(section.id, section.content);
        }
      }
    });
  });

  await Promise.all(promises);

  return results;
}
