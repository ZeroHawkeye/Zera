/**
 * MDX 文档解析和分段模块
 * 
 * 智能分析 MDX 文档结构，按语义边界分段
 */

import { computeHash } from './cache.mts';
import type { ParsedDocument, DocumentSection, Frontmatter } from './types.mts';

/**
 * 解析 MDX 文档
 */
export function parseDocument(filePath: string, content: string): ParsedDocument {
  const sections: DocumentSection[] = [];
  const lines = content.split('\n');
  let currentLine = 0;
  let sectionId = 0;
  let loopCount = 0;
  const maxLoops = lines.length * 2; // 安全阀门

  const generateId = () => `section-${++sectionId}`;

  // 解析 frontmatter
  let frontmatter: Frontmatter | null = null;
  if (lines[0]?.trim() === '---') {
    const endIndex = lines.findIndex((line, i) => i > 0 && line.trim() === '---');
    if (endIndex > 0) {
      const frontmatterContent = lines.slice(0, endIndex + 1).join('\n');
      frontmatter = parseFrontmatter(frontmatterContent);
      
      sections.push({
        id: generateId(),
        type: 'frontmatter',
        content: frontmatterContent,
        startLine: 0,
        endLine: endIndex,
        translatable: true, // frontmatter 中的 title/description 需要翻译
      });
      
      currentLine = endIndex + 1;
    }
  }

  // 解析剩余内容
  while (currentLine < lines.length) {
    loopCount++;
    if (loopCount > maxLoops) {
      console.error(`[PARSER ERROR] Infinite loop detected at line ${currentLine}. Breaking.`);
      break;
    }

    const line = lines[currentLine];
    
    // 跳过空行
    if (line.trim() === '') {
      currentLine++;
      continue;
    }

    // 检测 import 语句
    if (line.trim().startsWith('import ')) {
      const importSection = parseImportBlock(lines, currentLine, generateId);
      sections.push(importSection);
      currentLine = importSection.endLine + 1;
      continue;
    }

    // 检测代码块
    if (line.trim().startsWith('```')) {
      const codeSection = parseCodeBlock(lines, currentLine, generateId);
      sections.push(codeSection);
      currentLine = codeSection.endLine + 1;
      continue;
    }

    // 检测 MDX 组件块 (如 <Tabs>, <Callout> 等)
    const componentMatch = line.trim().match(/^<([A-Z][a-zA-Z]*)/);
    if (componentMatch) {
      const componentSection = parseComponentBlock(lines, currentLine, componentMatch[1], generateId);
      sections.push(componentSection);
      currentLine = componentSection.endLine + 1;
      continue;
    }

    // 检测标题
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length as 1 | 2 | 3 | 4 | 5 | 6;
      const title = headingMatch[2];
      
      // 收集标题下的内容直到下一个同级或更高级别标题
      const contentSection = parseHeadingSection(lines, currentLine, level, generateId);
      contentSection.title = title;
      sections.push(contentSection);
      currentLine = contentSection.endLine + 1;
      continue;
    }

    // 普通内容段落
    const contentSection = parseContentParagraph(lines, currentLine, generateId);
    sections.push(contentSection);
    // 确保至少前进一行
    const nextLine = contentSection.endLine + 1;
    if (nextLine <= currentLine) {
      currentLine++;
    } else {
      currentLine = nextLine;
    }
  }

  return {
    filePath,
    frontmatter,
    sections,
    rawContent: content,
    hash: computeHash(content),
  };
}

/**
 * 解析 frontmatter
 */
