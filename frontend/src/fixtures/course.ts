/**
 * P03 课程工作台的冻结数据（《设计文档 V2.0》第 7 章）。
 *
 * <h3>逐条替换清单（业务已裁决）</h3>
 *
 * | V2.0 原值 | 替换为 | 依据 |
 * |---|---|---|
 * | KPI「待评审」 | 「评审决策」 | `待评审` 不是课程任何状态机里的值。课程主状态里对应的阶段叫 `评审决策`，且两者计数同为 96 |
 * | KPI「开发中／试讲中／已发布」 | 「开发／试讲／发布」 | 这三个是<b>子状态</b>名，却拿来标主状态的计数。主状态=开发 的课程子状态可能是 待开发／开发中／自检中，「开发中 214」与实际不符。改成主状态名后与看板七列同源同值 |
 * | 详情「轨道=标准轨道」 | 「课程类型=内部讲师课程」 | 需求文档里<b>没有「轨道」这个字段</b>，也没有标准／快速分轨的概念。最接近的是字段 3「课程类型」，两个合法值是 内部讲师课程／外聘讲师课程（议题 8：一旦创建不得中途修改） |
 * | 详情「子状态=评审中（第1轮）」 | 「评审记录状态=待录入结论 · 第 1 轮」 | `评审决策` 没有子状态（子状态只存在于 开发／自检／试讲／发布 四个主状态下），`评审中` 不是任何课程状态机的取值。轮次本就挂在评审记录上 |
 * | 详情动作「创建快照」 | 不渲染 | 材料版本是<b>提交评审时系统自动生成</b>的（需求 R7、转换表 5.3.1 第 4／8 条、CK4），不是可执行动作 |
 * | 详情动作「进入试讲」 | 不渲染 | 它是「录入结论=通过」的结果，不是独立动作 |
 *
 * <h3>看板七列的计数合计 828，而 KPI 课程总数是 842</h3>
 *
 * 差的 14 门在 `已关闭`／`课程归档`／`案例归档` 三个终态里 —— 这三个状态都「退出预警范围」，
 * 不该出现在工作台看板上。<b>两个数不相等是对的</b>，不要为了对上而改任何一个。
 */

import { withCurrentCalendar, withCurrentDates } from './fixtureClock';
import type { ActionAvailability } from '@/shared/api/types';

export type CourseKpiId = 'total' | 'developing' | 'reviewing' | 'pendingTrial' | 'published';

export interface CourseKpiSpec {
  id: CourseKpiId;
  /** 卡名。业务点名的五个展示名，与业务页 `COURSE_METRICS` 逐字一致 */
  label: string;
  /**
   * 计数口径，卡上可见。
   *
   * <p>卡名与口径分成两件事写，是因为业务要的卡名里有两个不是状态机的取值：
   * 「评审中」对应主状态 `评审决策`，「待试讲」对应主状态 `试讲`（进入该状态时系统即置
   * 试讲子状态 `待试讲`，两者在入状态那一刻同值）。名字照业务的写，数的是什么写在这里 ——
   * 只写卡名就会被读成「有个叫评审中的状态」，只写状态名运营又对不上自己要的那张卡。
   */
  source: string;
  /** 取哪一列的存量。null 表示全量（七列 + 不上看板的存量） */
  column: string | null;
  /** 月度环比百分比。正数涨、负数跌，渲染时统一保留 1 位小数（设计规范 3.3） */
  deltaPercent: number;
}

/**
 * R3 五张 KPI。
 *
 * <h3>数字不在这里</h3>
 *
 * 五张卡的数值一律由 {@link COURSE_BOARD} 的七列存量加 {@link COURSE_OFF_BOARD_STOCK}
 * 派生（见 `features/course/courseBoardMock.ts` 的 `courseKpiValues`），这里只有口径与环比。
 * 写死 842/214/96/52/180 的话，新建一门课、或在详情里录一个结论，卡上的数字不会动，
 * 而同一屏左边的看板计数已经变了 —— 两个数就在同一屏，对不上一眼就能看见。
 *
 * <p>环比是<b>模拟数据</b>：一期没有环比接口（业务页那五张卡的 delta 仍是「—」）。
 * 「评审中」给的是跌，四涨一跌不是凑数 —— 只有涨的话，跌的样式（箭头方向与颜色）
 * 在任何一次验收里都不会被看到。
 */
export const COURSE_KPIS: readonly CourseKpiSpec[] = [
  { id: 'total', label: '课程总数', source: '七列存量 + 三个终态', column: null, deltaPercent: 8.3 },
  { id: 'developing', label: '开发中', source: '主状态=开发', column: 'development', deltaPercent: 12.5 },
  { id: 'reviewing', label: '评审中', source: '主状态=评审决策', column: 'reviewDecision', deltaPercent: -4.2 },
  { id: 'pendingTrial', label: '待试讲', source: '主状态=试讲', column: 'trial', deltaPercent: 7.1 },
  { id: 'published', label: '已发布', source: '主状态=发布', column: 'published', deltaPercent: 6.4 },
];

