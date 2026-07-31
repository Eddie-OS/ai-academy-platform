// 从需求文档第 14 章的 markdown 表格机械抽取 6 类导入的模板列清单。
//
// 为什么需要这个脚本：模板列名是运营手里的 xlsx 与解析器之间的契约，而两边在代码里同源
// （ImportTemplateSpec 既生成模板又校验表头）。同源保证了两边一致，但保证不了「与需求一致」——
// 把「培训场次ID」写成「场次ID」时，模板和解析器一起错，全部测试仍然绿，直到验收时对不上需求正文。
// 因此这里把需求文档本身当作唯一数据源解析成 CSV，让测试拿它去对账各 Handler 的列声明。
// 这是与 scripts/statemachine/extract-transitions.mjs 同一套办法（纪律 PT-3：不写断言恒真的测试）。
//
// 用法：node scripts/import/extract-template-columns.mjs
// 输出：backend/app/src/test/resources/dataimport/requirement-template-columns.csv
//
// 需求第 14 章改动后必须重跑本脚本并重跑测试。

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const projectRoot = join(repoRoot, '..');
const REQUIREMENT_DOC = join(projectRoot, '需求文档', 'AI学院联合作战平台需求文档.md');
const OUTPUT = join(repoRoot, 'backend/app/src/test/resources/dataimport/requirement-template-columns.csv');

// 章节 → 导入类型枚举名。这张表是脚本里唯一的人工判断，且不触碰列数据本身。
// 14.2 组织架构导入 V1.2 已删除（N18、C03），不在其中。
const SECTIONS = {
  '14.3': 'PEOPLE',
  '14.4': 'ATTENDANCE',
  '14.5': 'LECTURER',
  '14.6': 'TRAINING_FEEDBACK',
  '14.7': 'TRIAL_FEEDBACK',
  '14.8': 'ATTENDEE',
};

const lines = readFileSync(REQUIREMENT_DOC, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/);

/** 去掉 markdown 强调标记与首尾空白。 */
function clean(cell) {
  return cell.replace(/\*\*/g, '').replace(/<br\s*\/?>/gi, ' ').trim();
}

const rows = [];
let current = null;
let ordinal = 0;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];

  const heading = line.match(/^##\s+(14\.\d+)\s/);
  if (heading) {
    current = SECTIONS[heading[1]] ?? null;
    ordinal = 0;
    continue;
  }
  // 各节的第一张表是列清单，后面的 ### 子节是「导入行为」「导入后的自动动作」，不要再读
  if (/^###\s/.test(line)) {
    current = null;
    continue;
  }
  if (!current || !line.startsWith('|')) {
    continue;
  }

  const cells = line.split('|').slice(1, -1).map(clean);
  if (cells.length < 3) {
    continue;
  }
  // 表头行与分隔行
  if (cells[0] === '列序' || /^-+$/.test(cells[0])) {
    continue;
  }
  // 删除线标记的列是 V1.2 删掉的（WeLink账号、公众号OpenID、是否运营角色）
  if (line.includes('~~')) {
    continue;
  }

  const [, header, requiredMark] = cells;
  if (!header || !/^[MO]$/.test(requiredMark)) {
    continue;
  }
  ordinal += 1;
  rows.push({
    importType: current,
    ordinal,
    header,
    required: requiredMark === 'M',
    sourceLine: i + 1,
  });
}

const missing = Object.values(SECTIONS).filter((type) => !rows.some((r) => r.importType === type));
if (missing.length > 0) {
  throw new Error(`以下导入类型未解析到任何列，请检查需求第 14 章的表格格式：${missing.join(', ')}`);
}

const csv = [
  'importType,ordinal,header,required,sourceLine',
  ...rows.map((r) => [r.importType, r.ordinal, r.header, r.required, r.sourceLine].join(',')),
].join('\n');

mkdirSync(dirname(OUTPUT), { recursive: true });
writeFileSync(OUTPUT, `${csv}\n`, 'utf8');

const perType = Object.values(SECTIONS)
  .map((type) => `${type}=${rows.filter((r) => r.importType === type).length}`)
  .join('  ');
console.log(`已解析 ${rows.length} 列：${perType}`);
console.log(`输出：${OUTPUT}`);
