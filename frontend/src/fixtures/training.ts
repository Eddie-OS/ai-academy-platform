/**
 * P05 培训运营地图的冻结数据（《设计文档 V2.0》第 9 章）。
 *
 * <h3>逐条替换清单（业务已裁决，八条全 a）</h3>
 *
 * | V2.0 原值 | 替换为 | 依据 |
 * |---|---|---|
 * | 月历卡「进行中／待开始」 | 「已开课／待开课」 | 场次状态机只有 待开课／已开课／已结束／已归档（5.8）；11.8 颜色也按这四值 |
 * | KPI 六名照抄 | 回归保留六名；产品改五张 | 产品卡：累计计划／场次／人次、本月人次、已归档，均带月度环比 |
 * | R6 区域名「培训计划列表」却列场次字段 | 行按场次、第一列挂所属计划名 | 「必须照抄」列宽不动；标题仍写设计稿原文 |
 * | 详情五个页签 | 五个都渲染 | 需求 P4-4 把参训与签到合并，设计稿拆开——几何照抄，默认停在基本信息 |
 * | 导入结果「成功／重复／未匹配」 | 「写入／覆盖更新／自动补入」 | 14.4：同工号覆盖更新、不在名单则自动补入；「未匹配」不是合法结果分类 |
 * | 月／周／日切换 | 三视图都重排 | 设计稿验收句要求；11.8 只有月／周，日视图是设计稿多出来的一钮 |
 * | 详情底部运营引导 | 两种模式都渲染 | 新建培训计划是一期合法动作，不是 N6 禁区 |
 * | 「线上直播」 | 「线上」 | 培训形式枚举只有 线下／线上／混合（11.4 字段 9） |
 *
 * <h3>签到圆环 57% = 32 ÷ 56</h3>
 *
 * 设计稿冻结了完成率、已签到、应签到三个数，三者自洽。
 * 未签到 = 56 − 32 = 24，不需要设计稿另给。
 */

import { withCurrentDates } from './fixtureClock';

/** R3 六张 KPI。回归模式照抄 V2.0；产品模式改走 {@link TRAINING_PRODUCT_KPIS}。 */
export const TRAINING_KPIS = [
  { id: 'monthPlans', label: '本月培训计划数', value: '128', delta: '↑ 18.2%', period: '较上月', icon: 'CalendarDays' },
  { id: 'weekPlans', label: '本周培训计划数', value: '32', delta: '↑ 12.5%', period: '较上周', icon: 'Briefcase' },
  { id: 'runningSessions', label: '进行中培训场次', value: '18', delta: '↑ 5.6%', period: '较上周', icon: 'Video' },
  { id: 'monthAttendees', label: '本月参训人次', value: '1,236', delta: '↑ 9.4%', period: '较上月', icon: 'Users' },
  /* 下降用危险色：待办变少是好事，但环比箭头朝下仍按「数值下降」着色，与总看板一致 */
  { id: 'pendingAttendance', label: '待导入签到', value: '86', delta: '↓ 3.2%', period: '较上周', icon: 'FileInput', down: true },
  { id: 'pendingArchive', label: '待归档', value: '42', delta: '↓ 6.1%', period: '较上周', icon: 'FolderOpen', down: true },
] as const;

/**
 * 产品模式五张 KPI。卡名与口径来自业务当场表：四张累计、一张当月，都带月度环比。
 *
 * <p>{@code id} 与 {@code GET /api/metrics/quantity/trainings} 的 key 对齐。
 * 冻数只给演示站用；产品构建走接口，环比用上月末存量（累计）／上月同口径（当月）算。
 */
export const TRAINING_PRODUCT_KPIS = [
  { id: 'plans', label: '累计培训计划数', value: '128', deltaPercent: 18.2, icon: 'CalendarDays' },
  { id: 'sessions', label: '累计培训场次', value: '356', deltaPercent: 12.5, icon: 'Video' },
  { id: 'attendeesTotal', label: '累计参训人次', value: '8,640', deltaPercent: 9.4, icon: 'Users' },
  { id: 'attendees', label: '本月参训人次', value: '1,236', deltaPercent: 5.6, icon: 'UserCheck' },
  { id: 'archived', label: '已归档', value: '214', deltaPercent: 6.1, icon: 'FolderOpen' },
] as const;