/**
 * R4 筛选器。取需求 12.x P2-1 定的筛选条件的前八项，排两行 ——
 * 区域高 80px 正好是 8（内边距）+ 28（控件）+ 8（行距）+ 28 + 8。
 *
 * <p>其余（创建时间区间、预计发布时间区间、是否有关联需求）收在「更多筛选」里。
 * 全部未选中态：文档 0.3 禁止让 fixture 随当前时间或交互变化。
 */
export type CourseAttrField =
  | 'type'
  | 'category'
  | 'reviewState'
  | 'subState'
  | 'owner'
  | 'validity'
  | 'qualified'
  | 'light';

export interface CourseFilterSpec {
  id: string;
  label: string;
  /** 筛的是 {@link COURSE_CARD_ATTRS} 里的哪个字段 */
  field: CourseAttrField;
  /**
   * 下拉可选项。不给的由看板现有卡片的取值去重得出 ——
   * 负责人与课程类别是数据里长出来的，写死一份就会出现「选了却筛不到任何卡」的项。
   */
  options?: readonly string[];
}

export const COURSE_FILTERS: readonly (readonly CourseFilterSpec[])[] = [
  [
    { id: 'courseType', label: '课程类型', field: 'type', options: ['内部讲师课程', '外聘讲师课程'] },
    { id: 'category', label: '课程类别', field: 'category' },
    { id: 'reviewState', label: '评审状态', field: 'reviewState', options: ['待评审', '评审中', '已评审'] },
    // 四组子状态各自独立，不做组合校验（议题 6）；没有子状态的主状态（立项／评审决策／推广）留空
    {
      id: 'subState',
      label: '子状态',
      field: 'subState',
      options: ['待开发', '开发中', '自检中', '自检完成', '待试讲', '试讲中', '待发布', '已发布'],
    },
    { id: 'owner', label: '课程负责人', field: 'owner' },
  ],
  [
    // 有效期是字段不是状态：到期只打标签，不改主状态、不阻断排课（需求 9.3、11.4）
    { id: 'validity', label: '有效期状态', field: 'validity', options: ['有效', '即将到期', '已过期'] },
    { id: 'qualified', label: '精品标注', field: 'qualified', options: ['已标注', '未标注'] },
    { id: 'light', label: '灯色', field: 'light', options: ['BLUE', 'YELLOW', 'RED', 'NONE'] },
  ],
];

/** 灯色下拉的中文标签。灯色值不是状态机取值，四个语义与 WarningLight 一致 */
export const COURSE_LIGHT_LABELS: Record<string, string> = {
  BLUE: '正常运行',
  YELLOW: '需要关注',
  RED: '已逾期 / 状态停滞',
  NONE: '无预警',
};

export interface CourseCard {
  id: string;
  name: string;
  owner: string;
  light: 'BLUE' | 'YELLOW' | 'RED' | 'NONE';
  lightReason?: 'OVERDUE' | 'STALLED';
  /** 停滞天数。null 表示无数据（界面「—」），不是 0 */
  stalledDays: number | null;
}

export interface BoardColumn {
  id: string;
  /** 列标题。课程主状态的合法取值；第七列是两个主状态的合并展示 */
  title: string;
  /**
   * 本列收哪些主状态。第七列收两个，其余各一个。
   *
   * <p>列标题与它分开写：标题是展示文本（第七列写成「推广 / 精品案例」），
   * 这里才是<b>状态到列的映射</b>。状态动作把一门课挪到别的状态后靠它决定落哪一列，
   * 落不到任何一列的（优化、三个终态）就此离开看板 —— 见 {@link COURSE_OFF_BOARD_STOCK}。
   */
  states: readonly string[];
  /** 该状态下的课程总数（文档 7「冻结数据」），不等于本列渲染的卡片数 */
  count: number;
  cards: CourseCard[];
}

/**
 * R5 七列课程看板。
 *
 * <h3>卡片内容不是冻结数据</h3>
 *
 * 文档 7 只冻结了<b>七列的列名与计数</b>，没给任何一张卡片的内容。
 * 而 438px 高的列放得下 3 张卡，七列就是 21 张。
 *
 * <p>所以卡片里的课程名是<b>为版式补的占位内容</b>，只有三个名字有出处：
 * `信息安全意识培训`（文档指定的默认选中课程）、`领导力修炼` 与 `时间管理与效率提升`
 * （文档 7「排期选中 2024-06-12」那天的三场）。其余十八个是编的。
 *
 * <p>编的部分只涉及<b>课程名与负责人</b>，一个状态值都没编 —— 列名全是课程主状态的合法取值。
 * 阶段 3/4 接真实数据时，这些名字整批消失，而列名与列宽不用动。
 */
