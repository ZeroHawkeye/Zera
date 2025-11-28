/**
 * 根据 openapi 目录下的所有 yaml 文件生成 MDX 文档
 * 为每个语言目录都生成一份 API 文档
 */
import { generateFiles } from 'fumadocs-openapi';
import { createOpenAPI } from 'fumadocs-openapi/server';
import { glob } from 'glob';
import path from 'node:path';

// 支持的语言列表
const LOCALES = ['zh', 'en', 'ja'];

// 将 Windows 路径转换为 POSIX 路径
function toPosixPath(p: string): string {
  return p.split(path.sep).join(path.posix.sep);
}

async function generate() {
  // 自动扫描所有 openapi.yaml 文件
  const files = await glob('./openapi/**/*.openapi.yaml');

  if (files.length === 0) {
    console.log('⚠️  未找到 OpenAPI 文件，请先运行 bun run openapi:copy');
    return;
  }

  console.log(`📄 找到 ${files.length} 个 OpenAPI 文件:`);
  files.forEach((f) => console.log(`  - ${toPosixPath(f)}`));

  // 使用函数形式的 input，返回 { [posixPath]: absolutePath } 对象
  const openapi = createOpenAPI({
    input: () => {
      const result: Record<string, string> = {};
      for (const file of files) {
        const posixPath = toPosixPath(file);
        result[posixPath] = path.resolve(file);
      }
      return result;
    },
  });

  // 为每个语言目录生成 API 文档
  console.log(`\n🌐 为 ${LOCALES.length} 个语言目录生成 API 文档...`);
  
  for (const locale of LOCALES) {
    const outputDir = `./content/docs/${locale}/api`;
    console.log(`  📝 生成 ${locale} 版本 → ${outputDir}`);
    
    await generateFiles({
      input: openapi,
      output: outputDir,
      per: 'tag',
      includeDescription: true,
      addGeneratedComment: true,
    });
  }

  console.log('\n✨ API 文档生成完成');
}

generate().catch((err) => {
  console.error('❌ 生成失败:', err);
  process.exit(1);
});
