import { createOpenAPI } from 'fumadocs-openapi/server';
import { globSync } from 'glob';
import path from 'node:path';

// 将 Windows 路径转换为 POSIX 路径
function toPosixPath(p: string): string {
  return p.split(path.sep).join(path.posix.sep);
}

// 自动扫描 openapi 目录下所有 yaml 文件
// 文件由 task docs:openapi:copy 从后端拷贝过来
export const openapi = createOpenAPI({
  input: () => {
    const files = globSync('./openapi/**/*.openapi.yaml');
    const result: Record<string, string> = {};
    for (const file of files) {
      // 使用 POSIX 格式的路径作为 schema ID
      const posixPath = toPosixPath(file);
      result[posixPath] = path.resolve(file);
    }
    return result;
  },
});