export const COURSE_BOARD: BoardColumn[] = [
  {
    id: 'proposed',
    title: '立项',
    states: ['立项'],
    count: 18,
    cards: [
      { id: 'C-0912', name: 'AI提效工作法', owner: '王芳', light: 'BLUE', stalledDays: 0 },
      { id: 'C-0908', name: '跨部门协作实务', owner: '李明', light: 'BLUE', stalledDays: 1 },
      { id: 'C-0903', name: '数据合规入门', owner: '陈华', light: 'YELLOW', stalledDays: 3 },
    ],
  },
  {
    id: 'development',
    title: '开发',
    states: ['开发'],
    count: 214,
    cards: [
      { id: 'C-0887', name: '结构化表达训练', owner: '周强', light: 'BLUE', stalledDays: 1 },
      { id: 'C-0881', name: '客户经营方法论', owner: '赵敏', light: 'YELLOW', stalledDays: 4 },
      {
        id: 'C-0876',
        name: '项目管理基础',
        owner: '孙悦',
        light: 'RED',
        lightReason: 'STALLED',
        stalledDays: 9,
      },
    ],
  },
  {
    id: 'selfCheck',
    title: '自检',
    states: ['自检'],
    count: 136,
    cards: [
      { id: 'C-0864', name: '新员工入职引导', owner: '王芳', light: 'BLUE', stalledDays: 0 },
      { id: 'C-0859', name: '高效会议管理', owner: '刘洋', light: 'BLUE', stalledDays: 2 },
      { id: 'C-0851', name: '业务复盘六步法', owner: '李明', light: 'YELLOW', stalledDays: 5 },
    ],
  },
  {
    id: 'reviewDecision',
    title: '评审决策',
    states: ['评审决策'],
    count: 96,
    cards: [
      // 文档 7 指定的默认选中课程，停滞 2 天
      { id: 'C-0842', name: '信息安全意识培训', owner: '陈华', light: 'YELLOW', stalledDays: 2 },
      { id: 'C-0838', name: '目标管理与OKR', owner: '周强', light: 'BLUE', stalledDays: 1 },
      {
        id: 'C-0830',
        name: '销售谈判技巧',
        owner: '赵敏',
        light: 'RED',
        lightReason: 'OVERDUE',
        stalledDays: 6,
      },
    ],
  },
  {
    id: 'trial',
    title: '试讲',
    states: ['试讲'],
    count: 52,
    cards: [
      { id: 'C-0819', name: '时间管理与效率提升', owner: '孙悦', light: 'BLUE', stalledDays: 0 },
      { id: 'C-0812', name: '向上沟通实战', owner: '王芳', light: 'BLUE', stalledDays: 3 },
      { id: 'C-0806', name: '财务思维通识', owner: '刘洋', light: 'YELLOW', stalledDays: 4 },
    ],
  },
  {
    id: 'published',
    title: '发布',
    states: ['发布'],
    count: 180,
    cards: [
      { id: 'C-0793', name: '领导力修炼', owner: '李明', light: 'BLUE', stalledDays: null },
      { id: 'C-0788', name: '服务意识提升', owner: '陈华', light: 'BLUE', stalledDays: null },
      { id: 'C-0781', name: '数字化工具实操', owner: '周强', light: 'BLUE', stalledDays: null },
    ],
  },
  {
    /*
     * 第七列合并两个独立的主状态（推广、精品案例），是文档的展示口径。
     * 合并只影响这一列怎么显示，不影响状态机——两个状态在库里仍是两个值。
     * 拆成两列就会变成八列，7×119px 的「必须照抄」列宽随之作废。
     */
    id: 'promotion',
    title: '推广 / 精品案例',
    states: ['推广', '精品案例'],
    count: 132,
    cards: [
      { id: 'C-0768', name: '企业文化必修课', owner: '赵敏', light: 'BLUE', stalledDays: null },
      { id: 'C-0759', name: '标杆案例拆解', owner: '孙悦', light: 'BLUE', stalledDays: null },
      { id: 'C-0744', name: '创新思维工作坊', owner: '王芳', light: 'BLUE', stalledDays: null },
    ],
  },
];

/**
 * 不上看板的主状态存量（模拟数据）。
 *
 * <h3>这 14 门是「课程总数 842 减七列 828」的<b>存放处</b></h3>
 *
 * 头注说明了两个数为什么不等，但只写在注释里的话，KPI 的总数就只能靠在 828 上凭空 +14
 * 得到 —— 那和写死 842 是一回事。这里把三个终态各自的存量列出来，总数是加出来的：
 * 6 + 5 + 3 = 14，828 + 14 = 842。新建一门课让 828→829、842→843，两个数一起动。
 *
 * <p>`优化` 初始为 0，但它<b>必须在这张表里</b>：它是主状态的合法取值、不是终态、也没有
 * 对应的看板列（看板七列是文档冻结的）。评审录「不通过·修改后重新评审」的课程就落在这里 ——
 * 它离开看板但仍在预警范围内，课程总数不减。不给它一个格子，那门课就会在计数上凭空消失。
 */
export const COURSE_OFF_BOARD_STOCK: ReadonlyArray<{
  state: string;
  count: number;
  /** 终态退出预警范围（转换表 5.3.1 的 exitingWarningScope） */
  terminal: boolean;
}> = [
  { state: '已关闭', count: 6, terminal: true },
  { state: '课程归档', count: 5, terminal: true },
  { state: '案例归档', count: 3, terminal: true },
  { state: '优化', count: 0, terminal: false },
];

