/**
 * P01 总看板的冻结数据（《设计文档 V2.0》第 5 章）。
 *
 * <h3>冻结的含义</h3>
 *
 * 这些数字参与视觉回归基线，文档 0.3 明令「禁止按当前时间改变状态」。
 * 因此这里不出现 new Date()、不出现随机数、不做任何计算 —— 全是字面量。
 * 改动其中任何一个数字都会让 P01 的截图基线失效。
 *
 * <h3>四处标签替换（业务裁决 V-7）</h3>
 *
 * V2.0 的冻结数据里有 4 处状态机里不存在的取值。业务裁决是「fixtures 里替换为
 * 状态机的合法取值」。替换只动标签、<b>不动数字与数字的位置</b> ——
 * 数字宽度参与像素比对，挪一个数字就等于改基线。
 *
 * | V2.0 原值   | 替换为   | 依据                                                    |
 * |-------------|----------|---------------------------------------------------------|
 * | 待澄清 48   | 已评审   | 需求评审状态只有 待评审／评审中／已评审（N2 无「待澄清」）|
 * | 已下架 28   | 已关闭   | 课程「已下架」永久不做（N4）；主状态有「已关闭」        |
 * | 认证讲师 689 / 待认证 327 / 新加入 102 | 可上岗／培养中／待培养 | 讲师认证体系属禁区 F-1；培养状态是三值枚举 |
 * | 进行中 96   | 执行中   | 培训计划状态是「执行中」（返修清单第 8 项）            |
 *
 * <p><b>「已评审 48」看着偏小是替换的副作用，不是数据错。</b>原值 48 属于「待澄清」，
 * 换标签后落到了「已评审」头上。保留 48 是为了守住像素基线；真实数据接入后（阶段 3）
 * 这个数由指标接口给，不再有这个问题。
 */

import { ASSETS } from '@/shared/theme/designTokensV2';

/**
 * R3 六张 KPI。环比字符串含箭头，箭头是文本不是图标 —— 文档 0.3 禁止改写文案。
 *
 * <p>{@code id} 是给页面挂图标用的稳定键。不用中文标签当键有两个原因：
 * 指标名会随需求 15.x 的措辞调整，而「已发布课程」这类名字里含状态词「已发布」，
 * 拿它当页面里的字面量会撞上 STK-1 门禁。
 */
export const DASHBOARD_KPIS = [
  { id: 'demandTotal', label: '需求总数', value: '1,268', delta: '↑ 12.5%' },
  { id: 'courseTotal', label: '课程总数', value: '842', delta: '↑ 8.3%' },
  { id: 'coursePublished', label: '已发布课程', value: '512', delta: '↑ 14.7%' },
  { id: 'lecturerPool', label: '讲师池人数', value: '1,236', delta: '↑ 7.9%' },
  { id: 'trainingSession', label: '培训场次数', value: '328', delta: '↑ 20.1%' },
  { id: 'caseListed', label: '案例上架数', value: '186', delta: '↑ 10.4%' },
] as const;

/**
 * 环比的比较基准说明，六张 KPI 共用一句。
 *
 * <p>写死成一个常量而不是六份，是因为它必须与顶栏的日期区间是同一个口径：
 * 顶栏选的是 2024-05-12～2024-06-10，环比的对照期就是它往前推一个等长周期。
 * 六处各写一遍时，改口径必然漏改。
 */
export const DELTA_BASELINE_LABEL = '较上周期';

export interface EntryStat {
  label: string;
  value: string;
}

export interface DashboardEntry {
  /** 与 shellNav 的 pageKey 对齐，卡片点击跳该驾驶舱 */
  pageKey: string;
  title: string;
  /**
   * 标题右侧的总量徽章，取该驾驶舱对应的那张 KPI。
   *
   * <p>与 {@link DASHBOARD_KPIS} 里的值必须一致 —— 同一个数在一页里出现两次，
   * 对不上会直接被当成 bug。案例卡取 186（案例上架数），讲师卡取 1,236（讲师池人数）。
   */
  badge: string;
  path: string;
  illustration: string;
  /** 回归模式用的三数，逐字照抄 V2.0 文档 5「冻结数据」 */
  stats: EntryStat[];
  /**
   * 产品模式替换用的三数。只有案例卡需要。
   *
   * <p>V2.0 给案例卡的三数是「案例总数 186／覆盖组织 132／覆盖率 68%」，后两条属于
   * N18 已删除的组织覆盖口径 —— 一期不导入组织架构，覆盖率没有分母。业务裁决 V-8：
   * 按 V2.0 建区域、数据只来自 fixtures、产品模式不渲染。
   *
   * <p><b>做法是整组换掉，不是逐条过滤。</b>过滤剩一个数的卡片与另外四张三数卡并排，
   * 版式明显是坏的，而它「坏」的方式恰好长得像「另两个接口没通」，
   * 会引着后来的人去补一个按部门统计的接口，反把 N18 破了。
   * 换上的三条是案例状态机上游的三个合法主状态计数，与另外四张卡同一种口径。
   */
  productStats?: EntryStat[];
}

