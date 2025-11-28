/**
 * 根据 openapi 目录下的所有 yaml 文件生成 MDX 文档
 */
import { generateFiles } from 'fumadocs-openapi';
import { createOpenAPI } from 'fumadocs-openapi/server';
import { glob } from 'glob';

async function generate() {
  // 自动扫描所有 openapi.yaml 文件
  const files = await glob('./openapi/**/*.openapi.yaml');

  if (files.length === 0) {
    console.log('⚠️  未找到 OpenAPI 文件，请先运行 bun run openapi:copy');
    return;
  }

  console.log(`📄 找到 ${files.length} 个 OpenAPI 文件:`);
  files.forEach((f) => console.log(`  - ${f}`));

  const openapi = createOpenAPI({
    input: files,
  });

  await generateFiles({
    input: openapi,
    output: './content/docs/api',
    per: 'tag',
    includeDescription: true,
    addGeneratedComment: true,
  });

  console.log('✨ API 文档生成完成');
}

generate().catch((err) => {
  console.error('❌ 生成失败:', err);
  process.exit(1);
});
