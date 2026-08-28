import type { ActionAvailability } from '@/shared/api/types';
import {
  COURSE_ACTION_AVAILABILITY,
  COURSE_ACTION_AVAILABILITY_STATE,
  COURSE_BLOCKED_REASON_TEMPLATE,
  COURSE_BOARD,
  COURSE_CARD_ATTRS,
  COURSE_INITIAL_STATE,
  COURSE_KPIS,
  COURSE_MAIN_TRANSITIONS,
  COURSE_OFF_BOARD_STOCK,
  COURSE_STATE_LOG_TEMPLATE,
  type CourseAttrField,
  type CourseAttrs,
  type CourseCard,
  type CourseFilterSpec,
  type CourseKpiId,
} from '@/fixtures/course';

/**
 * 课程工作台复刻件的可变模拟数据。
 *
 * <h3>为什么需要这一层，而不是直接读 fixtures</h3>
 *
 * fixtures 是<b>一份静态快照</b>：七列计数、五张 KPI、21 张卡都是常量。直接渲染它的后果是
 * 筛选、新建、状态动作全都只能改「哪些卡显示出来」，而<b>计数一个都不会动</b> ——
 * 新建一门课，看板上多一张卡，立项列还写 18，KPI 课程总数还写 842。两个数就在同一屏上，
 * 对不上一眼就能看见，而且看起来像「统计坏了」而不是「这是死数据」。
 *
 * <p>这一层把快照展开成可变状态：存量、样本卡、日志三份分开存，动作按需求 5.3.1 的转换表
 * 改存量并搬卡片，KPI 一律现算。全部是纯函数，`CourseV2Page` 只持有一个 state。
 *
 * <h3>存量与样本卡是两件事</h3>
 *
 * 列头那个数（开发 214）是<b>存量</b>，列里那三张卡是<b>样本</b>。文档只冻结了七列的计数，
 * 一张卡的内容都没给（见 fixtures 头注）。所以搬一张卡的同时要改两个存量数字：
 * 来源列 −1、目标列 +1。把两者当成一件事（让计数 = 卡片数）会把 214 变成 3。
 *
 * <h3>课程总数 = 七列存量 + 不上看板的存量</h3>
 *
 * 828 + 14 = 842。差的 14 门在三个终态里，它们退出预警范围、不上看板，但仍然是课程。
 * 这里显式建模成 {@link COURSE_OFF_BOARD_STOCK}，而不是在 828 上 +14：
 * 常量 14 会在第一次「录入结论=不通过·关闭」之后就变成错的（那门课进了终态，应该是 15）。
 *
 * <p><b>这层不做任何权限判断，也不校验业务前置条件</b>（C2、PMI-4）：
 * 动作可不可点只看转换表里有没有这条边。
 */

/** 看板上的一门课：fixture 的卡面数据 + 当前主状态 + 可筛属性 */
export interface MockCourse extends CourseCard {
  state: string;
  attrs: CourseAttrs;
}

export interface CourseLogEntry {
  at: string;
  text: string;
}

export interface CourseBoardState {
  /** 七列存量，键是列 id */
  stock: Record<string, number>;
  /** 不上看板的存量，键是主状态 */
  offBoard: Record<string, number>;
  cards: MockCourse[];
  /** 每门课的状态流转日志，新的在前。只有动过状态的课程才有条目 */
  logs: Record<string, CourseLogEntry[]>;
  /** 下一个系统生成的课程编号取到几 */
  nextSeq: number;
}

export interface CourseFilterState {
  keyword: string;
  /** 键是筛选器 id，值是选中的取值；空串表示未选 */
  values: Record<string, string>;
}

export const EMPTY_COURSE_FILTER: CourseFilterState = { keyword: '', values: {} };

/** 系统生成的课程编号形如 C-0912，新建时取现有最大号 +1 */
const ID_PREFIX = 'C-';
const ID_DIGITS = 4;