/**
 * 课程主状态的转换表（需求 5.3.1，18 条）。
 *
 * <h3>为什么这份表可以放在 fixtures 里</h3>
 *
 * 它扮演的是 `/api/meta/enums` 的状态机段与 `/api/{objectType}/{id}/transitions/available`
 * 的返回值 —— 与这个目录里其余数据同一性质（见 `stateLiteralGuard.test.ts` 对 fixtures 的
 * 豁免理由）。复刻件不连后端，动作可点、点了以后课程真的换列，靠的就是这份表。
 * 阶段 3 接真实接口时整批删掉，页面改读 available 的返回值。
 *
 * <p>逐条抄自 `CourseStateMachines.mainState()`，<b>不新增也不合并</b>：
 * 「录入结论=通过」的目标是 `试讲` 而不是 `发布`，「录入结论=不通过·修改后重新评审」
 * 的目标是 `优化` 而不是回 `开发`。自己顺手改一条，看板上的课程就会挪到一个真实系统里
 * 到不了的列。
 */
export interface CourseTransitionRow {
  from: string;
  action: string;
  to: string;
  /** 转换表的 `setSubState` 效果。目标主状态没有子状态组时不给 */
  subState?: string;
  /** 评审记录状态的连带变化（需求 5.5）。只有提交评审与录入结论会动它 */
  reviewState?: string;
}

export const COURSE_MAIN_TRANSITIONS: readonly CourseTransitionRow[] = [
  { from: '立项', action: '开始开发', to: '开发', subState: '待开发' },
  { from: '开发', action: '进入自检', to: '自检', subState: '自检中' },
  { from: '自检', action: '提交评审', to: '评审决策', reviewState: '评审中' },
  { from: '评审决策', action: '录入结论=通过', to: '试讲', subState: '待试讲', reviewState: '已评审' },
  { from: '评审决策', action: '录入结论=不通过·修改后重新评审', to: '优化', reviewState: '已评审' },
  { from: '评审决策', action: '录入结论=不通过·关闭', to: '已关闭', reviewState: '已评审' },
  { from: '优化', action: '再次提交评审', to: '评审决策', reviewState: '评审中' },
  { from: '试讲', action: '录入试讲课程结论=合格', to: '发布', subState: '已发布' },
  { from: '试讲', action: '录入试讲课程结论=不合格', to: '优化' },
  { from: '发布', action: '进入推广', to: '推广' },
  { from: '推广', action: '标注达到精品标准', to: '精品案例' },
  { from: '推广', action: '标注未达精品标准', to: '课程归档' },
  { from: '精品案例', action: '案例上架后归档', to: '案例归档' },
  // 需求表格第 15 行一行写了四个起始状态，这里展开成四条
  { from: '立项', action: '关闭课程开发', to: '已关闭' },
  { from: '开发', action: '关闭课程开发', to: '已关闭' },
  { from: '自检', action: '关闭课程开发', to: '已关闭' },
  { from: '优化', action: '关闭课程开发', to: '已关闭' },
];

/** 状态流转日志的文案模板，与 {@link COURSE_STATE_LOG} 里那三条同一句式 */
export const COURSE_STATE_LOG_TEMPLATE = '由 {from} 进入 {to}';

/** 置灰动作的状态原因模板（错误码 ILLEGAL_TRANSITION 的 message 句式） */
export const COURSE_BLOCKED_REASON_TEMPLATE = '当前状态为「{state}」，不能执行「{action}」';

/** 新建课程的初始主状态（转换表第 1 条 `（空）→ 课程立项 → 立项`） */
export const COURSE_INITIAL_STATE = '立项';

export interface CourseAttrs {
  type: string;
  category: string;
  /** 课程评审记录状态（需求 5.5）。没有评审轮次的课程是 `待评审` */
  reviewState: string;
  /** 四组子状态里当前那一组的取值；没有子状态组的主状态为 null，界面显示「—」 */
  subState: string | null;
  validity: string;
  qualified: string;
}

/**
 * 21 张样本卡的可筛属性（模拟数据）。
 *
 * <h3>为什么单独一张表，不并到卡片里</h3>
 *
 * {@link COURSE_BOARD} 那 21 张卡是<b>版式冻结数据</b>：卡上渲染的四个字段（ID、课程名、
 * 负责人、灯与天数）参与像素比对。八个筛选器要筛的属性一个都不在卡面上，混进去会让
 * 「这个字段是给版式的还是给筛选的」分不清，改筛选时顺手动到卡面就是一次基线失效。
 *
 * <p>子状态按各自主状态所属的那一组取值填（需求 5.4.1～5.4.4）：开发列的三张分别是
 * 待开发／开发中／自检中，自检列是自检完成，试讲列是待试讲／试讲中，发布与推广列是已发布。
 * 立项与评审决策<b>没有子状态组</b>，一律 null —— 给它们编一个子状态，就是设计稿那 8 处
 * 「状态机里不存在的状态值」的复刻。
 */
