// 从需求文档第 8–13 章的 markdown 字段清单机械抽取字段规格。
//
// 为什么需要这个脚本：开发实施文档 6.2 说「字段清单在需求文档第 8–14 章已经逐页面给全，
// 开发照抄即可」。43 张表、数百个字段，手工「照抄」是 1B 最大的漏字段风险来源，而漏一个
// 字段的后果是业务功能到阶段 3 才发现无处落库。
//
// 这里沿用 1A 的做法：把需求文档当唯一数据源解析成 CSV，建表语句在 Flyway 里独立手写，
// 再用测试拿 CSV 逐行核对真实库的列。漏建的字段会让测试红灯。
//
// 本脚本刻意不做「章节 → 表」的映射。一个章节的字段可以落到多张表（9.3.3 的「当前材料
// 版本号」在课程主表，而「课件 / 教案 / 实验材料」是材料表的多行），一对一映射会逼出错误
// 的归属判断。字段到表列的绑定放在 requirement-field-mapping.csv 里手写，由测试断言那份
// 映射对本 CSV 的有效字段完整覆盖——漏模的字段会让测试红灯。
//
// 用法：node scripts/schema/extract-field-specs.mjs
// 输出：backend/app/src/test/resources/schema/requirement-fields.csv
//
// 需求文档改动后必须重跑本脚本并重跑测试。

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const projectRoot = join(repoRoot, '..');
const REQUIREMENT_DOC = join(projectRoot, '需求文档', 'AI学院联合作战平台需求文档.md');
const OUTPUT = join(repoRoot, 'backend/app/src/test/resources/schema/requirement-fields.csv');

// 只抽这些章节的字段清单。第 8–13 章是逐页面的字段规格，第 14 章是导入模板（列与库表
// 不是一对一，另行处理），第 15 章是指标公式。
const CHAPTERS = /^(?:8|9|10|11|12|13)\b/;

const lines = readFileSync(REQUIREMENT_DOC, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/);

/** 去掉 markdown 强调、换行标记与首尾空白。删除线要保留，它是「该字段已废弃」的唯一标记。 */
function clean(cell) {
  return cell
    .replace(/<br\s*\/?>/g, ' ')
    .replace(/\*\*/g, '')
    .replace(/`/g, '')
    .trim();
}

function isTableRow(line) {
  return line.trim().startsWith('|');
}

function splitRow(line) {
  const trimmed = line.trim();
  return trimmed
    .slice(1, trimmed.endsWith('|') ? -1 : undefined)
    .split('|')
    .map(clean);
}

function isSeparatorRow(cells) {
  return cells.every((c) => /^:?-{1,}:?$/.test(c));
}

/**
 * 当前小节号：匹配 `## 8.3 xxx`、`### 8.3.1 xxx`、`### 9.7a.1 xxx`。
 *
 * 字母后缀必须支持。文档里用 `9.7a`、`13.4.1a`、`16.1.1a` 表示「插在既有编号之间的新增小节」，
 * 漏掉它会让该小节的表被错记到上一个小节名下——试讲反馈字段就曾被记到「9.7.3 结论不一致
 * 的界面处理」名下。
 */
function sectionOf(line) {
  const m = /^#{2,4}\s+(\d+[a-z]?(?:\.\d+[a-z]?){0,2})\s/.exec(line);
  return m ? m[1] : null;
}

function headingTextOf(line) {
  const m = /^#{2,4}\s+(.*)$/.exec(line);
  return m ? clean(m[1]) : null;
}

const fields = [];
const warnings = [];
let section = null;
let heading = null;

for (let i = 0; i < lines.length; i++) {
  const s = sectionOf(lines[i]);
  if (s) {
    section = s;
    heading = headingTextOf(lines[i]);
    continue;
  }
  if (!CHAPTERS.test(section ?? '')) continue;
  if (!isTableRow(lines[i])) continue;

  const header = splitRow(lines[i]);
  // 只认「# + 字段 + 类型」三列齐全的表。第 8–13 章还有页签表、规则表、指标表等，
  // 靠这个条件自然排除。
  if (header[0] !== '#' || header[1] !== '字段' || header[2] !== '类型') continue;

  const idxOf = (...names) => {
    for (const n of names) {
      const k = header.indexOf(n);
      if (k >= 0) return k;
    }
    return -1;
  };
  const requiredIdx = idxOf('必填');
  const valuesIdx = idxOf('取值 / 长度', '取值', '取值范围');
  const editableIdx = idxOf('可编辑');
  const remarkIdx = idxOf('说明');

  // 逐行读到表格结束
  for (let j = i + 1; j < lines.length && isTableRow(lines[j]); j++) {
    const cells = splitRow(lines[j]);
    if (isSeparatorRow(cells)) continue;

    const rawSeq = cells[0] ?? '';
    const rawName = cells[1] ?? '';
    // 删除线出现在序号或字段名上，两种写法文档里都有
    const deleted = /^~~.*~~$/.test(rawSeq) || /^~~.*~~$/.test(rawName);
    const strip = (v) => v.replace(/~~/g, '').trim();

    const name = strip(rawName);
    if (!name || name === '—') continue;

    fields.push({
      section,
      heading: heading ?? '',
      seq: strip(rawSeq),
      name,
      type: strip(cells[2] ?? ''),
      required: requiredIdx >= 0 ? strip(cells[requiredIdx] ?? '') : '',
      values: valuesIdx >= 0 ? strip(cells[valuesIdx] ?? '') : '',
      editable: editableIdx >= 0 ? strip(cells[editableIdx] ?? '') : '',
      remark: remarkIdx >= 0 ? strip(cells[remarkIdx] ?? '') : '',
      deleted: deleted ? 'Y' : 'N',
      sourceLine: j + 1,
    });
    i = j;
  }
}

const csv = [
  '章节,小节标题,序号,字段,类型,必填,取值,可编辑,说明,已删除,需求文档行号',
  ...fields.map((f) =>
    [
      f.section, f.heading, f.seq, f.name, f.type, f.required,
      f.values, f.editable, f.remark, f.deleted, f.sourceLine,
    ]
      .map((v) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : v))
      .join(','),
  ),
].join('\n');

mkdirSync(dirname(OUTPUT), { recursive: true });
writeFileSync(OUTPUT, csv + '\n', 'utf8');

const live = fields.filter((f) => f.deleted === 'N').length;
console.log(`解析到 ${fields.length} 个字段（有效 ${live}，已废弃 ${fields.length - live}）。`);
const bySection = new Map();
for (const f of fields) {
  const key = `${f.section} ${f.heading.replace(/^[\d.a-z]+\s*/, '')}`;
  if (!bySection.has(key)) bySection.set(key, { live: 0, dead: 0 });
  bySection.get(key)[f.deleted === 'N' ? 'live' : 'dead']++;
}
for (const [t, c] of bySection) {
  console.log(`  ${t.padEnd(30, '　')} 有效 ${String(c.live).padStart(3)}　废弃 ${c.dead}`);
}
console.log(`已写入 ${OUTPUT}`);

if (warnings.length) {
  console.log('\n警告：');
  for (const w of warnings) console.log(w);
  process.exitCode = 1;
}