/** R4 工具条：视图切换 + 筛选。全部未选中态（文档 0.3） */
export const TRAINING_VIEWS = ['月', '周', '日'] as const;
export type TrainingView = (typeof TRAINING_VIEWS)[number];
export const TRAINING_DEFAULT_VIEW: TrainingView = '月';

export const TRAINING_FILTERS = [
  { id: 'planState', label: '计划状态', value: '全部' },
  { id: 'sessionState', label: '场次状态', value: '全部' },
  { id: 'owner', label: '负责人', value: '全部' },
  { id: 'domain', label: '所属领域', value: '全部' },
] as const;

/** 产品模式三张筛选项。取值来自元数据；这里只冻标签。 */
export const TRAINING_PRODUCT_FILTERS = [
  { id: 'planState', label: '培训计划状态' },
  { id: 'sessionState', label: '场次授课状态' },
  { id: 'archived', label: '培训归档状态' },
] as const;

/** 归档筛的两值。标签放 fixtures，页面只渲染不下判断（STK-1）。 */
export const TRAINING_ARCHIVE_FILTERS = [
  { value: 'true', label: '已归档' },
  { value: 'false', label: '未归档' },
] as const;

/** 场次状态四值。色板与 11.8「按场次状态着色」对齐 */
export type SessionState = '待开课' | '已开课' | '已结束' | '已归档';

export function sessionMatchesArchive(state: SessionState, archived: boolean): boolean {
  return archived === (state === '已归档');
}

export interface CalendarSession {
  id: string;
  /** 日历格子上的短名 */
  title: string;
  /** 开始时刻 HH:mm */
  time: string;
  /** 形式 + 讲师，如「线上 · 李明」 */
  meta: string;
  /** 培训课程名称。没有则退回 {@link title} */
  courseName?: string;
  /** 授课讲师。没有则从 meta 里拆 */
  lecturer?: string;
  /** 课程介绍。日视图用 */
  intro?: string;
  /** 真实授课日 YYYY-MM-DD。有则按日期挂格，没有则按相对日号（回归冻数） */
  date?: string;
  state: SessionState;
  /** 所属日，1～31 */
  day: number;
  /** 相对当前月的偏移：0 本月（缺省）、-1 上月尾巴 */
  monthOffset?: number;
  /** 上月尾巴挂在第几个补白格（0 起）。上月天数逐月不同，用格位定位比用日号稳 */
  prevWeekday?: number;
}

/**
 * 月历上的场次，按「当月第几天」记，不写死年月。
 *
 * <p>日号是相对的：回归模式下当月是 2026-08，产品模式下就是真实当月，
 * 同一批数据两种模式都能铺满格子，不会出现「打开是空月历」。
 *
 * <p>文档只冻结了默认场次与「今日提醒」三条；其余是为版式补的占位。
 * <b>状态值一个都没编</b>——只用四值合法枚举。
 */