export const COURSE_CARD_ATTRS: Record<string, CourseAttrs> = {
  'C-0912': { type: '内部讲师课程', category: '通用能力', reviewState: '待评审', subState: null, validity: '有效', qualified: '未标注' },
  'C-0908': { type: '内部讲师课程', category: '管理能力', reviewState: '待评审', subState: null, validity: '有效', qualified: '未标注' },
  'C-0903': { type: '外聘讲师课程', category: '专业技术', reviewState: '待评审', subState: null, validity: '有效', qualified: '未标注' },
  'C-0887': { type: '内部讲师课程', category: '通用能力', reviewState: '待评审', subState: '开发中', validity: '有效', qualified: '未标注' },
  'C-0881': { type: '内部讲师课程', category: '营销服务', reviewState: '待评审', subState: '待开发', validity: '有效', qualified: '未标注' },
  'C-0876': { type: '外聘讲师课程', category: '专业技术', reviewState: '待评审', subState: '自检中', validity: '即将到期', qualified: '未标注' },
  'C-0864': { type: '内部讲师课程', category: '通用能力', reviewState: '待评审', subState: '自检完成', validity: '有效', qualified: '未标注' },
  'C-0859': { type: '内部讲师课程', category: '管理能力', reviewState: '待评审', subState: '自检完成', validity: '有效', qualified: '未标注' },
  'C-0851': { type: '内部讲师课程', category: '管理能力', reviewState: '待评审', subState: '自检完成', validity: '即将到期', qualified: '未标注' },
  'C-0842': { type: '内部讲师课程', category: '专业技术', reviewState: '评审中', subState: null, validity: '有效', qualified: '未标注' },
  'C-0838': { type: '内部讲师课程', category: '管理能力', reviewState: '评审中', subState: null, validity: '有效', qualified: '未标注' },
  'C-0830': { type: '外聘讲师课程', category: '营销服务', reviewState: '评审中', subState: null, validity: '已过期', qualified: '未标注' },
  'C-0819': { type: '内部讲师课程', category: '通用能力', reviewState: '已评审', subState: '待试讲', validity: '有效', qualified: '未标注' },
  'C-0812': { type: '内部讲师课程', category: '通用能力', reviewState: '已评审', subState: '试讲中', validity: '有效', qualified: '未标注' },
  'C-0806': { type: '外聘讲师课程', category: '专业技术', reviewState: '已评审', subState: '待试讲', validity: '即将到期', qualified: '未标注' },
  'C-0793': { type: '内部讲师课程', category: '管理能力', reviewState: '已评审', subState: '已发布', validity: '有效', qualified: '未标注' },
  'C-0788': { type: '内部讲师课程', category: '营销服务', reviewState: '已评审', subState: '已发布', validity: '有效', qualified: '未标注' },
  'C-0781': { type: '外聘讲师课程', category: '专业技术', reviewState: '已评审', subState: '已发布', validity: '已过期', qualified: '未标注' },
  'C-0768': { type: '内部讲师课程', category: '通用能力', reviewState: '已评审', subState: '已发布', validity: '有效', qualified: '已标注' },
  'C-0759': { type: '内部讲师课程', category: '营销服务', reviewState: '已评审', subState: '已发布', validity: '有效', qualified: '已标注' },
  'C-0744': { type: '外聘讲师课程', category: '通用能力', reviewState: '已评审', subState: '已发布', validity: '即将到期', qualified: '未标注' },
};

/** 新建课程表单的可选项。课程 ID 由系统生成，表单里不出现 */
export const COURSE_FORM_OPTIONS = {
  type: ['内部讲师课程', '外聘讲师课程'],
  category: ['通用能力', '管理能力', '专业技术', '营销服务'],
  owner: ['王芳', '李明', '陈华', '周强', '赵敏', '孙悦', '刘洋'],
} as const;

/**
 * 课程与另外四个驾驶舱的关联对象（模拟数据）。
 *
 * <p>详情弹窗里的四条跳转按它走：跳过去时带 `?focus=<对象编号>`，
 * 目标驾驶舱把该对象设为选中项（`useFocusParam`）。一期没有关联关系接口，
 * 这里只覆盖看板上有卡的那几门课；没有登记的课程跳过去就是普通的驾驶舱首屏。
 */
export const COURSE_CROSS_LINKS: Record<
  string,
  { demand?: string; lecturer?: string; trainingPlan?: string; caseId?: string }
> = {
  'C-0842': { demand: 'D-2024-0142', lecturer: 'L-0231', trainingPlan: 'TP-2024-0088' },
  'C-0819': { demand: 'D-2024-0137', lecturer: 'L-0209', trainingPlan: 'TP-2024-0091' },
  'C-0793': { lecturer: 'L-0231', trainingPlan: 'TP-2024-0084', caseId: 'CS-0142' },
  'C-0768': { trainingPlan: 'TP-2024-0079', caseId: 'CS-0128' },
};

/** 默认选中卡片。文档「默认状态与交互」：选中卡蓝色 1px 描边 */
export const COURSE_SELECTED_ID = 'C-0842';