/**
 * R4 五张业务入口卡。素材映射按文档 5「素材映射」：A04/A06/A07/A12/A03。
 *
 * <p>标题用侧栏导航的同名口径（讲师与能力地图／培训运营地图／案例与组织覆盖图），
 * 而不是需求文档里的简称（讲师图／培训运营图／案例图）：这五张卡就是五个导航入口，
 * 卡上写一套名字、侧栏写另一套，会让人以为点进去是两个地方。
 */
export const DASHBOARD_ENTRIES: DashboardEntry[] = [
  {
    pageKey: 'requirement',
    title: 'AI需求图',
    badge: '1,268',
    path: '/demands',
    illustration: ASSETS.A04,
    stats: [
      { label: '待评审', value: '312' },
      { label: '评审中', value: '162' },
      { label: '已评审', value: '48' },
    ],
  },
  {
    pageKey: 'course',
    title: '课程工作台',
    badge: '842',
    path: '/courses',
    illustration: ASSETS.A06,
    stats: [
      { label: '开发中', value: '214' },
      { label: '待发布', value: '116' },
      { label: '已关闭', value: '28' },
    ],
  },
  {
    pageKey: 'instructor',
    title: '讲师与能力地图',
    badge: '1,236',
    path: '/lecturers',
    illustration: ASSETS.A07,
    stats: [
      { label: '可上岗', value: '689' },
      { label: '培养中', value: '327' },
      { label: '待培养', value: '102' },
    ],
  },
  {
    pageKey: 'training',
    title: '培训运营地图',
    badge: '328',
    path: '/trainings',
    illustration: ASSETS.A12,
    stats: [
      { label: '执行中', value: '96' },
      { label: '已完成', value: '180' },
      { label: '待执行', value: '52' },
    ],
  },
  {
    pageKey: 'case',
    title: '案例与组织覆盖图',
    badge: '186',
    path: '/cases',
    illustration: ASSETS.A03,
    stats: [
      { label: '案例总数', value: '186' },
      { label: '覆盖组织', value: '132' },
      { label: '覆盖率', value: '68%' },
    ],
    /*
     * 三个数都是案例状态机的合法主状态（需求 5.9 四值：待整理／整理中／待审核／已上架）。
     *
     * 没有列「已上架」：徽章上的 186 就是它（KPI「案例上架数」），另外四张卡的三数里
     * 也都不重复徽章那个数。数值是为版式补的占位，与看板上其他任何数不构成算术关系，
     * 阶段 3 指标接入后整批消失。
     */
    productStats: [
      { label: '待整理', value: '31' },
      { label: '整理中', value: '24' },
      { label: '待审核', value: '13' },
    ],
  },
];

/**
 * R5 三色灯预警，三张卡。
 *
 * <p>灯色语义按业务重新裁决的口径（V-9）：蓝=正常运行、黄=需要关注、
 * 红=已逾期或状态停滞。这与需求 13.4.1a 的原文不同，理由写在 designTokens 的 warningLight 上。
 *
 * <p><b>没有第四张「健康对象数」卡。</b>蓝灯本身就是健康态，两者讲的是同一件事，
 * 并排放会让人以为是两个不同的数（V-11 因此关闭，倒推的 2,133 作废）。
 */