export const CALENDAR_SESSIONS: CalendarSession[] = [
  { id: 'JH-PREV-01', title: '项目管理进阶', time: '09:00', meta: '线上 · 李明', state: '已开课', day: 0, monthOffset: -1, prevWeekday: 0 },
  { id: 'JH-PREV-02', title: '数据分析实战', time: '13:30', meta: '线下 · 王芳', state: '已结束', day: 0, monthOffset: -1, prevWeekday: 0 },
  { id: 'JH-D01-01', title: 'AI基础入门', time: '09:30', meta: '线上 · 张伟', state: '待开课', day: 1 },
  { id: 'JH-D02-01', title: '沟通表达技巧', time: '14:00', meta: '线下 · 刘洋', state: '已开课', day: 2 },
  { id: 'JH-D03-01', title: '领导力提升', time: '09:00', meta: '线下 · 陈晨', state: '待开课', day: 3 },
  { id: 'JH-D03-02', title: '跨部门协作', time: '13:00', meta: '线上 · 李明', state: '待开课', day: 3 },
  { id: 'JH-D03-03', title: '演讲与表达', time: '15:30', meta: '线下 · 王芳', state: '已开课', day: 3 },
  { id: 'JH-D06-01', title: '产品思维训练营', time: '09:00', meta: '线上 · 王芳', state: '待开课', day: 6 },
  { id: 'JH-D07-01', title: 'Excel高效应用', time: '14:00', meta: '线上 · 李明', state: '已开课', day: 7 },
  { id: 'JH-D08-01', title: '数据可视化', time: '09:30', meta: '线下 · 张伟', state: '已结束', day: 8 },
  { id: 'JH-D09-01', title: '商务谈判技巧', time: '09:00', meta: '线下 · 刘洋', state: '已开课', day: 9 },
  { id: 'JH2026080005-02', title: 'AI工具实战', time: '14:00', meta: '线上 · 陈晨', state: '待开课', day: 9 },
  { id: 'JH-D09-03', title: '数据分析实战', time: '16:30', meta: '混合 · 黄悦', state: '待开课', day: 9 },
  { id: 'JH-D10-01', title: 'OKR目标管理', time: '09:30', meta: '线上 · 王芳', state: '待开课', day: 10 },
  { id: 'JH-D13-01', title: '用户体验设计', time: '09:00', meta: '线下 · 张伟', state: '待开课', day: 13 },
  { id: 'JH-D14-01', title: '时间管理', time: '14:00', meta: '线上 · 李明', state: '待开课', day: 14 },
  { id: 'JH-D15-01', title: '团队协作工作坊', time: '09:30', meta: '线下 · 刘洋', state: '待开课', day: 15 },
  { id: 'JH-D16-01', title: 'AI应用高级班', time: '09:00', meta: '线上 · 陈晨', state: '已开课', day: 16 },
  { id: 'JH-D16-02', title: 'Prompt 进阶', time: '14:00', meta: '线上 · 周建', state: '待开课', day: 16 },
  { id: 'JH-D17-01', title: '数据治理实践', time: '14:00', meta: '线下 · 王芳', state: '已开课', day: 17 },
];

export interface TrainingCalendarAnchor {
  year: number;
  month: number;
  /** 今天是几号；不在当月时由调用方置 null */
  today: number;
  selectedDay: number;
}

/**
 * 月历锚点。
 *
 * <p>回归模式冻结在 2026-08，选中 9 日——文档 0.3 禁止把快照钉在「今天」。
 * 产品模式反过来必须落在真实当月，否则运营打开就是一张过期月历。
 * 两条分支共用同一批场次数据（日号是相对的），只有年月与今天不同。
 */
export function resolveTrainingCalendar(now: Date = new Date()): TrainingCalendarAnchor {
  if (typeof document !== 'undefined' && document.documentElement.hasAttribute('data-regression')) {
    return { year: 2026, month: 8, today: 4, selectedDay: 9 };
  }
  return {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    today: now.getDate(),
    selectedDay: now.getDate(),
  };
}

export const TRAINING_SELECTED_SESSION_ID = 'JH2026080005-02';

/** R6 计划列表（行按场次）。列宽标注「必须照抄」，合计 814 */
export const PLAN_LIST_COLUMNS = [
  { id: 'planName', label: '计划名称', width: 155 },
  { id: 'session', label: '场次', width: 110 },
  { id: 'course', label: '课程名称', width: 140 },
  { id: 'lecturer', label: '讲师', width: 75 },
  { id: 'date', label: '计划日期', width: 120 },
  { id: 'attendance', label: '签到', width: 90 },
  { id: 'feedback', label: '反馈', width: 75 },
  { id: 'action', label: '操作', width: 49 },
] as const;

/** 签到列前缀。只说导入进度，不改「签到」这个列名的口径 */
export const ATTENDANCE_LABELS = {
  done: '已完成',
  pending: '待导入',
} as const;