/**
 * 课程详情（双击课程卡后的弹窗）。文档 7「默认状态与交互」：默认展开「课程材料与版本」。
 *
 * <p>页签取需求 9.x 课程详情的分区，第三个是文档点名要默认展开的那个。
 */
export const COURSE_DETAIL_TABS = ['基本信息', '自检清单', '课程材料与版本', '评审记录', '试讲记录'] as const;

/** 文档 7 指定的默认展开页签下标 */
export const COURSE_DETAIL_ACTIVE_TAB = 2;

/** 课程类型。详情头的标签与元信息行都用它，两处必须同源 */
export const COURSE_TYPE = '内部讲师课程';

export const COURSE_OWNER = '陈华';

/**
 * 详情头下方的状态摘要四格。
 *
 * <p>课程类型与负责人不在这里 —— 它们是不随状态变的属性，已经提到标题行与元信息行了。
 * 这四格只放<b>会随状态机变的量</b>，运营扫一眼就知道这门课卡在哪、卡了多久。
 */
export const COURSE_DETAIL_FIELDS = withCurrentDates([
  { label: '当前主状态', value: '评审决策' },
  // 评审决策没有子状态，轮次挂在评审记录上（见头注的替换清单）
  { label: '评审记录状态', value: '待录入结论 · 第 1 轮' },
  // 与「停滞天数」同源：两者必须是 last_state_changed_at 的两种呈现，不能各算各的
  { label: '最后状态变更', value: '2024-06-08 15:32' },
  { label: '停滞天数', value: '2 天' },
] as const);

export interface MaterialVersion {
  version: string;
  /** 快照时间。含时间不含秒（设计规范 3.3） */
  snapshotAt: string;
  /** 触发这次快照的操作人。共享账号下只到号，这里给的是录入人姓名 */
  operator: string;
  current: boolean;
}

/**
 * 材料版本列表（文档 7「冻结数据」）。
 *
 * <p>三个版本都是<b>提交评审时系统自动快照</b>的产物，界面上没有「新建版本」入口 ——
 * 需求 R7 明确「每条评审记录绑定一个课程材料版本，该版本为提交评审时系统自动生成」。
 */
export const COURSE_VERSIONS: MaterialVersion[] = withCurrentDates([
  { version: 'V3', snapshotAt: '2024-06-07 14:20', operator: '陈华', current: true },
  { version: 'V2', snapshotAt: '2024-06-03 10:15', operator: '陈华', current: false },
  { version: 'V1', snapshotAt: '2024-05-28 16:40', operator: '李华', current: false },
]);

/**
 * 当前版本（V3）的材料清单。
 *
 * <p>`tone` 只决定左侧色块的底色，<b>不表意</b> —— 材料名就写在色块右边，
 * 颜色去掉后这一列照样读得懂（WV1 同理：色不做唯一载体）。
 */
export const COURSE_MATERIALS: ReadonlyArray<{
  name: string;
  version: string;
  tone: 'blue' | 'teal' | 'amber' | 'violet' | 'rose';
}> = [
  { name: '教案 PPT', version: 'v3.0', tone: 'blue' },
  { name: '讲师手册', version: 'v3.0', tone: 'teal' },
  { name: '学员手册', version: 'v3.0', tone: 'amber' },
  { name: '案例与练习', version: 'v3.0', tone: 'violet' },
  // 课件视频停在 v2.1：五个材料未必同步升版，齐版会让人以为快照是整包覆盖
  { name: '课件视频', version: 'v2.1', tone: 'rose' },
];

export const COURSE_VERSION_SUMMARY =
  '本版对齐评审材料要求：补充信息安全案例、测验题与讲师备注；提交评审时由系统自动快照为 V3。';

/** 版本变更记录。第一条的操作人写「系统」——快照不是人做的动作（需求 R7） */
export const COURSE_CHANGELOG = withCurrentDates([
  { at: '06-07 14:20', text: '提交评审时自动快照为 V3', by: '系统' },
  { at: '06-03 10:15', text: '更新教案 PPT / 案例与练习', by: '陈华' },
  { at: '05-28 16:40', text: '首版材料齐套', by: '李华' },
] as const);

/** 自检完成度（文档 7「冻结数据」：Checklist 完成度 76%） */
export const COURSE_CHECKLIST_PERCENT = 76;

/**
 * 自检清单摘要，四项检查项与得分都是为版式补的占位。
 *
 * <p>四项合计 33/40 = 82.5%，与上面的 76% 对不上，这是对的 ——
 * 完整清单不止四项，这里只摘了前四项，<b>不要为了凑出 76% 去改分数</b>。
 */
export const COURSE_CHECK_ITEMS = [
  { name: '课程信息完整性', score: '10/10' },
  { name: '学习目标清晰', score: '8/10' },
  { name: '评估方式设置', score: '6/10' },
  { name: '讲师手册完整', score: '9/10' },
] as const;

