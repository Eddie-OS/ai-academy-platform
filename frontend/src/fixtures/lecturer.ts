/**
 * P04 讲师与能力地图的冻结数据（《设计文档 V2.0》第 8 章）。
 *
 * <h3>逐条替换清单（业务已裁决）</h3>
 *
 * | V2.0 原值 | 替换为 | 依据 |
 * |---|---|---|
 * | 试讲结论「通过／未通过」 | 「合格／不合格」 | 转换表 5.6 第 52～53 行与需求 9.7.1 只有这两个值。`未通过` 一个字都不出现在任何状态机里 |
 * | 试讲结论「条件通过」 | 「不合格」 | 需求 N2、5.5、9.6.1 三处明写「不支持有条件通过」。设计稿里它成对出现（讲师结论与课程结论同为条件通过），一起换成不合格后「结论一致」列不受影响 |
 * | 台账列「运营结论」 | 「课程结论」 | 需求 9.7.1 字段 8 叫「课程试讲结论」。`运营结论` 会被读成「运营的意见」，实际是课程侧的结论；全称 105px 放不下 |
 * | 台账列「是否一致」 | 「结论一致」 | 对应字段是布尔「结论不一致标记」（9.7.1 字段 10），不是一个可选是／否的问题 |
 * | 讲师卡「信誉度 92%」 | 「学员人次」 | 需求 10.3 的 15 个讲师字段里<b>没有</b>任何形如信誉度／好评率的百分比，N6 又排除了讲师能力评估模型。换成合法字段 12「累计学员人次」，进度条按本组最高值归一 —— 归一是纯展示换算，不是新指标 |
 * | KPI「平均学员评分」 | 「讲师平均评分」 | 需求 15.3 指标 3 的官方名。`平均学员评分` 在需求全文里不存在 |
 * | 刘洋卡上的「条件通过」徽章 | 培养状态「培养中」 | 徽章位置需要一个合法语义。同时刘洋的试讲合格标记改为「否」—— 他那轮是不合格 |
 * | 详情「讲师成长建议」区块 | 仅回归模式渲染 | N6 与需求 10.1：讲师能力地图与培养建议随二期上线。口径与 V-8（P06 组织覆盖区）完全一致 |
 * | 时间线「评审人」 | 「参与人」 | 试讲记录上的字段是 participants（TrialLedgerRow），一期没有「评审人」这个字段 |
 * | 授课记录列「班次」 | 「场次」 | 命名对照表：培训场次 = trainingSession，不用 class／batch |
 *
 * <h3>三个分组的人数合计 308，而讲师池是 1,268 人</h3>
 *
 * 文档只冻结了三个领域分组的人数（128／96／84）与池子总人数。差额在其余擅长领域里 ——
 * 区域高 484px 只放得下两组展开 + 一组折叠，<b>两个数不相等是对的</b>。
 */

/** R3 四张 KPI。四个标签都能在需求 15.1／15.3 里查到原名 */
export const LECTURER_KPIS = [
  { id: 'poolSize', label: '讲师池人数', value: '1,268', delta: '↑ 12.5%', icon: 'Users' },
  { id: 'qualified', label: '试讲合格讲师数', value: '842', delta: '↑ 8.3%', icon: 'BadgeCheck' },
  { id: 'monthlyAttendees', label: '本月授课人次', value: '1,236', delta: '↑ 14.7%', icon: 'MonitorPlay' },
  /* 4.68 /5：设计规范 3.3 的评分写法。环比 ↑ 0.21 是分差而不是百分比，
     所以这一张的 delta 不带 % —— 把它写成 21% 会读成评分涨了两成 */
  { id: 'avgScore', label: '讲师平均评分', value: '4.68', unit: '/ 5', delta: '↑ 0.21', icon: 'Star' },
] as const;

/**
 * R4 筛选器一行六个。取需求 10.7 P3-1 定的筛选条件。
 *
 * <p>全部未选中态：文档 0.3 禁止 fixture 随当前时间或交互变化。
 */
export const LECTURER_FILTERS = [
  { id: 'expertise', label: '擅长领域', value: '全部' },
  { id: 'sourceDept', label: '来源部门', value: '全部' },
  { id: 'trialQualified', label: '试讲合格标记', value: '全部' },
  { id: 'teachingCount', label: '授课次数', value: '全部' },
] as const;

