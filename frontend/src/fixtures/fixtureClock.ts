import { isRegressionMode } from '@/app/regressionMode';

/**
 * 把 fixture 里的冻结日期平移到今天。
 *
 * <h3>为什么冻结日期不能就这么放着</h3>
 *
 * 这些日期是照着设计稿抄下来的，锚在 2024-06-10。放着不动的话，产品模式下后端一旦没给上数据、
 * 页面回落到 fixture，运营看到的就是两年前的日期——{@link resolveTrainingCalendar} 的注释
 * 早就点过同一个问题：「产品模式反过来必须落在真实当月，否则运营打开就是一张过期月历」。
 *
 * <h3>为什么又不能直接改掉那些字面量</h3>
 *
 * 《设计文档 V2.0》0.3 与 15.1 写明「不得使用今天」，指的是<b>视觉回归</b>：
 * 九张基线截图与多条 spec 断言都按冻结值比对，跟着今天变会让基线每天失效一次。
 *
 * <p>两条要求并不矛盾，它们说的是不同模式。所以本模块的判定与
 * {@link resolveTrainingCalendar} 完全一致：<b>回归模式原样返回，其余模式平移到今天。</b>
 *
 * <h3>平移，不是替换成今天</h3>
 *
 * 每个日期减去它所属的基准日、再加上今天，整批一起挪。fixture 里还写死着「剩余 2 天」
 * 「逾期 5 天」这类天数，逐个替换成今天会让它们全部对不上，而平移能保持相对关系不变。
 *
 * <h3>两个基准日</h3>
 *
 * fixtures 不是同一时期写的：绝大多数锚在 2024-06-10（设计稿的「今天」），
 * 而 `training.ts` 那批锚在 2026-08-04。按年份分派，两批各自挪到今天。
 */

/** 设计稿冻结的「今天」 */
const ANCHOR_DESIGN = '2024-06-10';

/** `training.ts` 那批的基准日，与 {@code resolveTrainingCalendar} 回归分支的 today 一致 */
const ANCHOR_TRAINING = '2026-08-04';

const WEEKDAY_CN = ['日', '一', '二', '三', '四', '五', '六'];
const pad = (n: number) => String(n).padStart(2, '0');

function toUtc(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y!, m! - 1, d!);
}

/**
 * 用 UTC 做日期算术。
 *
 * <p>这里只关心「差了多少天」，掺进时区偏移会在跨零点或跨时区时差出一天，
 * 而差一天的表现是「剩余 2 天」配着一个三天后的日期——看起来像数据错，不像时区错。
 */
function startOfTodayUtc(now: Date): number {
  return Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
}

interface Shifted {
  iso: string;
  y: number;
  m: number;
  d: number;
  weekday: number;
}

function makeShifter(now: Date) {
  const today = startOfTodayUtc(now);
  const offsetDesign = today - toUtc(ANCHOR_DESIGN);
  const offsetTraining = today - toUtc(ANCHOR_TRAINING);

  // 两批 fixture 的年份没有交叠，用年份分派就够，不需要再按文件区分
  const offsetFor = (year: number) => (year <= 2025 ? offsetDesign : offsetTraining);

  return function shift(y: number, m: number, d: number): Shifted {
    const moved = new Date(Date.UTC(y, m - 1, d) + offsetFor(y));
    return {
      iso: `${moved.getUTCFullYear()}-${pad(moved.getUTCMonth() + 1)}-${pad(moved.getUTCDate())}`,
      y: moved.getUTCFullYear(),
      m: moved.getUTCMonth() + 1,
      d: moved.getUTCDate(),
      weekday: moved.getUTCDay(),
    };
  };
}

type Shifter = ReturnType<typeof makeShifter>;

/**
 * 整串就是一个编号的写法。
 *
 * <p>编号里嵌着日期，不跟着挪就会出现「2026 年的截止日配 2024 年的编号」。
 * 必须整串匹配：`T-2405-09`、`JH-D13-01` 这些编号里的数字段和日期长得一样，
 * 放开边界去做子串替换会把不该动的编号一起改坏。
 */
const ID_RULES: ReadonlyArray<{ re: RegExp; rebuild: (m: RegExpMatchArray, shift: Shifter) => string }> = [
  {
    // TASK-2024-0612-001：年 + MMdd + 三位流水
    re: /^TASK-(\d{4})-(\d{2})(\d{2})-(\d+)$/,
    rebuild: (m, shift) => {
      const r = shift(Number(m[1]), Number(m[2]), Number(m[3]));
      return `TASK-${r.y}-${pad(r.m)}${pad(r.d)}-${m[4]}`;
    },
  },
  {
    // REQ-2024-0822：后四位是流水号不是日期（0786 不是合法日期），只挪年份
    re: /^REQ-(\d{4})-(\d+)$/,
    rebuild: (m, shift) => `REQ-${shift(Number(m[1]), 6, 10).y}-${m[2]}`,
  },
  {
    // KC-2024-0518：来源课程编号，年 + MMdd
    re: /^KC-(\d{4})-(\d{2})(\d{2})$/,
    rebuild: (m, shift) => {
      const r = shift(Number(m[1]), Number(m[2]), Number(m[3]));
      return `KC-${r.y}-${pad(r.m)}${pad(r.d)}`;
    },
  },
  {
    // AL2024050001：案例编号是 AL + yyyyMM + 四位流水，只有前六位跟日期有关
    re: /^AL(\d{4})(\d{2})(\d{4})$/,
    rebuild: (m, shift) => {
      const r = shift(Number(m[1]), Number(m[2]), 1);
      return `AL${r.y}${pad(r.m)}${m[3]}`;
    },
  },
  {
    // ST20240610001：评审记录号是 ST + yyyyMMdd + 三位流水
    re: /^ST(\d{4})(\d{2})(\d{2})(\d{3})$/,
    rebuild: (m, shift) => {
      const r = shift(Number(m[1]), Number(m[2]), Number(m[3]));
      return `ST${r.y}${pad(r.m)}${pad(r.d)}${m[4]}`;
    },
  },
  {
    // T-2405-09：试讲台账编号是 yyMM-dd，末尾的 a／b 区分同一天的两条
    re: /^T-(\d{2})(\d{2})-(\d{2})([a-z]?)$/,
    rebuild: (m, shift) => {
      const r = shift(2000 + Number(m[1]), Number(m[2]), Number(m[3]));
      return `T-${String(r.y).slice(2)}${pad(r.m)}-${pad(r.d)}${m[4]}`;
    },
  },
];

