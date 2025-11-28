/**
 * 根据 openapi 目录下的所有 yaml 文件生成 MDX 文档
 * 为每个语言目录都生成一份 API 文档
 * 并动态更新 meta.json 索引文件
 */
import { generateFiles } from 'fumadocs-openapi';
import { createOpenAPI } from 'fumadocs-openapi/server';
import { glob } from 'glob';
import path from 'node:path';
import { readFile, writeFile } from 'node:fs/promises';
import yaml from 'yaml';

// 支持的语言列表及对应的标题翻译
const LOCALES_CONFIG: Record<string, { title: string; description: string }> = {
  'zh': {
    title: 'API 文档',
    description: 'API 接口参考文档',
  },
  'en': {
    title: 'API Documentation',
    description: 'API interface reference documentation',
  },
  'ja': {
    title: 'API ドキュメント',
    description: 'APIインターフェースリファレンスドキュメント',
  },
};

// 服务名称翻译
const SERVICE_NAMES: Record<string, Record<string, string>> = {
  'zh': {
    'base.AuthService': '认证服务',
    'base.UserService': '用户服务',
    'base.RoleService': '角色服务',
  },
  'en': {
    'base.AuthService': 'Authentication Service',
    'base.UserService': 'User Service',
    'base.RoleService': 'Role Service',
  },
  'ja': {
    'base.AuthService': '認証サービス',
    'base.UserService': 'ユーザーサービス',
    'base.RoleService': 'ロールサービス',
  },
};

const LOCALES = Object.keys(LOCALES_CONFIG);

// 将 Windows 路径转换为 POSIX 路径
function toPosixPath(p: string): string {
  return p.split(path.sep).join(path.posix.sep);
}

// 从 OpenAPI YAML 文件中提取所有 tags
async function extractTagsFromYamlFiles(files: string[]): Promise<string[]> {
  const allTags = new Set<string>();
  
  for (const file of files) {
    try {
      const content = await readFile(file, 'utf-8');
      const doc = yaml.parse(content);
      
      if (doc.tags && Array.isArray(doc.tags)) {
        for (const tag of doc.tags) {
          if (tag.name) {
            allTags.add(tag.name);
          }
        }
      }
    } catch (error) {
      console.warn(`  ⚠️  无法解析 ${file}:`, error);
    }
  }
  
  return Array.from(allTags).sort();
}

// 更新 meta.json 文件
async function updateMetaJson(outputDir: string, locale: string, tags: string[]): Promise<void> {
  const metaPath = path.join(outputDir, 'meta.json');
  const localeConfig = LOCALES_CONFIG[locale];
  const serviceNames = SERVICE_NAMES[locale] || SERVICE_NAMES['en'];
  
  // 构建 pages 数组：index + 每个 tag 对应的文件（带分隔符）
  const pages: string[] = ['index'];
  
  for (const tag of tags) {
    // 添加分隔符（服务名称）
    const serviceName = serviceNames[tag] || tag;
    pages.push(`---${serviceName}---`);
    
    // 添加对应的文件名（tag 转小写）
    pages.push(tag.toLowerCase());
  }
  
  const metaContent = {
    title: localeConfig.title,
    description: localeConfig.description,
    root: true,
    icon: 'Code',
    pages,
  };
  
  await writeFile(metaPath, JSON.stringify(metaContent, null, 2) + '\n', 'utf-8');
  console.log(`  📋 更新 ${locale} 版本 meta.json (${tags.length} 个服务)`);
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

  // 从 YAML 文件中提取所有 tags
  const tags = await extractTagsFromYamlFiles(files);
  console.log(`\n🏷️  提取到 ${tags.length} 个服务标签:`);
  tags.forEach((t) => console.log(`  - ${t}`));

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
    
    // 更新 meta.json
    await updateMetaJson(outputDir, locale, tags);
  }

  console.log('\n✨ API 文档生成完成');
}

generate().catch((err) => {
  console.error('❌ 生成失败:', err);
  process.exit(1);
});
