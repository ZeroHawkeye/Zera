import { createOpenAPI } from 'fumadocs-openapi/server';
import { globSync } from 'glob';

// 自动扫描 openapi 目录下所有 yaml 文件
// 文件由 task docs:openapi:copy 从后端拷贝过来
const openapiFiles = globSync('./openapi/**/*.openapi.yaml');

export const openapi = createOpenAPI({
  input: openapiFiles,
});