function seqOf(id: string): number {
  const parsed = Number(id.replace(ID_PREFIX, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatId(seq: number): string {
  return `${ID_PREFIX}${String(seq).padStart(ID_DIGITS, '0')}`;
}

/** 没有登记可筛属性的课程（新建出来的）用这一组兜底，字段一个都不能缺 */
function fallbackAttrs(): CourseAttrs {
  const first = Object.values(COURSE_CARD_ATTRS)[0];
  return { ...first!, subState: null };
}

export function createCourseBoardState(): CourseBoardState {
  const cards: MockCourse[] = [];
  const stock: Record<string, number> = {};

  COURSE_BOARD.forEach((column) => {
    stock[column.id] = column.count;
    column.cards.forEach((card) => {
      cards.push({
        ...card,
        // 第七列收两个主状态，样本卡一律落在前一个；搬进来的课程带自己的状态
        state: column.states[0]!,
        attrs: COURSE_CARD_ATTRS[card.id] ?? fallbackAttrs(),
      });
    });
  });

  const offBoard: Record<string, number> = {};
  COURSE_OFF_BOARD_STOCK.forEach((bucket) => {
    offBoard[bucket.state] = bucket.count;
  });

  const maxSeq = cards.reduce((max, card) => Math.max(max, seqOf(card.id)), 0);

  return { stock, offBoard, cards, logs: {}, nextSeq: maxSeq + 1 };
}

/** 主状态落在哪一列。返回 null 表示这个状态不上看板（终态与「优化」） */
export function courseColumnOf(state: string): string | null {
  return COURSE_BOARD.find((column) => column.states.includes(state))?.id ?? null;
}

/**
 * 五张 KPI 的数值。
 *
 * <p>口径固定为<b>全量存量，不随筛选变</b>（见 {@link courseFilterSummary} 的说明）。
 * 逐张卡取哪一列由 fixtures 的 `column` 字段决定，这里不认识任何状态名。
 */
export function courseKpiValues(state: CourseBoardState): Record<CourseKpiId, number> {
  const boardTotal = Object.values(state.stock).reduce((sum, count) => sum + count, 0);
  const offBoardTotal = Object.values(state.offBoard).reduce((sum, count) => sum + count, 0);

  const values = {} as Record<CourseKpiId, number>;
  COURSE_KPIS.forEach((kpi) => {
    values[kpi.id] = kpi.column === null ? boardTotal + offBoardTotal : (state.stock[kpi.column] ?? 0);
  });
  return values;
}

/** 七列存量合计。与 KPI 课程总数刻意不等，差额是不上看板的那几门 */
export function courseBoardTotal(state: CourseBoardState): number {
  return Object.values(state.stock).reduce((sum, count) => sum + count, 0);
}

function attrValue(card: MockCourse, field: CourseAttrField): string | null {
  if (field === 'owner') return card.owner;
  if (field === 'light') return card.light;
  return card.attrs[field];
}

export function matchesCourseFilter(
  card: MockCourse,
  filter: CourseFilterState,
  specs: readonly CourseFilterSpec[],
): boolean {
  const keyword = filter.keyword.trim().toLowerCase();
  if (keyword && !`${card.id} ${card.name} ${card.owner}`.toLowerCase().includes(keyword)) {
    return false;
  }

  return specs.every((spec) => {
    const wanted = filter.values[spec.id];
    if (!wanted) return true;
    return attrValue(card, spec.field) === wanted;
  });
}

export interface CourseColumnView {
  id: string;
  title: string;
  /** 列头那个数：存量，不是下面卡片的张数 */
  count: number;
  cards: MockCourse[];
}

export function courseBoardColumns(
  state: CourseBoardState,
  filter: CourseFilterState,
  specs: readonly CourseFilterSpec[],
): CourseColumnView[] {
  return COURSE_BOARD.map((column) => ({
    id: column.id,
    title: column.title,
    count: state.stock[column.id] ?? 0,
    cards: state.cards.filter(
      (card) =>
        courseColumnOf(card.state) === column.id && matchesCourseFilter(card, filter, specs),
    ),
  }));
}

export function isCourseFilterActive(filter: CourseFilterState): boolean {
  return filter.keyword.trim() !== '' || Object.values(filter.values).some((value) => value !== '');
}

/**
 * 筛选行右侧的命中提示。
 *
 * <h3>为什么筛选不改 KPI（口径已定，不是漏了）</h3>
 *
 * 五张卡是<b>全量存量</b>：课程总数 = 七列存量 + 三个终态的 14 门。终态那 14 门在模拟数据里
 * 只有计数、没有卡片，筛选条件（负责人、灯色、子状态）压根落不到它们身上 ——
 * 让 KPI 跟着筛选走，就必须给这 14 门凭空编出属性来参与过滤，而<b>编出来的那部分谁也验不了</b>。
 *
 * <p>所以筛选只收窄看板上看得见的卡片，命中数写在筛选行里，让人一眼知道「筛的是卡不是卡上的数」。
 */
export function courseFilterSummary(
  columns: CourseColumnView[],
  state: CourseBoardState,
): { hit: number; all: number } {
  return {
    hit: columns.reduce((sum, column) => sum + column.cards.length, 0),
    all: state.cards.length,
  };
}

/** 某个筛选器的下拉选项。fixtures 没给的从看板现有卡片的取值去重 */
export function courseFilterOptions(
  spec: CourseFilterSpec,
  state: CourseBoardState,
): string[] {
  if (spec.options) return [...spec.options];
  const values = state.cards
    .map((card) => attrValue(card, spec.field))
    .filter((value): value is string => value !== null);
  return [...new Set(values)];
}

/**
 * 一门课在当前主状态下的可执行动作，形状照
 * `/api/{objectType}/{id}/transitions/available`。
 *
 * <p>allowed 逐条来自转换表；blocked 取 fixture 里那两条运营最常找的动作 ——
 * 只列 allowed 的话，「提交评审」在评审阶段直接消失，界面就无法解释「为什么不能再提交」
 * （体验总纲 C-1）。原因文案在 fixture 那个状态下用它自己写好的引导语，其余状态套模板。
 */
export function courseAvailability(mainState: string): ActionAvailability {
  const allowedActions = COURSE_MAIN_TRANSITIONS.filter((row) => row.from === mainState).map(
    (row) => row.action,
  );

  const blockedActions = COURSE_ACTION_AVAILABILITY.blockedActions
    .filter((blocked) => !allowedActions.includes(blocked.action))
    .map((blocked) => ({
      action: blocked.action,
      reason:
        mainState === COURSE_ACTION_AVAILABILITY_STATE
          ? blocked.reason
          : COURSE_BLOCKED_REASON_TEMPLATE.replace('{state}', mainState).replace(
              '{action}',
              blocked.action,
            ),
    }));

  return { allowedActions, blockedActions };
}

/** 按钮渲染顺序：可点的按转换表顺序在前，置灰的在后 */
export function courseActionOrder(availability: ActionAvailability): string[] {
  return [...availability.allowedActions, ...availability.blockedActions.map((item) => item.action)];
}

export interface CourseTransitionResult {
  next: CourseBoardState;
  /** 给运营的反馈文案。null 表示这条动作在当前状态下无效，什么都没改 */
  message: string | null;
  /** 目标状态是否已不上看板 */
  leftBoard: boolean;
}

/**
 * 执行一次主状态转换。
 *
 * <p>只校验转换表里有没有这条边（C3 硬阻断在服务层，这里是模拟的服务层），
 * <b>不做任何业务前置校验</b>（C2：加上「未自检不能提交评审」会拦住运营录历史数据）。
 *
 * <p>三件事同时发生，缺一件计数就会对不上：
 * 卡片换状态、来源与目标的存量各动一格、写一条状态流转日志（原则二）。
 */
export function applyCourseTransition(
  state: CourseBoardState,
  courseId: string,
  action: string,
  now: string,
): CourseTransitionResult {
  const card = state.cards.find((item) => item.id === courseId);
  if (!card) return { next: state, message: null, leftBoard: false };

  const row = COURSE_MAIN_TRANSITIONS.find(
    (item) => item.from === card.state && item.action === action,
  );
  if (!row) return { next: state, message: null, leftBoard: false };

  const fromColumn = courseColumnOf(card.state);
  const toColumn = courseColumnOf(row.to);

  const stock = { ...state.stock };
  const offBoard = { ...state.offBoard };

  if (fromColumn) stock[fromColumn] = (stock[fromColumn] ?? 0) - 1;
  else offBoard[card.state] = (offBoard[card.state] ?? 0) - 1;

  if (toColumn) stock[toColumn] = (stock[toColumn] ?? 0) + 1;
  else offBoard[row.to] = (offBoard[row.to] ?? 0) + 1;

  const moved: MockCourse = {
    ...card,
    state: row.to,
    /*
     * 状态一变，last_state_changed_at 就是现在，停滞天数归零、灯回到正常运行。
     * 不重置的话，刚推进过的课程仍挂着停滞 9 天的红灯，运营会以为动作没生效。
     */
    light: 'BLUE',
    lightReason: undefined,
    stalledDays: 0,
    attrs: {
      ...card.attrs,
      subState: row.subState ?? null,
      reviewState: row.reviewState ?? card.attrs.reviewState,
    },
  };

  const log: CourseLogEntry = {
    at: now,
    text: COURSE_STATE_LOG_TEMPLATE.replace('{from}', card.state).replace('{to}', row.to),
  };

  return {
    next: {
      ...state,
      stock,
      offBoard,
      cards: state.cards.map((item) => (item.id === courseId ? moved : item)),
      logs: { ...state.logs, [courseId]: [log, ...(state.logs[courseId] ?? [])] },
    },
    message: `${card.name}：${log.text}`,
    leftBoard: toColumn === null,
  };
}

export interface CourseDraft {
  name: string;
  owner: string;
  type: string;
  category: string;
}

/**
 * 新建一门课。
 *
 * <p>转换表第 1 条：`（空）→ 课程立项 → 立项`。所以新课落在第一列，
 * 立项列存量 +1，课程总数随之 +1（总数是加出来的，不是另存一个数）。
 * 课程 ID 由系统生成（需求 9.1），表单里没有这一项。
 */
export function addCourseToBoard(
  state: CourseBoardState,
  draft: CourseDraft,
  now: string,
): { next: CourseBoardState; id: string } {
  const id = formatId(state.nextSeq);
  const column = courseColumnOf(COURSE_INITIAL_STATE);

  const card: MockCourse = {
    id,
    name: draft.name,
    owner: draft.owner,
    light: 'BLUE',
    stalledDays: 0,
    state: COURSE_INITIAL_STATE,
    attrs: { ...fallbackAttrs(), type: draft.type, category: draft.category },
  };

  return {
    next: {
      ...state,
      stock: column ? { ...state.stock, [column]: (state.stock[column] ?? 0) + 1 } : state.stock,
      // 新卡插在第一列最前面：运营刚建完就要在原地看到它，翻到列尾找等于没有反馈
      cards: [card, ...state.cards],
      logs: {
        ...state.logs,
        [id]: [
          {
            at: now,
            text: COURSE_STATE_LOG_TEMPLATE.replace('{from}', '—').replace(
              '{to}',
              COURSE_INITIAL_STATE,
            ),
          },
        ],
      },
      nextSeq: state.nextSeq + 1,
    },
    id,
  };
}
