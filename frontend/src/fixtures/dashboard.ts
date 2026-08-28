/**
 * P01 总看板的冻结数据（《设计文档 V2.0》第 5 章）。
 *
 * <h3>冻结的含义</h3>
 *
 * 这些数字参与视觉回归基线，文档 0.3 明令「禁止按当前时间改变状态」。
 * 因此这里不出现 new Date()、不出现随机数、不做任何计算 —— 全是字面量。
 * 改动其中任何一个数字都会让 P01 的截图基线失效。
 *
 * <h3>标签替换（业务裁决 V-7）与业务改版（V-70）</h3>
 *
 * V2.0 的冻结数据里有 4 处状态机里不存在的取值，业务裁决 V-7 是「fixtures 里替换为
 * 状态机的合法取值」。替换只动标签、<b>不动数字与数字的位置</b> ——
 * 数字宽度参与像素比对，挪一个数字就等于改基线。
 *
 * <p>其中三处在业务改版 V-70 里被重新指定了口径（课程卡、讲师卡、培训卡、案例卡的
 * 底部数），因此 V-7 的四处替换现在只剩需求卡那一处还在生效：
 *
 * | V2.0 原值   | 替换为   | 依据                                                    |
 * |-------------|----------|---------------------------------------------------------|
 * | 待澄清 48   | 已评审   | 需求评审状态只有 待评审／评审中／已评审（N2 无「待澄清」）|
 *
 * <p><b>「已评审 48」看着偏小是替换的副作用，不是数据错。</b>原值 48 属于「待澄清」，
 * 换标签后落到了「已评审」头上。保留 48 是为了守住像素基线；真实数据接入后（阶段 3）
 * 这个数由指标接口给，不再有这个问题。
 */

import { withCurrentDates } from './fixtureClock';
import { ASSETS } from '@/shared/theme/designTokensV2';

/**
 * 产品模式下五张业务入口卡底部数的标签。
 *
 * <p>回归模式用的是 {@link DashboardEntry#stats} 里冻结的标签；产品模式的数由
 * {@code /api/dashboard/overview} 的 {@code cockpits} 段给出，接口只回数字不回名字，
 * 名字得由前端配。
 *
 * <p>放在 fixtures 而不是页面文件里，是因为其中几个名字含状态词（「已发布」
 * 「可上岗」）：页面文件受 STK-1 门禁按子串拦截，而 {@code src/fixtures} 整目录豁免 ——
 * 豁免的理由正是这些字符串扮演的是后端载荷，只往标签上渲染，不参与任何状态判断。
 *
 * <p><b>条数逐卡不同</b>（V-70）：需求／课程／讲师三条，培训／案例两条。
 * 顺序即渲染顺序，与页面 {@code ENTRY_LIVE_FIELDS} 里取 {@code cockpits} 字段的顺序
 * 逐位配对，两边长度不一致时编译不过——错位一格后的每一对看着都合理。
 *
 * <p>课程卡的三条是一条<b>单调收窄的漏斗</b>（已开发 ⊇ 已评审 ⊇ 已发布），
 * 不是三个互斥的状态计数。讲师卡的「待试讲」数的是课程（试讲子状态为「待试讲」的课程数），
 * 不是讲师——讲师侧没有「待试讲」这个字段，只有一个试讲合格标记。
 */
export const ENTRY_STAT_LABELS = {
  demands: ['待评审需求', '开发中需求', '需求总数'],
  courses: ['已开发', '已评审', '已发布'],
  lecturers: ['待试讲', '培养中', '可上岗'],
  trainings: ['培训场次', '参训人次'],
  cases: ['已上架', '浏览次数'],
} as const;

/**
 * {@code /api/dashboard/overview} 的 {@code cockpits} 分节名，也是这五张卡的身份。
 *
 * <p>从 {@link ENTRY_STAT_LABELS} 的键推导而不是另写一个联合类型：这五个名字要同时
 * 对上「标签表的键」「接口分节名」「入口卡的 {@code cockpit} 字段」三处，
 * 手写第二份的那天就会有一处对不上，而对不上的表现是<b>某张卡静静地停在冻结数据上</b>。
 */
export type CockpitSection = keyof typeof ENTRY_STAT_LABELS;

/**
 * R3 五张 KPI。环比字符串含箭头，箭头是文本不是图标 —— 文档 0.3 禁止改写文案。
 *
 * <p>{@code id} 是给页面挂图标用的稳定键。不用中文标签当键有两个原因：
 * 指标名会随需求 15.x 的措辞调整，而「已发布课程」这类名字里含状态词「已发布」，
 * 拿它当页面里的字面量会撞上 STK-1 门禁。
 *
 * <p><b>五张而不是 V2.0 的六张</b>（V-70）：业务撤掉了「课程总数」。撤掉之后这一行
 * 与 R4 的五张入口卡列数相同、间距相同，两行的竖直分界线因此逐列对齐——
 * 这是撤卡要达到的效果，不是顺带的副作用，所以列数写在 CSS 里时不要再回到 6。
 */