export interface LecturerCard {
  /** 讲师ID。需求 10.3 字段 1：JS + 4 位流水 */
  id: string;
  name: string;
  /** 来源部门。V1.2 起是自由文本，不再挂组织架构（禁区第 12 项） */
  dept: string;
  /** 擅长领域，多选。卡片只放前两个 */
  domains: string[];
  /** 试讲合格标记（需求 10.3 字段 9），布尔 */
  trialQualified: boolean;
  /** 培养状态。仅在需要提示「合格标记为否但仍在培养中」时给值 */
  cultivationStatus?: string;
  /** 累计授课次数（字段 11） */
  teachingCount: number;
  /** 平均评分（字段 13）。1.0–5.0，1 位小数；R10：仅正式培训反馈，试讲不计入 */
  avgScore: string;
  /** 累计学员人次（字段 12）。进度条按 GROUP_ATTENDEE_MAX 归一 */
  attendees: number;
}

export interface LecturerGroup {
  id: string;
  /** 擅长领域名。作战单元字典里的值 */
  domain: string;
  /** 该领域的讲师数（文档 8「冻结数据」），不等于本组渲染的卡片数 */
  count: number;
  expanded: boolean;
  cards: LecturerCard[];
}

/**
 * 讲师卡的第三行取「累计学员人次」，进度条按这个值归一。
 *
 * <p>取 3200 而不是本组最大值：按本组最大值归一时，每组都必然有一张 100% 的满格卡 ——
 * 读起来像「这个人达标了」，而它其实只表示「他是本组最多的」。
 * 固定基准让八张卡的条长可以横向比较。
 */
export const ATTENDEE_SCALE = 3200;

export const LECTURER_GROUPS: LecturerGroup[] = [
  {
    id: 'ai-basics',
    domain: '人工智能基础',
    count: 128,
    expanded: true,
    cards: [
      {
        id: 'JS0431',
        name: '李玥',
        dept: 'AI研究院',
        domains: ['机器学习', '深度学习'],
        trialQualified: true,
        teachingCount: 32,
        avgScore: '4.86',
        attendees: 2944,
      },
      {
        id: 'JS0387',
        name: '王宇',
        dept: '算法研发部',
        domains: ['深度学习', '大模型'],
        trialQualified: true,
        teachingCount: 28,
        avgScore: '4.72',
        attendees: 2816,
      },
      {
        id: 'JS0356',
        name: '张伟',
        dept: '数据智能部',
        domains: ['机器学习', '数据挖掘'],
        trialQualified: true,
        teachingCount: 21,
        avgScore: '4.65',
        attendees: 2688,
      },
      {
        /* 设计稿给刘洋挂了一枚「条件通过」徽章。那个结论不存在，他那轮就是不合格，
           所以合格标记改为否；徽章位置换成培养状态 —— 不合格但仍在培养中是常态 */
        id: 'JS0402',
        name: '刘洋',
        dept: 'AI应用部',
        domains: ['自然语言处理', '大模型'],
        trialQualified: false,
        cultivationStatus: '培养中',
        teachingCount: 15,
        avgScore: '4.32',
        attendees: 2432,
      },
    ],
  },
  {
    id: 'llm-apps',
    domain: '大模型应用',
    count: 96,
    expanded: true,
    cards: [
      {
        id: 'JS0418',
        name: '陈晨',
        dept: 'AI产品部',
        domains: ['Prompt工程', 'RAG'],
        trialQualified: true,
        teachingCount: 26,
        avgScore: '4.78',
        attendees: 2880,
      },
      {
        id: 'JS0395',
        name: '周建',
        dept: '解决方案部',
        domains: ['大模型应用', 'Agent'],
        trialQualified: true,
        teachingCount: 22,
        avgScore: '4.69',
        attendees: 2784,
      },
      {
        id: 'JS0374',
        name: '黄悦',
        dept: 'AI研究院',
        domains: ['大模型微调', '评估优化'],
        trialQualified: true,
        teachingCount: 18,
        avgScore: '4.61',
        attendees: 2656,
      },
      {
        id: 'JS0409',
        name: '吴迪',
        dept: 'AI应用部',
        domains: ['多模态', '大模型应用'],
        trialQualified: true,
        teachingCount: 12,
        avgScore: '4.28',
        attendees: 2304,
      },
    ],
  },
  {
    /* 文档 8「默认状态与交互」：这一组默认折叠。折叠组不渲染卡片，
       但人数照样显示 —— 它是本组的讲师数，与展开无关 */
    id: 'data-viz',
    domain: '数据分析与可视化',
    count: 84,
    expanded: false,
    cards: [],
  },
];

