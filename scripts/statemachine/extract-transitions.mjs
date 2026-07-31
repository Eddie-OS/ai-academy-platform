// 从需求文档第 5 章的 markdown 表格机械抽取状态机转换表。
//
// 为什么需要这个脚本：出口准则 E1-1 要求「第 5 章的全部转换行有对应通过的参数化测试」。
// 如果引擎的转换表与测试读同一份数据，测试就什么也没证明 —— 这正是纪律 PT-3 警告的
// 「断言恒真的测试」。因此这里把需求文档本身当作唯一数据源解析成 CSV，引擎的转换表在
// Java 里独立手写，测试拿 CSV 逐行驱动引擎。任何转录错误都会让测试红灯。
//
// 用法：node scripts/statemachine/extract-transitions.mjs
// 输出：backend/platform/statemachine/src/test/resources/statemachine/requirement-transitions.csv
//
// 需求文档改动后必须重跑本脚本并重跑测试。

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const projectRoot = join(repoRoot, '..');
const REQUIREMENT_DOC = join(projectRoot, '需求文档', 'AI学院联合作战平台需求文档.md');
const OUTPUT = join(
  repoRoot,
  'backend/platform/statemachine/src/test/resources/statemachine/requirement-transitions.csv',
);

// 章节标题 → 状态机身份。
//
// 这张表是本脚本里唯一的人工判断，且不触碰转换数据本身：objectType 与 stateField 来自
// 开发实施文档 5.1.3「状态机的主键是（对象类型 + 状态字段名）」，machine 名取自需求 5.13 清单。
// stateField 的中文名必须与需求 5.11 日志表的「状态字段名」列一致。
const SECTIONS = {
  '5.2.1': { machine: '需求评审状态', objectType: 'DEMAND', stateField: '需求评审状态' },
  '5.2.3': { machine: '解决方案状态', objectType: 'DEMAND', stateField: '解决方案状态' },
  '5.2.4': { machine: '需求开发状态', objectType: 'DEMAND', stateField: '需求开发状态' },
  '5.2.5': { machine: '需求业务验收状态', objectType: 'DEMAND', stateField: '业务验收状态' },
  '5.3.1': { machine: '课程主状态', objectType: 'COURSE', stateField: '课程主状态' },
  '5.4.1': { machine: '课程开发子状态', objectType: 'COURSE', stateField: '课程开发状态' },
  '5.4.2': { machine: '课程自检子状态', objectType: 'COURSE', stateField: '课程自检状态' },
  '5.4.3': { machine: '试讲子状态', objectType: 'COURSE', stateField: '试讲状态' },
  '5.4.4': { machine: '课程发布子状态', objectType: 'COURSE', stateField: '课程发布状态' },
  '5.5': { machine: '课程评审记录状态', objectType: 'COURSE_REVIEW', stateField: '评审记录状态' },
  '5.6': { machine: '试讲记录状态', objectType: 'COURSE_TRIAL', stateField: '试讲记录状态' },
  '5.7': { machine: '培训计划状态', objectType: 'TRAINING_PLAN', stateField: '培训计划状态' },
  '5.8': { machine: '培训场次状态', objectType: 'TRAINING_SESSION', stateField: '培训场次状态' },
  '5.9': { machine: '案例状态', objectType: 'CASE', stateField: '案例状态' },
  '5.10': { machine: '任务状态', objectType: 'TASK', stateField: '任务状态' },
};

// 表示「无状态」的写法。（新建）用于对象尚不存在，（空）用于状态字段尚未置值。
// 两者在引擎里都是 from = null；但（空）也会作为转换目标出现（5.4.2 取消自检），那时它是真实状态。
const EMPTY_STATE = /^（(新建|空)）$/;

const lines = readFileSync(REQUIREMENT_DOC, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/);

/** 去掉 markdown 强调、换行标记与首尾空白。 */
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

/** 当前小节号：匹配 `## 5.7 xxx` 或 `### 5.2.1 xxx`。 */
function sectionOf(line) {
  const m = /^#{2,4}\s+(5(?:\.\d+){1,2})\s/.exec(line);
  return m ? m[1] : null;
}

const transitions = [];
const warnings = [];
let section = null;