export const DASHBOARD_WARNINGS = [
  {
    color: 'BLUE' as const,
    count: 128,
    caption: '距预计完成时间 3 天以上',
    /*
     * 示例对象不是文档冻结数据，是为了让这张卡自己把话说完而补的。
     * 只给「128」的话，运营得点进明细页才知道里面装的是需求还是课程。
     * 对象编号沿用 14.1 待办清单的命名格式（类型-四位序号），阶段 3 接真实数据后整批消失。
     */
    samples: [
      { id: 'AI需求-1245', type: '需求' },
      { id: '课程-0892', type: '课程' },
      { id: '培训场次-0377', type: '培训' },
    ],
  },
  {
    color: 'YELLOW' as const,
    count: 26,
    caption: '距预计完成时间 3 天内',
    samples: [
      { id: 'AI需求-1122', type: '需求' },
      { id: '课程-0678', type: '课程' },
      { id: '案例-0151', type: '案例' },
    ],
  },
  {
    color: 'RED' as const,
    count: 9,
    // 红灯这一格聚合两种成因，副文案必须把两种都说出来，
    // 否则运营会以为停滞的对象没算进这个 9，去别处找第二个数
    caption: '已超期或连续 5 天未变更',
    samples: [
      { id: 'AI需求-0987', type: '需求' },
      { id: '课程-0458', type: '课程' },
      { id: '案例-0188', type: '案例' },
    ],
  },
];

/**
 * 「更多（N）」里的 N = 该灯色对象总数 − 卡上已列出的样例数。
 *
 * <p>算出来而不是写死：写死的话改样例条数就会让 N 与实际差几条，
 * 而差几条这种错在界面上完全看不出来。
 */
export function warningMoreCount(count: number, sampleCount: number): number {
  return count - sampleCount;
}

/** R5 面板头部右侧的链接文案。规则说明指向配置中心的三色灯阈值 Tab */
export const WARNING_RULE_LINK = '规则说明';

export interface WorklistRow {
  id: string;
  owner: string;
  object: string;
  node: string;
  deadline: string;
  remainingDays: number;
  light: 'BLUE' | 'YELLOW' | 'RED' | 'NONE';
  /**
   * 红灯的成因。红灯合并了「已逾期」与「状态停滞」，不说成因就没法出文案。
   * 非红灯行不带这个字段。
   */
  lightReason?: 'OVERDUE' | 'STALLED';
}

/**
 * R6 待办行动清单，五行取自文档 14.1「总看板待办行动清单」。
 *
 * <h3>灯色全部照抄文档，一处未改</h3>
 *
 * 业务把灯色口径改成「蓝=正常运行、黄=需要关注、红=已逾期或停滞」之后，
 * 文档 14.1 这五行反而全部自洽了：王芳「剩余 5 天 + 黄灯」正是「需要关注」，
 * 张伟 8 天与刘洋 10 天的蓝灯正是「正常运行」。
 * 按需求 13.4.1a 的旧口径读时，王芳那行是「已逾期」配「剩余 5 天」的矛盾组合。
 *
 * <h3>两处红灯按「状态停滞」解释</h3>
 *
 * 李明剩余 2 天、陈晨剩余 0 天，都还没到期，所以红灯的成因只能是状态停滞
 * 而不是逾期。停滞天数从 {@code last_state_changed_at} 起算，与剩余天数无关，
 * 文档没冻结这个数 —— 好在预警灯列不显示天数（天数在左边的独立列），因此不需要编。
 *
 * <h3>唯一的改动：第 5 行的对象名</h3>
 *
 * 「讲师认证-067／材料审核」→「讲师-067／入池评审」。讲师认证体系属一期禁区 F-1，
 * 平台里没有「认证」这件事，讲师走的是入池评审 + 培养状态。
 * 留着「讲师认证」会让人以为有一套认证流程只是还没做（V-10）。
 */

export const DASHBOARD_WORKLIST: WorklistRow[] = [
  {
    id: 'W1',
    owner: '李明',
    object: 'AI需求-0987',
    node: '评审中',
    deadline: '2024-06-12',
    remainingDays: 2,
    light: 'RED',
    lightReason: 'STALLED',
  },
  {
    id: 'W2',
    owner: '王芳',
    object: '课程-0456',
    node: '课程开发中',
    deadline: '2024-06-15',
    remainingDays: 5,
    light: 'YELLOW',
  },
  {
    id: 'W3',
    owner: '张伟',
    object: '培训场次-0321',
    node: '执行准备',
    deadline: '2024-06-18',
    remainingDays: 8,
    light: 'BLUE',
  },
  {
    id: 'W4',
    owner: '陈晨',
    object: '案例-0188',
    node: '内容完善',
    deadline: '2024-06-10',
    remainingDays: 0,
    light: 'RED',
    lightReason: 'STALLED',
  },
  {
    id: 'W5',
    owner: '刘洋',
    object: '讲师-067',
    node: '入池评审',
    deadline: '2024-06-20',
    remainingDays: 10,
    light: 'BLUE',
  },
];

