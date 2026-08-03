/**
 * P05 培训运营地图的冻结数据（《设计文档 V2.0》第 9 章）。
 *
 * <h3>逐条替换清单（业务已裁决，八条全 a）</h3>
 *
 * | V2.0 原值 | 替换为 | 依据 |
 * |---|---|---|
 * | 月历卡「进行中／待开始」 | 「已开课／待开课」 | 场次状态机只有 待开课／已开课／已结束／已归档（5.8）；11.8 颜色也按这四值 |
 * | KPI 六名照抄 | 保留 V2.0 六名 | 「本周培训计划数」在需求 7.4 驾驶舱入口有出处；后两张是任务派生计数（13.1.2），不是 15.1 公式 |
 * | R6 区域名「培训计划列表」却列场次字段 | 行按场次、第一列挂所属计划名 | 「必须照抄」列宽不动；标题仍写设计稿原文 |
 * | 详情五个页签 | 五个都渲染 | 需求 P4-4 把参训与签到合并，设计稿拆开——几何照抄，默认停在基本信息 |
 * | 导入结果「成功／重复／未匹配」 | 「写入／覆盖更新／自动补入」 | 14.4：同工号覆盖更新、不在名单则自动补入；「未匹配」不是合法结果分类 |
 * | 月／周／日切换 | 三视图都重排 | 设计稿验收句要求；11.8 只有月／周，日视图是设计稿多出来的一钮 |
 * | 详情底部 A12 运营引导 | 两种模式都渲染 | 新建培训计划是一期合法动作，不是 N6 禁区 |
 * | 「线上直播」 | 「线上」 | 培训形式枚举只有 线下／线上／混合（11.4 字段 9） |
 *
 * <h3>签到圆环 57% = 32 ÷ 56</h3>
 *
 * 设计稿冻结了完成率、已签到、应签到三个数，三者自洽。
 * 未签到 = 56 − 32 = 24，不需要设计稿另给。
 */

