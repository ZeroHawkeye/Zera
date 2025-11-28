/**
 * 文件操作工具模块
 */

import { readdir, readFile, writeFile, mkdir, stat } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname, relative, basename } from 'path';

/**
 * 不需要翻译的文件名列表
 * - meta.json: 导航配置文件，只包含路径引用
 * - glossary.json: 术语表，用于翻译一致性，不需要翻译
 */
const EXCLUDED_FILES = ['meta.json', 'glossary.json'];

/**
 * 递归获取所有需要翻译的 MDX 文件
 * 排除配置类 JSON 文件（meta.json, glossary.json）
 */
export async function getAllMdxFiles(dir: string): Promise<string[]> {
  const files: string[] = [];
  
  async function walk(currentDir: string) {
    try {
      const entries = await readdir(currentDir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = join(currentDir, entry.name);
        
        if (entry.isDirectory()) {
          await walk(fullPath);
        } else if (entry.name.endsWith('.mdx')) {
          // 只翻译 MDX 文件
          files.push(fullPath);
        }
        // 不再翻译 JSON 文件（meta.json, glossary.json 等配置文件）
      }
    } catch (error) {
      console.warn(`⚠️ Failed to read directory ${currentDir}:`, error);
    }
  }
  
  await walk(dir);
  return files;
}

/**
 * 确保目录存在
 */
export async function ensureDir(filePath: string): Promise<void> {
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
}

/**
 * 安全读取文件
 */
export async function safeReadFile(filePath: string): Promise<string | null> {
  try {
    return await readFile(filePath, 'utf-8');
  } catch (error) {
    console.warn(`⚠️ Failed to read file ${filePath}:`, error);
    return null;
  }
}

/**
 * 安全写入文件
 */
export async function safeWriteFile(filePath: string, content: string): Promise<boolean> {
  try {
    await ensureDir(filePath);
    await writeFile(filePath, content, 'utf-8');
    return true;
  } catch (error) {
    console.error(`❌ Failed to write file ${filePath}:`, error);
    return false;
  }
}

/**
 * 获取文件修改时间
 */
export async function getFileModifiedTime(filePath: string): Promise<Date | null> {
  try {
    const stats = await stat(filePath);
    return stats.mtime;
  } catch {
    return null;
  }
}

/**
 * 过滤源文件
 * 返回需要翻译的源文件列表
 * 目录模式：源文件在 content/docs/zh/ 目录下
 */
export function filterSourceFiles(
  allFiles: string[], 
  sourceLang: string, 
  _targetLang: string,
  docsDir: string
): string[] {
  // 目录模式下，源文件应该在 sourceLang 目录下
  const sourceDir = join(docsDir, sourceLang).replace(/\\/g, '/');
  
  return allFiles.filter(f => {
    const normalizedPath = f.replace(/\\/g, '/');
    return normalizedPath.startsWith(sourceDir + '/');
  });
}

/**
 * 生成目标文件路径
 * 目录模式：将 content/docs/zh/guide/index.mdx 转换为 content/docs/en/guide/index.mdx
 */
export function getTargetFilePath(sourceFile: string, targetLang: string, sourceLang: string, docsDir: string): string {
  const normalizedSource = sourceFile.replace(/\\/g, '/');
  const normalizedDocsDir = docsDir.replace(/\\/g, '/');
  
  // 获取相对于 docsDir 的路径
  const relativePath = normalizedSource.replace(normalizedDocsDir + '/', '');
  
  // 将源语言目录替换为目标语言目录
  // 例如: zh/guide/index.mdx -> en/guide/index.mdx
  const parts = relativePath.split('/');
  if (parts[0] === sourceLang) {
    parts[0] = targetLang;
  }
  
  return join(docsDir, ...parts);
}

/**
 * 获取相对路径用于显示
 */
export function getDisplayPath(filePath: string, baseDir: string): string {
  return relative(baseDir, filePath).replace(/\\/g, '/');
}