/** R5 头部的池子总人数。与 KPI「讲师池人数」同源同值 */
export const LECTURER_POOL_TOTAL = '1,268';

/** 文档 8：默认选中李玥 */
export const LECTURER_SELECTED_ID = 'JS0431';

/**
 * 试讲结论的两个合法取值（转换表 5.6 第 52～53 行、需求 9.7.1 字段 7／8）。
 *
 * <p>界面要按「是不是合格」着色，因此需要一个可比较的常量。放在 fixtures 里
 * 而不是页面里：fixtures 扮演的是后端响应，状态值在这里是载荷（见 stateLiteralGuard 的说明）。
 * 页面里写死 `=== '合格'` 才是 STK-1 要防的那件事。
 */
export const TRIAL_CONCLUSION_QUALIFIED = '合格';

export interface TrialLedgerRow {
  id: string;
  course: string;
  /** 轮次号 = 该课程已有记录数 + 1（转换表 5.6 第 52 行） */
  round: string;
  lecturer: string;
  /** 讲师试讲结论（9.7.1 字段 7）：合格／不合格 */
  lecturerConclusion: string;
  /** 课程试讲结论（9.7.1 字段 8）：合格／不合格 */
  courseConclusion: string;
  /** 评审日期。纯日期语义，无时分秒 */
  reviewedAt: string;
}

/**
 * R6 试讲台账最近 5 条。
 *
 * <p>「结论一致」不单独存字段：它是两个结论的比较结果，界面上按两列算出来。
 * 存一个第三列会出现「两列写了不合格／合格、第三列写着一致」的自相矛盾数据 ——
 * 需求 5.6 的四格矩阵本来就只要求<b>标记</b>不一致，不要求持久化一个冗余布尔。
 *
 * <p>五条全部一致。双结论不一致的样例在 P09 评审记录中心，那页有专门的红色风险提示。
 */
export const TRIAL_LEDGER: TrialLedgerRow[] = [
  {
    id: 'T-2405-09',
    course: '大模型应用开发实战',
    round: '第 2 轮',
    lecturer: '周建',
    lecturerConclusion: '合格',
    courseConclusion: '合格',
    reviewedAt: '2024-05-09',
  },
  {
    id: 'T-2405-08b',
    course: '数据分析与可视化',
    round: '第 1 轮',
    lecturer: '陈晨',
    lecturerConclusion: '不合格',
    courseConclusion: '不合格',
    reviewedAt: '2024-05-08',
  },
  {
    id: 'T-2405-08a',
    course: '机器学习算法精讲',
    round: '第 3 轮',
    lecturer: '李玥',
    lecturerConclusion: '合格',
    courseConclusion: '合格',
    reviewedAt: '2024-05-08',
  },
  {
    id: 'T-2405-07',
    course: 'RAG 检索增强实践',
    round: '第 1 轮',
    lecturer: '黄悦',
    lecturerConclusion: '不合格',
    courseConclusion: '不合格',
    reviewedAt: '2024-05-07',
  },
  {
    id: 'T-2405-06',
    course: 'Prompt 工程进阶',
    round: '第 2 轮',
    lecturer: '吴迪',
    lecturerConclusion: '不合格',
    courseConclusion: '不合格',
    reviewedAt: '2024-05-06',
  },
];

/**
 * R6 列宽（文档 8「内部几何」标注「必须照抄」）。
 *
 * 812px：课程 200｜轮次 90｜讲师 85｜讲师结论 105｜课程结论 105｜结论一致 90｜日期 90｜操作 47。
 * 合计 812，正好等于区域宽 —— 这是全文档少有的一组自洽的列宽，一个都不要动。
 */
export const TRIAL_LEDGER_COLUMNS = [
  { id: 'course', label: '课程名称', width: 200 },
  { id: 'round', label: '轮次', width: 90 },
  { id: 'lecturer', label: '讲师', width: 85 },
  { id: 'lecturerConclusion', label: '讲师结论', width: 105 },
  { id: 'courseConclusion', label: '课程结论', width: 105 },
  { id: 'consistent', label: '结论一致', width: 90 },
  { id: 'reviewedAt', label: '评审日期', width: 90 },
  { id: 'action', label: '操作', width: 47 },
] as const;

