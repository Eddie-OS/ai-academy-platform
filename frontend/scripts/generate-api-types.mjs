/**
 * OpenAPI → TypeScript 类型生成骨架（文档待修清单 P-1）。
 *
 * 用法（需能访问 npm registry）：
 *   cd frontend
 *   npm i -D openapi-typescript
 *   node scripts/generate-api-types.mjs
 *
 * 前置：后端已启动，可访问 http://localhost:8080/v3/api-docs
 *
 * 纪律：生成的是 interface／schema，不生成枚举字面量。
 * 状态值、字典项、导入类型仍只从 /api/meta/* 与专用下发接口读取（STK-1）。
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const API_DOCS = process.env.OPENAPI_URL ?? 'http://localhost:8080/v3/api-docs';
const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'shared', 'api', 'generated');
const outFile = join(outDir, 'schema.d.ts');

async function main() {
  let openapiTypescript;
  try {
    openapiTypescript = (await import('openapi-typescript')).default;
  } catch {
    console.error(
      '未安装 openapi-typescript。执行：npm i -D openapi-typescript\n' +
        '若当前离线，保留手写 shared/api/*.ts，见 docs/阶段5-文档待修结清记录.md P-1 例外。',
    );
    process.exit(2);
  }

  console.log('拉取', API_DOCS);
  const schema = await openapiTypescript(API_DOCS);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(outFile, schema, 'utf8');
  console.log('已写入', outFile);
  console.log('下一步：将 shared/api 中手写 interface 改为 re-export generated 类型（勿引入枚举字面量）。');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