export interface PlanListRow {
  id: string;
  planName: string;
  /** 场次短标签，如「第5期-第2场」 */
  sessionLabel: string;
  course: string;
  lecturer: string;
  date: string;
  signed: number;
  expected: number;
  /** 学员反馈均分；尚无反馈时 null → 界面「—」 */
  feedback: string | null;
}

export const PLAN_LIST_ROWS: PlanListRow[] = withCurrentDates([
  {
    id: 'JH2026080005-02',
    planName: 'AI工具实战营 第5期',
    sessionLabel: '第5期-第2场',
    course: 'AI工具实战',
    lecturer: '陈晨',
    date: '2026-08-09',
    signed: 32,
    expected: 56,
    feedback: '4.6',
  },
  {
    id: 'JH-D09-01',
    planName: '商务谈判技巧特训',
    sessionLabel: '第1期-第1场',
    course: '商务谈判技巧',
    lecturer: '刘洋',
    date: '2026-08-09',
    signed: 28,
    expected: 40,
    feedback: '4.4',
  },
  {
    id: 'JH-D06-01',
    planName: '产品思维训练营',
    sessionLabel: '第3期-第1场',
    course: '产品思维训练营',
    lecturer: '王芳',
    date: '2026-08-06',
    signed: 45,
    expected: 48,
    feedback: '4.8',
  },
  {
    id: 'JH-D07-01',
    planName: 'Excel高效应用班',
    sessionLabel: '第2期-第3场',
    course: 'Excel高效应用',
    lecturer: '李明',
    date: '2026-08-07',
    signed: 36,
    expected: 36,
    feedback: '4.7',
  },
]);

export const PLAN_LIST_TOTAL = 42;

export const TRAINING_DETAIL_TABS = [
  '基本信息',
  '参训人员',
  '签到记录',
  '培训归档',
  '学员反馈',
] as const;

/** 产品模式培训详情五子页（规格：与新建培训计划字段同一套基本信息） */
export const TRAINING_PRODUCT_DETAIL_TABS = [
  '基本信息',
  '培训场次记录',
  '参训学员',
  '培训归档',
  '学员反馈',
] as const;

export const TRAINING_DETAIL_ACTIVE_TAB = 0;

/** 默认场次详情（文档 9「冻结数据与默认详情」） */
export const TRAINING_DETAIL = withCurrentDates({
  title: 'AI工具实战营 第5期-第2场',
  state: '待开课' as SessionState,
  fields: [
    { label: '所属计划', value: 'AI工具实战营 第5期' },
    { label: '关联课程', value: 'AI工具实战' },
    { label: '授课讲师', value: '陈晨' },
    { label: '培训日期', value: '2026-08-09（周日）' },
    { label: '时间', value: '14:00～17:00' },
    { label: '培训形式', value: '线上' },
    { label: '线上链接', value: 'https://live.example.com/ai-tools-05' },
    { label: '计划人数', value: '56' },
    { label: '实际签到', value: '32' },
  ],
  /** 签到完成率。32÷56 ≈ 57.14%，设计稿写 57% */
  attendanceRate: 57,
  signed: 32,
  expected: 56,
  unsigned: 24,
  /**
   * 最近一次签到导入的结果摘要。
   * 三词都能在 14.4 找到出处：写入＝新落库、覆盖更新＝同工号覆盖、自动补入＝不在名单则补入。
   */
  importResult: [
    { label: '写入', value: 32 },
    { label: '覆盖更新', value: 2 },
    { label: '自动补入', value: 4 },
  ],
} as const);

/** 今日提醒三条（文档 9）。状态已换成合法值 */
export const TODAY_REMINDERS = [
  { time: '09:00', title: '商务谈判技巧', state: '已开课' as SessionState },
  { time: '14:00', title: 'AI工具实战', state: '待开课' as SessionState },
  { time: '16:30', title: '数据分析实战', state: '待开课' as SessionState },
] as const;

/** 详情底部运营引导。两种模式都渲染（裁决 bottom_cta=a） */
export const TRAINING_CTA = {
  title: '高效运营，从每一次培训开始',
  body: '合理规划培训计划，实时跟踪执行进度，让每一份投入都产生价值。',
  action: '新建培训计划',
} as const;