/** R7 详情四个页签。文档 8：默认停在「试讲记录」 */
export const LECTURER_DETAIL_TABS = ['基本信息', '试讲记录', '授课记录', '学员评价'] as const;
export const LECTURER_DETAIL_ACTIVE_TAB = 1;

/**
 * 详情头部的标签。文档 8：机器学习/深度学习/Python/数据挖掘/+2。
 *
 * <p>「+2」是折叠计数而不是第五个标签，所以单独一个字段 —— 写成 `'+ 2'` 塞进数组的话，
 * 它会被当成一个叫「+ 2」的擅长领域参与筛选。
 */
export const LECTURER_DETAIL_DOMAINS = ['机器学习', '深度学习', 'Python', '数据挖掘'] as const;
export const LECTURER_DETAIL_DOMAINS_MORE = 2;

/** 岗位。不是账号角色 —— 一期没有角色表（禁区第 11 项） */
export const LECTURER_DETAIL_TITLE = 'AI研究院 · 高级算法工程师';

export interface TrialTimelineItem {
  round: string;
  /** 试讲结论：合格／不合格 */
  conclusion: string;
  /** 专家意见（9.7.1）。设计稿把它标成「结论」，实际结论只有两个值 */
  opinion: string;
  /** 参与人（TrialLedgerRow.participants）。一期没有「评审人」这个字段 */
  participants: string;
  date: string;
}

/**
 * R7 试讲时间线。文档 8：2024-05-08 通过、2024-04-22 条件通过、2024-04-10 未通过。
 *
 * <p>三个结论词全部换成合法值。第 2 轮的「条件通过」→「不合格」后，
 * 三轮变成「不合格 → 不合格 → 合格」，而这正是需求 5.4.3 允许的形状：
 * 试讲子状态在 待试讲 ↔ 试讲中 之间来回，直到某一轮课程结论为合格才进「待发布」。
 */
export const TRIAL_TIMELINE: TrialTimelineItem[] = [
  {
    round: '第 3 轮',
    conclusion: '合格',
    opinion: '教学设计合理，表达清晰，互动良好，综合评分 4.8 / 5',
    participants: '张小北、周建、黄悦',
    date: '2024-05-08',
  },
  {
    round: '第 2 轮',
    conclusion: '不合格',
    opinion: '内容丰富，案例可加强，建议补充实操演示',
    participants: '陈晨、李华',
    date: '2024-04-22',
  },
  {
    round: '第 1 轮',
    conclusion: '不合格',
    opinion: '节奏偏快，需优化结构与案例引入',
    participants: '赵敏、王宇',
    date: '2024-04-10',
  },
];

export interface TeachingRecord {
  course: string;
  /** 培训场次。命名对照表：不用 class／batch */
  session: string;
  taughtOn: string;
  /** 本场平均评分（需求 10.5） */
  score: string;
}

/** R7「近期授课记录」三条。李玥的授课记录，评分与她的平均分 4.86 同一量级 */
export const TEACHING_RECORDS: TeachingRecord[] = [
  { course: '大模型原理与应用实战', session: '第 12 期', taughtOn: '2024-05-10', score: '4.86' },
  { course: '深度学习进阶实战', session: '第 9 期', taughtOn: '2024-04-28', score: '4.78' },
  { course: '机器学习算法精讲', session: '第 15 期', taughtOn: '2024-04-12', score: '4.81' },
];

/**
 * R7 底部的「讲师成长建议」。<b>仅回归模式渲染，产品模式整块隐藏。</b>
 *
 * <p>需求 N6 与 10.1：讲师层级、能力标签、熟练度、培养建议一期不做，随二期上线补齐。
 * 设计稿返修清单 §13 也已把它标为二期。
 *
 * <p>裁决口径与 V-8（P06 的组织覆盖区）一致：<b>按设计稿建区域、数据只用 fixture、
 * 产品模式不渲染</b>。留着回归模式是为了 R7 的 753px 版式能对上像素；
 * 产品模式渲染出来就成了「平台会给培养建议」的承诺，而它背后没有任何模型。
 */
export const GROWTH_ADVICE = {
  title: '讲师成长建议',
  body: '继续保持高质量授课表现，建议尝试开发进阶实战类课程，扩大影响力。',
  action: '查看建议详情',
} as const;