for (let i = 0; i < lines.length; i++) {
  const heading = sectionOf(lines[i]);
  if (heading) {
    section = heading;
    continue;
  }
  if (!isTableRow(lines[i])) continue;

  const header = splitRow(lines[i]);
  const fromIdx = header.indexOf('当前状态');
  const actionIdx = header.indexOf('动作');
  const toIdx = header.indexOf('目标状态');
  // 只认「当前状态 / 动作 / 目标状态」三列齐全的表。第 5 章还有子状态对应关系表、
  // 结论取值表、落地要点表等，它们不是转换表，靠这个条件自然排除。
  if (fromIdx < 0 || actionIdx < 0 || toIdx < 0) continue;

  const meta = SECTIONS[section];
  if (!meta) {
    warnings.push(`第 ${i + 1} 行发现转换表，但小节 ${section} 未登记在 SECTIONS 中`);
    continue;
  }
  const effectIdx = header.indexOf('系统副作用');

  i += 2; // 跳过表头与分隔行
  for (; i < lines.length && isTableRow(lines[i]); i++) {
    const cells = splitRow(lines[i]);
    const rawFrom = cells[fromIdx] ?? '';
    const action = cells[actionIdx] ?? '';
    const to = cells[toIdx] ?? '';
    const effects = effectIdx >= 0 ? (cells[effectIdx] ?? '') : '';
    if (!action || !to) continue;

    // 一行含多个起始状态（课程主状态第 15 行「立项 / 开发 / 自检 / 优化」、
    // 任务第 4 行「待处理 / 处理中」）要展开成多条转换。只拆起始状态列：
    // 动作与目标状态列不存在多值语义。
    const froms = EMPTY_STATE.test(rawFrom)
      ? ['']
      : rawFrom.split('/').map((s) => s.trim()).filter(Boolean);

    for (const from of froms) {
      transitions.push({
        machine: meta.machine,
        objectType: meta.objectType,
        stateField: meta.stateField,
        from,
        action,
        to: EMPTY_STATE.test(to) ? '（空）' : to,
        effects,
        sourceLine: i + 1,
      });
    }
  }
  i--; // 让外层循环重新看这一行（它已不是表格行）
}

// ---------------------------------------------------------------------------
// 与需求 5.13 的「状态值数」列交叉核对。
//
// 计数口径：一个状态只要作为转换目标出现过就计入。这个口径能解释 5.4.2 的（空）——
// 「取消自检」把状态改回（空），所以它是真实状态而非仅初始伪状态。
//
// 5.13 是汇总清单，不是权威值域来源。已核实它有两处笔误：两个状态机的转换表与各自的
// 字段清单（第 8、9 章）都与 5.13 不一致，而那两个来源互相一致。开发按转换表实现。
// 这里登记已确认的差异，好让脚本以后只对「新出现」的差异报警。
const COUNT_OVERRIDES = {
  需求业务验收状态: {
    actual: 3,
    reason: '需求字段清单第 30 项（需求文档 1216 行）值域为「待验收 / 验收通过 / 验收不通过」，5.13 的 4 有误',
  },
  课程开发子状态: {
    actual: 3,
    reason: '课程字段清单第 14 项（需求文档 1348 行）值域为「待开发 / 开发中 / 自检中」，5.13 的 2 有误',
  },
};
// ---------------------------------------------------------------------------
const declared = {};
for (let i = 0; i < lines.length; i++) {
  if (sectionOf(lines[i]) === '5.13') {
    for (let j = i; j < lines.length && j < i + 40; j++) {
      if (!isTableRow(lines[j])) continue;
      const cells = splitRow(lines[j]);
      if (cells.length < 5 || !/^\d+$/.test(cells[3])) continue;
      declared[cells[1]] = Number(cells[3]);
    }
    break;
  }
}

const byMachine = new Map();
for (const t of transitions) {
  if (!byMachine.has(t.machine)) byMachine.set(t.machine, new Set());
  byMachine.get(t.machine).add(t.to);
}
const resolved = [];
for (const [machine, states] of byMachine) {
  const expected = declared[machine];
  if (expected === undefined || expected === states.size) continue;

  const override = COUNT_OVERRIDES[machine];
  if (override && override.actual === states.size) {
    resolved.push(`「${machine}」5.13 写 ${expected}，实为 ${states.size}：${override.reason}`);
  } else {
    warnings.push(
      `「${machine}」需求 5.13 声明 ${expected} 个状态值，转换表出现 ${states.size} 个：` +
        `${[...states].join('、')}。请回查该对象的字段清单确认哪一处有误`,
    );
  }
}

const missing = Object.values(SECTIONS)
  .map((s) => s.machine)
  .filter((m) => !byMachine.has(m));
if (missing.length) warnings.push(`以下状态机未解析到任何转换：${missing.join('、')}`);

// ---------------------------------------------------------------------------
// 输出
// ---------------------------------------------------------------------------
const csv = [
  '状态机,对象类型,状态字段,起始状态,动作,目标状态,系统副作用,需求文档行号',
  ...transitions.map((t) =>
    [t.machine, t.objectType, t.stateField, t.from, t.action, t.to, t.effects, t.sourceLine]
      .map((v) => (/[",]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : v))
      .join(','),
  ),
].join('\n');

mkdirSync(dirname(OUTPUT), { recursive: true });
writeFileSync(OUTPUT, csv + '\n', 'utf8');

console.log(`解析到 ${transitions.length} 条转换，覆盖 ${byMachine.size} 个状态机。`);
for (const [machine, states] of byMachine) {
  const count = transitions.filter((t) => t.machine === machine).length;
  console.log(`  ${machine.padEnd(12, '　')} ${String(count).padStart(2)} 条转换 / ${states.size} 个状态`);
}
console.log(`已写入 ${OUTPUT}`);

if (resolved.length) {
  console.log('\n已确认的需求文档笔误（按转换表实现）：');
  for (const r of resolved) console.log(`  · ${r}`);
}

if (warnings.length) {
  console.log('\n需要人工确认的差异：');
  for (const w of warnings) console.log(`  ! ${w}`);
  process.exitCode = 1;
}