/** R3 六张 KPI。前四张在需求 7.4／15.1 能查到；后两张是任务派生计数 */
export const TRAINING_KPIS = [
  { id: 'monthPlans', label: '本月培训计划数', value: '128', delta: '↑ 18.2%', period: '较上月', icon: 'CalendarDays' },
  { id: 'weekPlans', label: '本周培训计划数', value: '32', delta: '↑ 12.5%', period: '较上周', icon: 'Briefcase' },
  { id: 'runningSessions', label: '进行中培训场次', value: '18', delta: '↑ 5.6%', period: '较上周', icon: 'Video' },
  { id: 'monthAttendees', label: '本月参训人次', value: '1,236', delta: '↑ 9.4%', period: '较上月', icon: 'Users' },
  /* 下降用危险色：待办变少是好事，但环比箭头朝下仍按「数值下降」着色，与总看板一致 */
  { id: 'pendingAttendance', label: '待导入签到', value: '86', delta: '↓ 3.2%', period: '较上周', icon: 'FileInput', down: true },
  { id: 'pendingArchive', label: '待归档', value: '42', delta: '↓ 6.1%', period: '较上周', icon: 'FolderOpen', down: true },
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

/** 场次状态四值。色板与 11.8「按场次状态着色」对齐 */
export type SessionState = '待开课' | '已开课' | '已结束' | '已归档';

export interface CalendarSession {
  id: string;
  /** 日历格子上的短名 */
  title: string;
  /** 开始时刻 HH:mm */
  time: string;
  /** 形式 + 讲师，如「线上 · 李明」 */
  meta: string;
  state: SessionState;
  /** 所属日，1～31（2024-05） */
  day: number;
}

/**
 * 2024 年 5 月月历上的场次。
 *
 * <p>文档只冻结了默认场次与「今日提醒」三条；其余是为版式补的占位。
 * <b>状态值一个都没编</b>——只用四值合法枚举。
 */
export const CALENDAR_SESSIONS: CalendarSession[] = [
  { id: 'JH2024050001-01', title: '项目管理进阶', time: '09:00', meta: '线上 · 李明', state: '已开课', day: 6 },
  { id: 'JH2024050002-01', title: '数据分析实战', time: '14:00', meta: '线下 · 王芳', state: '待开课', day: 6 },
  { id: 'JH2024050003-01', title: '领导力修炼', time: '10:00', meta: '线下 · 赵强', state: '已结束', day: 7 },
  { id: 'JH2024050004-01', title: 'Prompt 工程入门', time: '15:00', meta: '线上 · 陈晨', state: '待开课', day: 8 },
  {
    id: 'JH2024050005-02',
    title: 'AI工具实战应用',
    time: '14:00',
    meta: '线上 · 李玥',
    state: '已开课',
    day: 9,
  },
  { id: 'JH2024050006-01', title: '商务谈判技巧', time: '09:00', meta: '线下 · 周建', state: '已开课', day: 9 },
  { id: 'JH2024050007-01', title: '数据分析实战', time: '16:30', meta: '混合 · 黄悦', state: '待开课', day: 9 },
  { id: 'JH2024050008-01', title: '信息安全意识', time: '10:00', meta: '线上 · 吴迪', state: '已归档', day: 10 },
  { id: 'JH2024050009-01', title: '大模型应用开发', time: '13:30', meta: '线下 · 张伟', state: '待开课', day: 13 },
  { id: 'JH2024050010-01', title: '时间管理与效率', time: '09:30', meta: '线上 · 刘洋', state: '已结束', day: 14 },
  { id: 'JH2024050011-01', title: 'RAG 实战工作坊', time: '14:00', meta: '线上 · 陈晨', state: '待开课', day: 15 },
  { id: 'JH2024050012-01', title: 'Python 数据处理', time: '10:00', meta: '线下 · 王宇', state: '已开课', day: 16 },
  { id: 'JH2024050013-01', title: 'Agent 构建实践', time: '15:00', meta: '线上 · 周建', state: '待开课', day: 20 },
  { id: 'JH2024050014-01', title: '学员画像分析', time: '09:00', meta: '混合 · 李玥', state: '待开课', day: 22 },
  { id: 'JH2024050015-01', title: '课程设计工作坊', time: '14:00', meta: '线下 · 赵强', state: '已结束', day: 27 },
];

export const TRAINING_CALENDAR = {
  year: 2024,
  month: 5,
  /** 默认选中 5 月 9 日（文档 9「冻结数据」） */
  selectedDay: 9,
  /** 上月尾巴：4 月有 30 天，5 月 1 日是周三 → 表头周一开始时前两格是 29、30 */
  prevMonthTail: [29, 30] as const,
} as const;

export const TRAINING_SELECTED_SESSION_ID = 'JH2024050005-02';

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

export const PLAN_LIST_ROWS: PlanListRow[] = [
  {
    id: 'JH2024050005-02',
    planName: 'AI工具实战营 第5期',
    sessionLabel: '第5期-第2场',
    course: 'AI工具实战应用',
    lecturer: '李玥',
    date: '2024-05-09',
    signed: 32,
    expected: 56,
    feedback: '4.6',
  },
  {
    id: 'JH2024050006-01',
    planName: '商务谈判技巧特训',
    sessionLabel: '第1期-第1场',
    course: '商务谈判技巧',
    lecturer: '周建',
    date: '2024-05-09',
    signed: 28,
    expected: 40,
    feedback: '4.4',
  },
  {
    id: 'JH2024050001-01',
    planName: '项目管理进阶班',
    sessionLabel: '第3期-第1场',
    course: '项目管理进阶',
    lecturer: '李明',
    date: '2024-05-06',
    signed: 45,
    expected: 48,
    feedback: '4.8',
  },
  {
    id: 'JH2024050003-01',
    planName: '领导力修炼营',
    sessionLabel: '第2期-第3场',
    course: '领导力修炼',
    lecturer: '赵强',
    date: '2024-05-07',
    signed: 36,
    expected: 36,
    feedback: '4.7',
  },
];

export const PLAN_LIST_TOTAL = 42;

export const TRAINING_DETAIL_TABS = [
  '基本信息',
  '参训人员',
  '签到记录',
  '培训归档',
  '学员反馈',
] as const;

export const TRAINING_DETAIL_ACTIVE_TAB = 0;

/** 默认场次详情（文档 9「冻结数据与默认详情」） */
export const TRAINING_DETAIL = {
  id: 'JH2024050005-02',
  title: 'AI工具实战营 第5期-第2场',
  state: '已开课' as SessionState,
  fields: [
    { label: '所属计划', value: 'AI工具实战营 第5期' },
    { label: '关联课程', value: 'AI工具实战应用' },
    { label: '授课讲师', value: '李玥' },
    { label: '培训日期', value: '2024-05-09（周四）' },
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
} as const;

/** 今日提醒三条（文档 9）。状态已换成合法值 */
export const TODAY_REMINDERS = [
  { time: '09:00', title: '商务谈判技巧', state: '已开课' as SessionState },
  { time: '14:00', title: 'AI工具实战应用', state: '已开课' as SessionState },
  { time: '16:30', title: '数据分析实战', state: '待开课' as SessionState },
] as const;

/** 详情底部 A12 运营引导。两种模式都渲染（裁决 bottom_cta=a） */
export const TRAINING_CTA = {
  title: '还没有合适的培训计划？',
  body: '按课程与面向人群新建一期，下属场次可随后拆排。',
  action: '新建培训计划',
} as const;