function parseFrontmatter(content: string): Frontmatter {
  const result: Frontmatter = {};
  const lines = content.split('\n').slice(1, -1); // 去掉 --- 行
  
  for (const line of lines) {
    const match = line.match(/^(\w+):\s*(.+)$/);
    if (match) {
      const [, key, value] = match;
      // 去掉引号
      result[key] = value.replace(/^["']|["']$/g, '');
    }
  }
  
  return result;
}

/**
 * 解析 import 块（可能是多行）
 */
function parseImportBlock(
  lines: string[], 
  startLine: number, 
  generateId: () => string
): DocumentSection {
  let endLine = startLine;
  
  // 收集连续的 import 语句
  while (endLine < lines.length) {
    const line = lines[endLine].trim();
    if (line.startsWith('import ') || line === '' || line.startsWith('//')) {
      endLine++;
    } else {
      break;
    }
  }
  
  // 回退到最后一个非空行
  while (endLine > startLine && lines[endLine - 1].trim() === '') {
    endLine--;
  }

  return {
    id: generateId(),
    type: 'import',
    content: lines.slice(startLine, endLine).join('\n'),
    startLine,
    endLine: endLine - 1,
    translatable: false, // import 语句不需要翻译
  };
}

/**
 * 解析代码块
 */
function parseCodeBlock(
  lines: string[], 
  startLine: number, 
  generateId: () => string
): DocumentSection {
  let endLine = startLine + 1;
  
  // 找到代码块结束
  while (endLine < lines.length) {
    if (lines[endLine].trim().startsWith('```')) {
      break;
    }
    endLine++;
  }

  return {
    id: generateId(),
    type: 'codeblock',
    content: lines.slice(startLine, endLine + 1).join('\n'),
    startLine,
    endLine,
    translatable: false, // 代码块不需要翻译
  };
}

/**
 * 解析 MDX 组件块
 */
function parseComponentBlock(
  lines: string[], 
  startLine: number, 
  componentName: string,
  generateId: () => string
): DocumentSection {
  let endLine = startLine;
  let depth = 0;
  
  // 查找组件结束标签
  while (endLine < lines.length) {
    const line = lines[endLine];
    
    // 计算开始标签
    const openMatches = line.match(new RegExp(`<${componentName}(\\s|>|/)`, 'g'));
    if (openMatches) {
      depth += openMatches.length;
      // 检查是否是自闭合标签
      if (line.includes('/>')) {
        depth--;
      }
    }
    
    // 计算结束标签
    const closeMatches = line.match(new RegExp(`</${componentName}>`, 'g'));
    if (closeMatches) {
      depth -= closeMatches.length;
    }
    
    if (depth <= 0 && endLine > startLine) {
      break;
    }
    
    endLine++;
  }

  return {
    id: generateId(),
    type: 'component',
    content: lines.slice(startLine, endLine + 1).join('\n'),
    startLine,
    endLine,
    translatable: true, // 组件内容可能需要翻译
  };
}

/**
 * 解析标题及其内容
 */
function parseHeadingSection(
  lines: string[], 
  startLine: number, 
  level: number,
  generateId: () => string
): DocumentSection {
  let endLine = startLine + 1;
  
  // 收集内容直到遇到同级或更高级别的标题
  while (endLine < lines.length) {
    const line = lines[endLine];
    const headingMatch = line.match(/^(#{1,6})\s/);
    
    if (headingMatch && headingMatch[1].length <= level) {
      // 遇到同级或更高级别标题，停止
      break;
    }
    
    endLine++;
  }
  
  // 回退跳过尾部空行
  while (endLine > startLine + 1 && lines[endLine - 1].trim() === '') {
    endLine--;
  }

  return {
    id: generateId(),
    type: 'heading',
    level: level as 1 | 2 | 3 | 4 | 5 | 6,
    content: lines.slice(startLine, endLine).join('\n'),
    startLine,
    endLine: endLine - 1,
    translatable: true,
  };
}

/**
 * 解析普通内容段落
 */
function parseContentParagraph(
  lines: string[], 
  startLine: number, 
  generateId: () => string
): DocumentSection {
  let endLine = startLine;
  
  // 收集内容直到遇到特殊元素
  while (endLine < lines.length) {
    const line = lines[endLine];
    const trimmed = line.trim();
    
    // 遇到标题、代码块、import、组件时停止
    if (
      trimmed.match(/^#{1,6}\s/) ||
      trimmed.startsWith('```') ||
      trimmed.startsWith('import ') ||
      trimmed.match(/^<[A-Z]/)
    ) {
      break;
    }
    
    endLine++;
  }
  
  // 回退跳过尾部空行
  while (endLine > startLine && lines[endLine - 1].trim() === '') {
    endLine--;
  }

  return {
    id: generateId(),
    type: 'content',
    content: lines.slice(startLine, endLine).join('\n'),
    startLine,
    endLine: endLine - 1,
    translatable: true,
  };
}

/**
 * 估算 token 数量
 * 使用简单的字符估算：中文约 1.5 字符/token，英文约 4 字符/token
 */
export function estimateTokens(content: string): number {
  // 计算中文字符数
  const chineseChars = (content.match(/[\u4e00-\u9fff]/g) || []).length;
  // 计算其他字符数
  const otherChars = content.length - chineseChars;
  
  // 估算 token 数
  return Math.ceil(chineseChars / 1.5 + otherChars / 4);
}

/**
 * 将 sections 分组为翻译 chunks
 * 确保每个 chunk 不超过 token 限制，同时保持语义完整性
 */
export function createTranslationChunks(
  sections: DocumentSection[],
  maxTokens: number
): DocumentSection[][] {
  const chunks: DocumentSection[][] = [];
  let currentChunk: DocumentSection[] = [];
  let currentTokens = 0;

  for (const section of sections) {
    // 不可翻译的 section 单独成一个"chunk"（不会发送到 AI）
    if (!section.translatable) {
      if (currentChunk.length > 0) {
        chunks.push(currentChunk);
        currentChunk = [];
        currentTokens = 0;
      }
      chunks.push([section]);
      continue;
    }

    const sectionTokens = estimateTokens(section.content);

    // 如果单个 section 就超过限制，需要特殊处理
    if (sectionTokens > maxTokens) {
      // 先保存当前 chunk
      if (currentChunk.length > 0) {
        chunks.push(currentChunk);
        currentChunk = [];
        currentTokens = 0;
      }
      
      // 大 section 单独处理（后续可以进一步分割）
      chunks.push([section]);
      continue;
    }

    // 如果添加后会超过限制，先保存当前 chunk
    if (currentTokens + sectionTokens > maxTokens && currentChunk.length > 0) {
      chunks.push(currentChunk);
      currentChunk = [];
      currentTokens = 0;
    }

    currentChunk.push(section);
    currentTokens += sectionTokens;
  }

  // 保存最后一个 chunk
  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }

  return chunks;
}

/**
 * 从解析的文档中提取大纲（所有标题）
 */
export function extractOutline(sections: DocumentSection[]): string[] {
  const outline: string[] = [];
  
  for (const section of sections) {
    if (section.type === 'heading' && section.title) {
      const prefix = '#'.repeat(section.level || 1);
      outline.push(`${prefix} ${section.title}`);
    }
  }
  
  return outline;
}

/**
 * 重新组装翻译后的文档
 */
export function reassembleDocument(
  sections: DocumentSection[],
  translatedSections: Map<string, string>
): string {
  const parts: string[] = [];
  
  for (const section of sections) {
    const content = translatedSections.has(section.id) 
      ? translatedSections.get(section.id)!
      : section.content;
    
    // 跳过被合并到其他 section 的空内容
    if (content === '') continue;
    
    parts.push(content);
  }
  
  // 使用单个空行连接各部分
  let result = parts.join('\n\n');
  
  // 清理多余的连续空行（保留最多2个换行）
  result = result.replace(/\n{3,}/g, '\n\n');
  
  // 清理代码块前后的多余空行
  result = result.replace(/\n{2,}(```)/g, '\n\n$1');
  result = result.replace(/(```)\n{2,}/g, '$1\n\n');
  
  // 清理标题前后的空行（标题前保留一个空行）
  result = result.replace(/\n{3,}(#{1,6}\s)/g, '\n\n$1');
  
  // 确保文件末尾只有一个换行
  result = result.replace(/\n+$/, '\n');
  
  return result;
}

/**
 * 检测文档类型
 */
export function detectDocumentType(
  filePath: string, 
  frontmatter: Frontmatter | null
): 'api' | 'guide' | 'tutorial' | 'reference' | 'other' {
  const path = filePath.toLowerCase();
  
  if (path.includes('/api/') || path.includes('api.')) {
    return 'api';
  }
  if (path.includes('/guide/') || path.includes('guide.')) {
    return 'guide';
  }
  if (path.includes('/tutorial/')) {
    return 'tutorial';
  }
  if (path.includes('/reference/')) {
    return 'reference';
  }
  
  return 'other';
}