/**
 * 第 1 轮评审记录的时间线。
 *
 * <p>`pending` 那条写的是「预计评审结论」而不是一个已排定的动作 ——
 * 平台不替线下做判断，也不自动推进状态（原则一、C1）。
 */
export const COURSE_REVIEW_TIMELINE: ReadonlyArray<{
  at: string;
  text: string;
  phase: 'done' | 'current' | 'pending';
}> = withCurrentDates([
  { at: '06-08', text: '评审会已发起', phase: 'done' },
  { at: '06-10', text: '等待录入结论', phase: 'current' },
  { at: '06-12', text: '预计评审结论', phase: 'pending' },
]);

/** 试讲记录。当前主状态是评审决策，试讲还没开始 —— 这一块展示的是「为什么是空的」 */
export const COURSE_TRIAL = withCurrentDates({
  status: '未进入试讲阶段',
  expectedAt: '2024-06-20',
  note: '录入结论=通过后进入试讲',
} as const);

/**
 * 状态流转日志（原则二：状态手动流转，但变更必须自动留痕）。
 *
 * <p>三条都是主状态迁移，与「最后状态变更 2024-06-08 15:32」同源。
 * 改错别字那类编辑只动 updated_at，不进这个列表。
 */
export const COURSE_STATE_LOG = withCurrentDates([
  { at: '06-08 15:32', text: '由 自检 进入 评审决策' },
  { at: '06-05 16:10', text: '由 开发 进入 自检' },
  { at: '05-20 10:00', text: '由 立项 进入 开发' },
] as const);

/**
 * 详情动作，形状照 `/api/{objectType}/{id}/transitions/available`。
 *
 * <p>当前主状态是 `评审决策`，该状态下课程主状态机只有三条出边，动作名分别是
 * 「录入结论=通过」「录入结论=不通过·修改后重新评审」「录入结论=不通过·关闭」。
 *
 * <p>V2.0 写的五个动作里：
 * <ul>
 *   <li>「提交评审」是真实动作（自检→评审决策），但当前状态已经过了它 → 置灰 + 状态原因</li>
 *   <li>「关闭课程开发」是真实动作，但只从 立项／开发／自检／优化 出发 → 置灰 + 状态原因。
 *       在评审决策想关课程，走的是「录入结论=不通过·关闭」</li>
 *   <li>「创建快照」与「进入试讲」<b>不在任何列表里，因此不渲染</b> ——
 *       前者是提交评审的自动副作用，后者是「录入结论=通过」的结果。
 *       给一个永远不可点的按钮配个「由系统自动完成」的解释，比没有这个按钮更让人以为
 *       「是不是还有个手工入口只是没开」</li>
 * </ul>
 */
/**
 * 上面那份 availability 是<b>哪个主状态下</b>的。
 *
 * <p>看板上每张卡的可执行动作现在由 {@link COURSE_MAIN_TRANSITIONS} 现算（见
 * `courseAvailability`），这份 fixture 只在这一个状态下还有用 —— 它那两条置灰原因写得比
 * 模板细（「关闭课程请用『录入结论=不通过·关闭』」），换成模板会丢掉这句引导。
 */
export const COURSE_ACTION_AVAILABILITY_STATE = '评审决策';

export const COURSE_ACTION_AVAILABILITY: ActionAvailability = {
  allowedActions: ['录入结论=通过', '录入结论=不通过·修改后重新评审', '录入结论=不通过·关闭'],
  blockedActions: [
    { action: '提交评审', reason: '当前状态为「评审决策」，不能再执行「提交评审」' },
    { action: '关闭课程开发', reason: '当前状态为「评审决策」，关闭课程请用「录入结论=不通过·关闭」' },
  ],
};

/** 按钮渲染顺序：三个结论动作在前，两个置灰的在后 */
export const COURSE_ACTION_ORDER = [
  '录入结论=通过',
  '录入结论=不通过·修改后重新评审',
  '录入结论=不通过·关闭',
  '提交评审',
  '关闭课程开发',
] as const;

/**
 * R6 课程排期日历。文档 7「冻结数据」：排期选中 2024-06-12，当天三场。
 *
 * <p>回归模式下就是这份冻结值 —— 文档 0.3 与 15.1 都写明「不得使用今天」，
 * 取当前月会让基线截图每个月都失效一次。产品模式反过来必须落在真实当月，
 * 口径与 {@link resolveTrainingCalendar} 一致，理由见那里的注释。
 */
export const COURSE_CALENDAR: {
  year: number;
  month: number;
  selectedDate: string;
  /** 有排期的日子，用于在日历格子上打点 */
  scheduledDays: readonly number[];
} = withCurrentCalendar({
  year: 2024,
  month: 6,
  selectedDate: '2024-06-12',
  scheduledDays: [3, 5, 6, 11, 12, 14, 18, 19, 24, 26, 27],
});

/**
 * 选中日（2024-06-12）的三场。
 *
 * <p>`tag` 与 `tagTone` 成对给：徽章上写的就是「试讲」「评审」，
 * 色调只是让两类好扫一眼，去掉颜色不丢信息。
 */
