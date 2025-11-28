/**
 * 跨平台脚本：从后端 gen 目录拷贝所有 OpenAPI yaml 文件到 docs/openapi 目录
 * 保持原有的目录结构
 */
import { copyFile, mkdir } from 'fs/promises';
import { dirname, join, relative } from 'path';
import { glob } from 'glob';

const BACKEND_GEN_DIR = '../backend/gen';
const OUTPUT_DIR = './openapi';

async function copyOpenAPIFiles() {
  // 查找所有 openapi.yaml 文件
  const files = await glob('**/*.openapi.yaml', {
    cwd: BACKEND_GEN_DIR,
    absolute: false,
  });

  if (files.length === 0) {
    console.log('⚠️  未找到 OpenAPI 文件');
    return;
  }

  console.log(`📦 找到 ${files.length} 个 OpenAPI 文件`);

  for (const file of files) {
    const srcPath = join(BACKEND_GEN_DIR, file);
    const destPath = join(OUTPUT_DIR, file);
    const destDir = dirname(destPath);

    // 创建目标目录
    await mkdir(destDir, { recursive: true });

    // 拷贝文件
    await copyFile(srcPath, destPath);
    console.log(`  ✅ ${file}`);
  }

  console.log('✨ OpenAPI 文件拷贝完成');
}

copyOpenAPIFiles().catch((err) => {
  console.error('❌ 拷贝失败:', err);
  process.exit(1);
});
