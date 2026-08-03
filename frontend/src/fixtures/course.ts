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

import type { ActionAvailability } from '@/shared/api/types';

/** R3 五张 KPI。五个标签都是课程主状态名，与看板七列对得上 */
export const COURSE_KPIS = [
  { id: 'total', label: '课程总数', value: '842', delta: '↑ 8.3%' },
  { id: 'developing', label: '开发', value: '214', delta: '↑ 12.5%' },
  { id: 'reviewing', label: '评审决策', value: '96', delta: '↑ 9.2%' },
  { id: 'trial', label: '试讲', value: '52', delta: '↑ 7.1%' },
  { id: 'published', label: '发布', value: '180', delta: '↑ 6.4%' },
] as const;

/**
 * R4 筛选器。取需求 12.x P2-1 定的筛选条件的前八项，排两行 ——
 * 区域高 80px 正好是 8（内边距）+ 28（控件）+ 8（行距）+ 28 + 8。
 *
 * <p>其余（创建时间区间、预计发布时间区间、是否有关联需求）收在「更多筛选」里。
 * 全部未选中态：文档 0.3 禁止让 fixture 随当前时间或交互变化。
 */
export const COURSE_FILTERS = [
  [
    { id: 'courseType', label: '课程类型' },
    { id: 'category', label: '课程类别' },
    { id: 'reviewState', label: '评审状态' },
    { id: 'subState', label: '子状态' },
    { id: 'owner', label: '课程负责人' },
  ],
  [
    { id: 'validity', label: '有效期状态' },
    { id: 'qualified', label: '精品标注' },
    { id: 'light', label: '灯色' },
  ],
] as const;

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
    count: 132,
    cards: [
      { id: 'C-0768', name: '企业文化必修课', owner: '赵敏', light: 'BLUE', stalledDays: null },
      { id: 'C-0759', name: '标杆案例拆解', owner: '孙悦', light: 'BLUE', stalledDays: null },
      { id: 'C-0744', name: '创新思维工作坊', owner: '王芳', light: 'BLUE', stalledDays: null },
    ],
  },
];

/** 默认选中卡片。文档「默认状态与交互」：选中卡蓝色 1px 描边 */
export const COURSE_SELECTED_ID = 'C-0842';

/**
 * R8 课程详情。文档 7「默认状态与交互」：默认展开「课程材料与版本」。
 *
 * <p>页签取需求 9.x 课程详情的分区，第三个是文档点名要默认展开的那个。
 */
export const COURSE_DETAIL_TABS = ['基本信息', '自检清单', '课程材料与版本', '评审记录', '试讲记录'] as const;

/** 文档 7 指定的默认展开页签下标 */
export const COURSE_DETAIL_ACTIVE_TAB = 2;

export const COURSE_DETAIL_FIELDS = [
  { label: '课程类型', value: '内部讲师课程' },
  { label: '课程负责人', value: '陈华' },
  { label: '主状态', value: '评审决策' },
  // 评审决策没有子状态，轮次挂在评审记录上（见头注的替换清单）
  { label: '评审记录状态', value: '待录入结论 · 第 1 轮' },
  { label: '停滞天数', value: '2 天' },
] as const;

export interface MaterialVersion {
  version: string;
  /** 快照时间。含时间不含秒（设计规范 3.3） */
  snapshotAt: string;
  current: boolean;
}

/**
 * 材料版本列表（文档 7「冻结数据」）。
 *
 * <p>三个版本都是<b>提交评审时系统自动快照</b>的产物，界面上没有「新建版本」入口 ——
 * 需求 R7 明确「每条评审记录绑定一个课程材料版本，该版本为提交评审时系统自动生成」。
 */
export const COURSE_VERSIONS: MaterialVersion[] = [
  { version: 'V3', snapshotAt: '2024-06-07 14:20', current: true },
  { version: 'V2', snapshotAt: '2024-06-03 10:15', current: false },
  { version: 'V1', snapshotAt: '2024-05-28 16:40', current: false },
];

/** 自检完成度（文档 7「冻结数据」：Checklist 完成度 76%） */
export const COURSE_CHECKLIST_PERCENT = 76;

/**
 * R8 底部动作，形状照 `/api/{objectType}/{id}/transitions/available`。
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
 * <p>月份定死 2024 年 6 月，<b>不取当前月</b> —— 文档 0.3 与 15.1 都写明
 * 「不得使用今天」，取当前月会让基线截图每个月都失效一次。
 */
export const COURSE_CALENDAR: {
  year: number;
  month: number;
  selectedDate: string;
  /** 有排期的日子，用于在日历格子上打点 */
  scheduledDays: readonly number[];
} = {
  year: 2024,
  month: 6,
  selectedDate: '2024-06-12',
  scheduledDays: [3, 5, 6, 11, 12, 14, 18, 19, 24, 26, 27],
};

export const COURSE_CALENDAR_SESSIONS = [
  { time: '09:00', course: '领导力修炼' },
  { time: '14:00', course: '时间管理与效率提升' },
  { time: '16:00', course: '信息安全意识培训' },
] as const;

/**
 * R7 数据概览。
 *
 * <p><b>这一块的内容文档没有冻结</b>，7「素材映射」只说「数据概览 A07」。
 * 所以三个数字全部取<b>能从已冻结数据推出来的量</b>，一个新数都不编：
 * <ul>
 *   <li>看板在途 828 = 七列计数之和</li>
 *   <li>已发布 180 = KPI「发布」</li>
 *   <li>不在看板上 14 = 课程总数 842 − 828，即三个终态里的课程</li>
 * </ul>
 *
 * <p>周期类指标（平均开发周期、一次通过率之类）一个都不放：那些属阶段 3 的
 * `aggregate/metrics`，在这里编一个数出来，阶段 3 上线后同一个指标就有两套算法（P-5）。
 */
export const COURSE_OVERVIEW = [
  { id: 'onBoard', label: '看板在途', value: '828' },
  { id: 'published', label: '已发布', value: '180' },
  { id: 'offBoard', label: '不在看板', value: '14' },
] as const;