export type CourseCalendarSession = {
  time: string;
  course: string;
  subtitle: string;
  meta: string;
  tag: string;
  tagTone: 'trial' | 'review';
};

export const COURSE_CALENDAR_SESSIONS: ReadonlyArray<CourseCalendarSession> = [
  { time: '09:00', course: '领导力修炼', subtitle: '试讲第 1 期', meta: '讲师：周磊 · 参与：18 人', tag: '试讲', tagTone: 'trial' },
  {
    time: '14:00',
    course: '时间管理与效率提升',
    subtitle: '试讲第 2 期',
    meta: '讲师：陈晨 · 参与：24 人',
    tag: '试讲',
    tagTone: 'trial',
  },
  {
    time: '16:00',
    course: '信息安全意识培训',
    subtitle: '评审会',
    meta: '评审组：3 人 · 会议室：A-301',
    tag: '评审',
    tagTone: 'review',
  },
];

/**
 * 其它打点日的模拟场次。默认选中日仍走 {@link COURSE_CALENDAR_SESSIONS}。
 *
 * <p>产品模式会把日号平移到当月，不能按 6 月的 3／5／12 去查表。
 * 按「是不是打点日」取这一组循环，视觉回归只渲染默认选中日，进不了基线。
 */
const COURSE_CALENDAR_SESSIONS_OTHER: ReadonlyArray<readonly CourseCalendarSession[]> = [
  [{ time: '10:00', course: 'AI 提效工作法', subtitle: '试讲第 1 期', meta: '讲师：王芳 · 参与：16 人', tag: '试讲', tagTone: 'trial' }],
  [{ time: '15:00', course: '目标管理与OKR', subtitle: '评审会', meta: '评审组：3 人 · 会议室：B-201', tag: '评审', tagTone: 'review' }],
  [
    { time: '09:30', course: '财务思维通识', subtitle: '试讲第 1 期', meta: '讲师：刘洋 · 参与：12 人', tag: '试讲', tagTone: 'trial' },
    { time: '14:30', course: '向上沟通实战', subtitle: '评审会', meta: '评审组：2 人 · 会议室：A-102', tag: '评审', tagTone: 'review' },
  ],
  [{ time: '11:00', course: '新员工融入营', subtitle: '试讲第 2 期', meta: '讲师：李娜 · 参与：20 人', tag: '试讲', tagTone: 'trial' }],
  [{ time: '16:30', course: '数据素养入门', subtitle: '评审会', meta: '评审组：3 人 · 会议室：C-110', tag: '评审', tagTone: 'review' }],
];

/** 某日的场次。没排期返回空数组，右侧写「当日没有排期」，不要伪造一场。 */
export function courseSessionsForDay(day: number): readonly CourseCalendarSession[] {
  const selected = Number(COURSE_CALENDAR.selectedDate.slice(-2));
  if (day === selected) return COURSE_CALENDAR_SESSIONS;
  const index = COURSE_CALENDAR.scheduledDays.indexOf(day);
  if (index < 0) return [];
  return COURSE_CALENDAR_SESSIONS_OTHER[index % COURSE_CALENDAR_SESSIONS_OTHER.length] ?? [];
}

export interface CourseDayAgenda {
  day: number;
  iso: string;
  sessions: readonly CourseCalendarSession[];
}

/** 某月全部有课的日子。不在模拟月里就空，完整日历弹窗据此列清单。 */
export function courseMonthAgenda(year: number, month: number): CourseDayAgenda[] {
  if (year !== COURSE_CALENDAR.year || month !== COURSE_CALENDAR.month) return [];
  const pad = (n: number) => String(n).padStart(2, '0');
  return [...COURSE_CALENDAR.scheduledDays]
    .sort((a, b) => a - b)
    .map((day) => ({
      day,
      iso: `${year}-${pad(month)}-${pad(day)}`,
      sessions: courseSessionsForDay(day),
    }))
    .filter((item) => item.sessions.length > 0);
}

/**
 * R7 数据概览（本周）。
 *
 * <p><b>这一块的内容文档没有冻结</b>，7「素材映射」只说「数据概览 A07」，
 * 所以三个数与环比都是<b>为版式补的占位</b>，不是从别处推出来的量。
 *
 * <p>面板标题写「（本周）」是必需的：三个数都是<b>周窗口内的增量</b>，
 * 不写窗口的话「状态流转数 128」会被读成累计值，与看板七列的存量计数混为一谈。
 *
 * <p>口径本身属阶段 3 的 `aggregate/metrics`，这里只占位；阶段 3 接入时整批换掉，
 * <b>不要在这里把公式写死</b>，否则同一个指标会有两套算法（P-5）。
 */
export const COURSE_OVERVIEW = [
  { id: 'transitions', label: '状态流转数', value: '128', delta: '↑ 15.2%' },
  { id: 'newCourses', label: '新建课程数', value: '24', delta: '↑ 9.8%' },
  // 百分比保留 1 位小数（设计规范 3.3）
  { id: 'reviewPass', label: '评审通过率', value: '76.3%', delta: '↑ 4.3%' },
] as const;