/** 整串就是 MM-dd（可带 HH:mm）：折线图横轴刻度、状态流转日志的时间戳 */
const MMDD_ONLY = /^(\d{2})-(\d{2})( \d{2}:\d{2})?$/;

/**
 * 嵌在文本里的 yyyy-MM-dd，可选跟 HH:mm，再可选跟「（周X）」。
 *
 * <p>要允许嵌在长串里，因为有「数据统计截止 2024-06-10，共 12 项待办需要跟进。」这种句子。
 * 两侧的 `(?![\w-])` 挡住编号里的数字段。星期后缀必须一起吃进来重算——
 * 平移的天数一般不是 7 的倍数，只挪日期会得到自相矛盾的「2026-08-10（周日）」。
 */
const DATE_IN_TEXT = /(?<![\w-])(\d{4})-(\d{2})-(\d{2})( \d{2}:\d{2})?(（周[日一二三四五六]）)?(?![\w-])/g;

function shiftString(value: string, shift: Shifter): string {
  for (const rule of ID_RULES) {
    const m = value.match(rule.re);
    if (m) return rule.rebuild(m, shift);
  }

  const mmdd = value.match(MMDD_ONLY);
  if (mmdd) {
    // 横轴刻度与流转日志没有年份，按设计稿那批的基准年补上再平移
    const r = shift(Number(ANCHOR_DESIGN.slice(0, 4)), Number(mmdd[1]), Number(mmdd[2]));
    return `${pad(r.m)}-${pad(r.d)}${mmdd[3] ?? ''}`;
  }

  return value.replace(DATE_IN_TEXT, (_all, y: string, m: string, d: string, time?: string, weekday?: string) => {
    const r = shift(Number(y), Number(m), Number(d));
    return `${r.iso}${time ?? ''}${weekday ? `（周${WEEKDAY_CN[r.weekday]}）` : ''}`;
  });
}

function deepShift(value: unknown, shift: Shifter): unknown {
  if (typeof value === 'string') return shiftString(value, shift);
  if (Array.isArray(value)) return value.map((item) => deepShift(item, shift));
  if (value && typeof value === 'object') {
    // 只处理纯数据对象。fixture 里没有 Date、Map 这类实例，真出现了也应当原样保留
    if (Object.getPrototypeOf(value) !== Object.prototype) return value;
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, deepShift(v, shift)]));
  }
  return value;
}

/**
 * 把一份 fixture 里的全部日期平移到今天。
 *
 * <p>回归模式下原样返回，连对象引用都不换——视觉基线比对的就是这些冻结值。
 *
 * @param value 任意形状的 fixture 数据，返回值与入参同类型
 */
export function withCurrentDates<T>(value: T, now: Date = new Date()): T {
  if (isRegressionMode()) return value;
  return deepShift(value, makeShifter(now)) as T;
}

/** 单个日期串的平移。给 JSX 里内联写死的那几处用 */
export function currentDateText(value: string, now: Date = new Date()): string {
  if (isRegressionMode()) return value;
  return shiftString(value, makeShifter(now));
}

/**
 * 月历锚点：把冻结的年月与打点日号一起挪到今天所在的月份。
 *
 * <p>跨出目标月份的日号直接丢掉。保留的话会画到错误的格子上，
 * 而画错的点和画对的点长得一模一样，没人能从截图上看出来。
 */
export function withCurrentCalendar<T extends { year: number; month: number; selectedDate: string; scheduledDays: readonly number[] }>(
  frozen: T,
  now: Date = new Date(),
): T {
  if (isRegressionMode()) return frozen;

  const shift = makeShifter(now);
  const [fy, fm] = frozen.selectedDate.split('-').map(Number);
  const selected = shift(fy!, fm!, Number(frozen.selectedDate.slice(8, 10)));

  const scheduledDays = frozen.scheduledDays
    .map((day) => shift(frozen.year, frozen.month, day))
    .filter((r) => r.y === selected.y && r.m === selected.m)
    .map((r) => r.d);

  return { ...frozen, year: selected.y, month: selected.m, selectedDate: selected.iso, scheduledDays };
}

/** 「08 月 07 日（周五）」这类展示串。星期由日期算出来，不允许另写一份 */
export function formatMonthDayWeekday(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const weekday = new Date(Date.UTC(y!, m! - 1, d!)).getUTCDay();
  return `${pad(m!)} 月 ${pad(d!)} 日（周${WEEKDAY_CN[weekday]}）`;
}