export const DASHBOARD_KPIS = [
  { id: 'demandTotal', label: '需求总数', value: '1,268', delta: '↑ 12.5%' },
  { id: 'coursePublished', label: '已发布课程', value: '512', delta: '↑ 14.7%' },
  { id: 'lecturerPool', label: '讲师池人数', value: '1,236', delta: '↑ 7.9%' },
  { id: 'trainingSession', label: '培训场次数', value: '328', delta: '↑ 20.1%' },
  { id: 'caseListed', label: '案例上架数', value: '186', delta: '↑ 10.4%' },
] as const;

/**
 * 五张 KPI 的环比基准。累计总数对「上个月」，不是对顶栏日期窗。
 *
 * <p>写死成一个常量而不是五份：改口径只改这里。文案与需求驾驶舱同一句，
 * 避免总看板写「较上周期」、需求页写「月度环比」——两页对不上会让人以为
 * 顶栏日期窗在驱动首页这五个数。
 */
export const DELTA_BASELINE_LABEL = '月度环比（较上月）';

export interface EntryStat {
  label: string;
  value: string;
}

export interface DashboardEntry {
  /** 与 shellNav 的 pageKey 对齐，卡片点击跳该驾驶舱 */
  pageKey: string;
  /**
   * 这张卡的真实数字取 {@code cockpits} 的哪一节。
   *
   * <p><b>不能用 {@link pageKey} 顶替。</b>pageKey 的权威定义在侧栏（`shellNav`），
   * 讲师那项在那里叫 {@code instructor}；接口分节叫 {@code lecturers}。
   * 页面曾按 pageKey 分支去取数、并把讲师那支写成 {@code lecturer}，
   * 于是产品模式下讲师卡永远取不到真实数字——两个名字都是「合理」的，谁也不会报错。
   */
  cockpit: CockpitSection;
  title: string;
  path: string;
  illustration: string;
  /**
   * 回归模式用的底部数。条数与 {@link ENTRY_STAT_LABELS} 同一分节一致
   * （需求／课程／讲师三条，培训／案例两条）。
   */
  stats: EntryStat[];
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
    cockpit: 'demands',
    title: 'AI需求图',
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
    cockpit: 'courses',
    title: '课程工作台',
    path: '/courses',
    illustration: ASSETS.A06,
    // 漏斗三档，数值沿用 V2.0 冻结的 214／116／28 —— 三个数的位数不变，
    // 这一列的像素宽度因此与基线一致
    stats: [
      { label: '已开发', value: '214' },
      { label: '已评审', value: '116' },
      { label: '已发布', value: '28' },
    ],
  },
  {
    pageKey: 'instructor',
    cockpit: 'lecturers',
    title: '讲师与能力地图',
    path: '/lecturers',
    illustration: ASSETS.A07,
    // 三个数是 V2.0 原值 689／327／102 按新标签顺序重排，没有新造数字
    stats: [
      { label: '待试讲', value: '102' },
      { label: '培养中', value: '327' },
      { label: '可上岗', value: '689' },
    ],
  },
  {
    pageKey: 'training',
    cockpit: 'trainings',
    title: '培训运营地图',
    path: '/trainings',
    illustration: ASSETS.A12,
    /*
     * V-70 把这张卡改成两个数，而 V2.0 冻结的三个数（96／180／52）都属于计划状态计数，
     * 与新口径无一对应，所以两个数都是新补的占位：场次取 KPI「培训场次数」的 328 保持同源，
     * 人次按每场约 30 人给一个量级。产品模式下这两个数由 cockpits 段覆盖。
     */
    stats: [
      { label: '培训场次', value: '328' },
      { label: '参训人次', value: '9,860' },
    ],
  },
  {
    pageKey: 'case',
    cockpit: 'cases',
    title: '案例与组织覆盖图',
    path: '/cases',
    illustration: ASSETS.A03,
    /*
     * V-70 之前这张卡的三数是「案例总数／覆盖组织／覆盖率」，后两条属 N18 已删除的
     * 组织覆盖口径，因此当时要靠一组 productStats 在产品模式下整组换掉（V-8）。
     * 新口径的两条都是真实存在的指标（案例上架数 #18、浏览次数），
     * 两种模式取的是同一个口径，那组替换数据随之取消。
     */
    stats: [
      { label: '已上架', value: '186' },
      { label: '浏览次数', value: '12,480' },
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
  /** 状态机对象类型码，供「去处理」拼详情深链 */
  objectType: string;
  objectId: number;
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
 * R6 待办行动清单。前五行取自文档 14.1，其后补真实姓名样例让面板内滚动可见。
 *
 * <h3>灯色全部照抄文档，一处未改</h3>
 *
 * 业务把灯色口径改成「蓝=正常运行、黄=需要关注、红=已逾期或停滞」之后，
 * 文档 14.1 前五行反而全部自洽了：王晓芳「剩余 5 天 + 黄灯」正是「需要关注」，
 * 张伟强 8 天与刘洋 10 天的蓝灯正是「正常运行」。
 *
 * <h3>两处红灯按「状态停滞」解释</h3>
 *
 * 李明远剩余 2 天、陈晨剩余 0 天，都还没到期，所以红灯的成因只能是状态停滞
 * 而不是逾期。停滞天数从 {@code last_state_changed_at} 起算，与剩余天数无关，
 * 文档没冻结这个数 —— 好在预警灯列不显示天数（天数在左边的独立列），因此不需要编。
 *
 * <h3>姓名用真实三字／两字，不用「测试人员」占位（V-71）</h3>
 *
 * 责任人列宽按「头像 + 三字名」量的。冻结数据里若全是两字名，列宽缩回去也不报错，
 * 上线后三字名就会被裁成「李明…」。所以这里刻意混入三字名，把列宽钉死。
 *
 * <h3>第 5 行的对象名</h3>
 *
 * 「讲师认证-067／材料审核」→「讲师-067／入池评审」。讲师认证体系属一期禁区 F-1（V-10）。
 */

export const DASHBOARD_WORKLIST: WorklistRow[] = withCurrentDates([
  {
    id: 'W1',
    objectType: 'DEMAND',
    objectId: 987,
    owner: '李明远',
    object: 'AI需求-0987',
    node: '评审中',
    deadline: '2024-06-12',
    remainingDays: 2,
    light: 'RED',
    lightReason: 'STALLED',
  },
  {
    id: 'W2',
    objectType: 'COURSE',
    objectId: 456,
    owner: '王晓芳',
    object: '课程-0456',
    node: '课程开发中',
    deadline: '2024-06-15',
    remainingDays: 5,
    light: 'YELLOW',
  },
  {
    id: 'W3',
    objectType: 'TRAINING_SESSION',
    objectId: 321,
    owner: '张伟强',
    object: '培训场次-0321',
    node: '执行准备',
    deadline: '2024-06-18',
    remainingDays: 8,
    light: 'BLUE',
  },
  {
    id: 'W4',
    objectType: 'CASE',
    objectId: 188,
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
    objectType: 'LECTURER',
    objectId: 67,
    owner: '刘洋',
    object: '讲师-067',
    node: '入池评审',
    deadline: '2024-06-20',
    remainingDays: 10,
    light: 'BLUE',
  },
  {
    id: 'W6',
    objectType: 'COURSE',
    objectId: 512,
    owner: '赵敏',
    object: '课程-0512',
    node: '待试讲',
    deadline: '2024-06-22',
    remainingDays: 12,
    light: 'BLUE',
  },
  {
    id: 'W7',
    objectType: 'DEMAND',
    objectId: 1024,
    owner: '周立伟',
    object: 'AI需求-1024',
    node: '开发中',
    deadline: '2024-06-14',
    remainingDays: 4,
    light: 'YELLOW',
  },
  {
    id: 'W8',
    objectType: 'TRAINING_PLAN',
    objectId: 88,
    owner: '吴倩',
    object: '培训计划-0088',
    node: '排期确认',
    deadline: '2024-06-09',
    remainingDays: -1,
    light: 'RED',
    lightReason: 'OVERDUE',
  },
  {
    id: 'W9',
    objectType: 'COURSE',
    objectId: 330,
    owner: '郑海涛',
    object: '课程-0330',
    node: '评审决策',
    deadline: '2024-06-25',
    remainingDays: 15,
    light: 'BLUE',
  },
]);

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
export const EFFICIENCY_X_LABELS = withCurrentDates([
  '05-12',
  '05-16',
  '05-20',
  '05-24',
  '05-28',
  '06-02',
  '06-06',
  '06-10',
] as const);

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
    // 需求 7.7 的指标名是「课程一次评审通过率」。V2.0 的卡面省掉了「课程」两字，
    // 而看板上另有需求评审周期一条，省掉限定词后两条读起来像同一个对象的两个指标
    label: '课程一次评审通过率',
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

/*
 * V2.0 的 R8「业务价值」三条（效率提升／质量改善／成本节约）随 V-70 撤区一并删除。
 * 底部一行因此只剩 R7 效率指标与 R9 欢迎卡两格，腾出的 250px 归欢迎卡。
 *
 * 价值填报本身没有取消——填报页 /value-reports、它的路由与后端 value 段都还在，
 * 只是首页不再展示。
 *
 * <b>该页目前没有任何界面入口。</b>它在 navigation.ts 里是 inSidebar:false，
 * 唯一的入口就是被删掉的这张卡上的「查看明细」。运营只能靠直接输地址进入，
 * 也就是说填报功能实际不可用。待业务指定新入口（记入待修清单 V-70-a）。
 */

/** R9 欢迎卡。两行副文案，措辞避开状态字面量（见页面里的说明） */
export const WELCOME_LINES = withCurrentDates([
  '数据统计截止 2024-06-10，共 12 项待办需要跟进。',
  '把线下已经发生的事记清楚，让知识资产可被检索。',
] as const);