/**
 * R7 效率指标四条折线。
 *
 * <p>序列取文档 14.2 的冻结数值表，终点值与「冻结数据」段的四个指标一致：
 * 评审周期 5.6 天、开发周期 28.3 天、一次通过率 71.2%、案例上架周期 15.8 天。
 *
 * <p>注意开发周期序列的第 7 点是 14、终点回到 28.3 —— 这个折返是文档给的原值，
 * 不是笔误，不要「顺手抹平」。
 */
/**
 * 八个采样点的横轴标签，四条折线共用。
 *
 * <p>覆盖顶栏的日期区间 2024-05-12～2024-06-10（文档 5「默认状态与交互」定死），
 * 八点约每四天一个。<b>不按今天生成</b>：文档 0.3 与 15.1 都写明「不得使用今天」。
 */
export const EFFICIENCY_X_LABELS = [
  '05-12',
  '05-16',
  '05-20',
  '05-24',
  '05-28',
  '06-02',
  '06-06',
  '06-10',
] as const;

export const DASHBOARD_EFFICIENCY = [
  {
    label: '需求平均评审周期',
    display: '5.6 天',
    series: [6.2, 8.1, 10.4, 7.3, 5.9, 5.4, 4.2, 5.6],
    /*
     * 环比的量级取自设计稿，方向按指标语义定，不照抄设计稿的箭头。
     *
     * 周期类指标「越小越好」：评审周期从 6.2 天降到 5.6 天是改善，箭头必须朝下。
     * 设计稿把四张卡的箭头画成了同一个方向并统一涂绿，那样「开发周期变长」
     * 也会显示成绿色向好 —— 三色灯之外唯一带方向的视觉元素指错方向，
     * 比不显示环比更糟。
     */
    delta: '8.6%',
    betterWhen: 'lower' as const,
    /** 纵轴刻度。三档就够：807px 里塞四张图，五档标签会挤成一片 */
    axisTicks: [0, 6, 12],
    axisUnit: '天',
  },
  {
    label: '课程平均开发周期',
    display: '28.3 天',
    series: [42, 31, 25, 29, 28, 27, 14, 28.3],
    delta: '6.2%',
    betterWhen: 'lower' as const,
    axisTicks: [0, 30, 60],
    axisUnit: '天',
  },
  {
    label: '一次评审通过率',
    display: '71.2%',
    series: [52, 55, 62, 68, 70, 66, 58, 71.2],
    // 通过率是唯一「越大越好」的一条，所以只有它的箭头朝上
    delta: '9.7%',
    betterWhen: 'higher' as const,
    axisTicks: [0, 50, 100],
    axisUnit: '%',
  },
  {
    label: '案例平均上架周期',
    display: '15.8 天',
    series: [18, 14, 12, 10, 11, 8, 7, 15.8],
    delta: '5.3%',
    betterWhen: 'lower' as const,
    axisTicks: [0, 15, 30],
    axisUnit: '天',
  },
] as const;

/**
 * R8 业务价值。需求第 7 章为人工填报，一期没有计算口径。
 *
 * <p>{@code tone} 只影响图标底色与数值颜色，三条各用一色是为了在 239px 宽的窄卡里
 * 让三行一眼可分；它<b>不表示好坏</b> —— 四个语义色不得挪用（WV4）。
 *
 * <p>前两条带「↑」，第三条是金额不带箭头：成本节约本身已经是节约额，
 * 再加一个向上箭头会读成「成本上升」。
 */
export const DASHBOARD_VALUE = [
  { id: 'efficiency', label: '效率提升', value: '18.7%', trend: '↑', tone: 'blue' as const },
  { id: 'quality', label: '质量改善', value: '12.4%', trend: '↑', tone: 'violet' as const },
  { id: 'cost', label: '成本节约', value: '¥128.6万', trend: null, tone: 'amber' as const },
] as const;

/**
 * R8 的口径说明，必须显示在面板标题旁。
 *
 * <p>这三个数是<b>运营手工填报</b>的（需求第 7 章），不是平台算出来的。
 * 不标注来源的话，它们和左边四个由 SQL 算出来的效率指标看起来一模一样，
 * 而后者可复核、前者不可。
 */
export const VALUE_SOURCE_NOTE = '（人工填报）';

/** R9 欢迎卡。两行副文案，措辞避开状态字面量（见页面里的说明） */
export const WELCOME_LINES = [
  '数据统计截止 2024-06-10，共 12 项待办需要跟进。',
  '把线下已经发生的事记清楚，让知识资产可被检索。',
] as const;
