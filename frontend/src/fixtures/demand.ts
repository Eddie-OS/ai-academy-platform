/**
 * P02 AI需求驾驶舱的冻结数据（《设计文档 V2.0》第 6 章 + 14.2）。
 *
 * <h3>为什么这份 fixture 与 V2.0 的表格长得不太一样</h3>
 *
 * 需求这个对象在需求文档 5.2 里的结构是<b>「一个分流出口字段 + 两组状态字段」</b>，
 * 出口决定后续激活哪一组：
 *
 * <ul>
 * <li>出口一「用现有工具输出解决方案」→ 激活<b>解决方案状态</b>（已输出／已发布）</li>
 * <li>出口二「造工具需求开发」→ 激活<b>需求开发状态</b>（已立项／待开发／开发中／已上线／优化中）</li>
 * </ul>
 *
 * 两组互斥（需求 1215：出口为空时字段 21–27 全隐藏，选出口一显示 21–23、出口二显示 24–27）。
 * 所以不存在一个对所有行都成立的「开发状态」列。V2.0 表格里的「开发」列，
 * 对应的是需求 12.x 给 P1-1 列表定的<b>「当前处理状态」</b>——按出口取对应那一组的当前值。
 * 这不是我改的口径，是需求文档自己为这个问题设的列。
 *
 * <h3>逐条替换清单（业务已裁决）</h3>
 *
 * | V2.0 原值 | 替换为 | 依据 |
 * |---|---|---|
 * | 分流「采购/外部」 | 出口二「造工具需求开发」 | 分流出口<b>只有两值</b>，5.2.2 明令不设第三项、不设「其他」；该行带着需求开发状态=开发中，而开发状态是出口二专用 |
 * | 分流「内部开发」 | 出口二「造工具需求开发」 | 同上，语义一致 |
 * | 分流「复用工具」 | 出口一「用现有工具输出解决方案」 | 5.2.2 明说「若线下评审认为某需求可直接复用已有工具，仍走出口一」。出口三「已有工具可直接复用」已随 D19 删除 |
 * | 开发「未启动」 | 「—」 | 不是状态值。出口未定（评审状态非「已评审」）时两组状态字段都还没激活，按 API-5 用 null 表达 |
 * | 开发「设计中」 | 「已立项」 | 不是状态值。该行刚过评审、走出口二，开发状态的起点就是已立项 |
 * | 评审列的「已立项／开发中／已上线」 | 「已评审」 | 这三个是<b>需求开发状态</b>的值，漏到了评审列。需求评审状态只有 待评审／评审中／已评审，过了评审就是已评审 |
 * | 灯色「绿」 | 蓝灯 | 三色灯里没有绿。业务新口径下蓝灯就是「正常运行」，绿的语义正好落在蓝上 |
 *
 * <h3>停滞天数与灯色在这里各自独立</h3>
 *
 * 第 2 行停滞 5 天却是黄灯，而 P01 预警区把红灯的停滞口径写成「连续 5 天未变更」，
 * 按那个阈值这行该是红灯。<b>灯色照抄文档，不在 fixture 里现算。</b>
 * 真实判定在阶段 3 的 aggregate/warning，而停滞阈值由配置中心可配 ——
 * 现在写死一套推导，等于把一个本该可配的阈值锁进了前端。
 */

import { withCurrentDates } from './fixtureClock';
import type { ActionAvailability } from '@/shared/api/types';

/**
 * R3 七张 KPI。数字一律是累计总数（不随顶栏日期窗切片）；
 * {@code delta} 是月度环比，卡面文案见 DemandV2Page 的 DELTA_BASELINE_LABEL。
 */
export const DEMAND_KPIS = [
  { id: 'total', label: '需求总数', value: '1,268', delta: '↑ 12.5%' },
  { id: 'pendingReview', label: '待评审', value: '162', delta: '↑ 8.3%' },
  { id: 'reviewing', label: '评审中', value: '214', delta: '↑ 14.7%' },
  { id: 'reviewed', label: '已评审', value: '689', delta: '↑ 7.9%' },
  { id: 'approved', label: '已立项', value: '327', delta: '↑ 20.1%' },
  { id: 'developing', label: '开发中', value: '186', delta: '↑ 15.2%' },
  { id: 'online', label: '已上线', value: '132', delta: '↑ 10.4%' },
] as const;

/**
 * 分流出口（界面文案「评审流转去向」）的两个合法枚举值，以及给窄列用的短标签。
 *
 * <p>列内出短标签、`title` 出全称。短标签取的是「这条出口激活哪一组状态字段」——
 * 「解决方案」对应解决方案状态、「需求开发」对应需求开发状态。
 *
 * <p>需求 5.2.2 原文只有两值。现场口径 D-20 补第三条「需求驳回」，
 * 处理状态固定「结束」，须同步改 DemandEnums 与库表 CHECK。
 */
export const DEMAND_OUTLETS = {
  SOLUTION: { value: '用现有工具输出解决方案', shortLabel: '解决方案' },
  DEVELOP: { value: '造工具需求开发', shortLabel: '需求开发' },
  REJECT: { value: '需求驳回', shortLabel: '需求驳回' },
} as const;

/** 筛选项与表头的显示名。字段英文仍是 outlet，与命名对照表一致 */
export const DEMAND_OUTLET_LABEL = '评审流转去向';

export type DemandOutlet = keyof typeof DEMAND_OUTLETS;

export interface DemandRow {
  id: string;
  name: string;
  /** 所属领域。现场口径 D-21：零售／GTM／电商／MKT／服务／渠道／政企 */
  domain: string;
  proposer: string;
  owner: string;
  /** 需求评审状态：待评审／评审中／已评审，仅此三值 */
  reviewState: string;
  /** 分流出口。评审状态未到「已评审」时为 null，此时下面的 currentState 也为 null */
  outlet: DemandOutlet | null;
  /**
   * 当前处理状态（需求 12.x P1-1 默认展示列）。
   * 出口一时取解决方案状态、出口二时取需求开发状态、出口为空时 null。
   */
  currentState: string | null;
  /** 预计完成时间。纯日期语义，用 DATE 不用时间戳——三色灯按自然日算 */
  expectedDate: string;
  /** 提出时间。纯日期，与登记表单一致 */
  proposedDate: string;
  priority: string;
  demandSource: string;
  demandType: string;
  businessBackground: string;
  roiAnalysis: string;
  remark: string;
  description: string;
  light: 'BLUE' | 'YELLOW' | 'RED' | 'NONE';
  lightReason?: 'OVERDUE' | 'STALLED';
  /** 停滞天数。已完结的需求不再计停滞，用 null 表达「无数据」，界面显示「—」 */
  stalledDays: number | null;
}

/** R5 需求表格，八行取自文档 14.2「AI需求列表（可见8行）」 */
export const DEMAND_ROWS: DemandRow[] = withCurrentDates([
  {
    id: 'REQ-2024-0831',
    name: '智能教案生成增强需求',
    domain: '零售',
    proposer: '李明',
    owner: '王芳',
    reviewState: '待评审',
    outlet: null,
    currentState: null,
    expectedDate: '2024-06-30',
    proposedDate: '2024-05-08',
    priority: 'P0（紧急重要）',
    demandSource: '部门提出',
    demandType: '效率提升',
    businessBackground: '零售一线备课仍靠手工拼教案，版本散落在个人网盘，难以复用也难以质检。',
    roiAnalysis: '定性：缩短备课准备；量化：预计每门课少 2 人天重复劳动。',
    remark: '演示数据。附件请在新建需求保存后上传。',
    description:
      '【背景】教案生成准确率不足，教师仍需大量改写。\n【目标】按课纲输出可直接上课的初稿。\n【要求】覆盖零售场景用语，支持导出后二次编辑。',
    light: 'RED',
    lightReason: 'STALLED',
    stalledDays: 3,
  },
  {
    id: 'REQ-2024-0822',
    name: '学员能力画像优化需求',
    domain: 'GTM',
    proposer: '张小北',
    owner: '陈华',
    reviewState: '评审中',
    // 评审中却已有出口，是合法组合：「已评审」时必填出口，之后「重新评审」退回评审中，
    // 而清空出口需二次确认（转换表第 5 条）——也就是说退回后出口可以保留
    outlet: 'SOLUTION',
    currentState: '已发布',
    expectedDate: '2024-06-20',
    proposedDate: '2024-05-22',
    priority: 'P1（重要）',
    demandSource: '战略任务',
    demandType: '体验优化',
    businessBackground: '学员画像粒度粗，无法按行为与能力分层运营，推荐与资源匹配都偏经验。',
    roiAnalysis: '定性：提升个性化推荐精度；量化：目标是培训资源匹配命中率提高约 15%。',
    remark: '评审中保留原出口，清空出口需二次确认。',
    description:
      '当前学员画像逻辑中，无法及时精细化运营需求，希望基于行为数据、学习偏好、能力水平等多维度进行画像优化，提升个性化推荐精度与培训资源匹配效率。',
    light: 'YELLOW',
    stalledDays: 5,
  },
  {
    id: 'REQ-2024-0786',
    name: 'AI助教问答准确率提升',
    domain: '电商',
    proposer: '刘洋',
    owner: '陈华',
    reviewState: '已评审',
    outlet: 'DEVELOP',
    currentState: '已立项',
    expectedDate: '2024-07-15',
    proposedDate: '2024-05-18',
    priority: 'P1（重要）',
    demandSource: '培训反馈',
    demandType: '质量改善',
    businessBackground: '助教问答常答非所问，电商业务术语识别差，一线仍要人工兜底。',
    roiAnalysis: '定性：降低答疑等待；量化：预计人工兜底量下降约三成。',
    remark: '已立项，待拆开发任务。',
    description:
      '【背景】AI 助教在商品、促销、售后场景误答偏多。\n【目标】电商高频问法准确率达到可上线标准。\n【要求】保留人工接管入口，错误回答可标记回灌。',
    light: 'BLUE',
    stalledDays: 0,
  },
  {
    id: 'REQ-2024-0765',
    name: '课程标签体系扩展需求',
    domain: 'MKT',
    proposer: '王芳',
    owner: '周强',
    reviewState: '已评审',
    outlet: 'DEVELOP',
    currentState: '开发中',
    expectedDate: '2024-06-25',
    proposedDate: '2024-05-12',
    priority: 'P2（一般）',
    demandSource: '个人提出',
    demandType: '体验优化',
    businessBackground: '课程标签过粗，MKT 投放无法按客群精确圈选内容。',
    roiAnalysis: '定性：投放素材与课程匹配更准；量化：减少无效曝光。',
    remark: '标签字典需与配置中心对齐。',
    description:
      '【背景】现有标签无法支撑投放分群。\n【目标】扩展可运营的标签体系。\n【要求】兼容历史课程，不打断已上架内容。',
    light: 'YELLOW',
    stalledDays: 2,
  },
  {
    id: 'REQ-2024-0742',
    name: '讲师能力评估模型优化',
    domain: '服务',
    proposer: '赵敏',
    owner: '周强',
    reviewState: '已评审',
    outlet: 'DEVELOP',
    currentState: '开发中',
    expectedDate: '2024-07-05',
    proposedDate: '2024-05-16',
    priority: 'P1（重要）',
    demandSource: '部门提出',
    demandType: '质量改善',
    businessBackground: '讲师评估靠主观印象，服务条线难以判断谁能上岗、谁需回炉。',
    roiAnalysis: '定性：评估口径可复述；量化：减少因错派讲师导致的场次返工。',
    remark: '评估维度先做最小集。',
    description:
      '【背景】讲师能力评价缺少统一模型。\n【目标】给出可比较的评估结果。\n【要求】不自动改培养状态，结论由运营录入。',
    light: 'BLUE',
    stalledDays: 1,
  },
  {
    id: 'REQ-2024-0699',
    name: '学习路径推荐算法升级',
    domain: '渠道',
    proposer: '孙悦',
    owner: '李明',
    reviewState: '已评审',
    outlet: 'SOLUTION',
    currentState: '已发布',
    expectedDate: '2024-05-28',
    proposedDate: '2024-04-20',
    priority: 'P2（一般）',
    demandSource: '案例反推',
    demandType: '效率提升',
    businessBackground: '渠道伙伴学习路径固定，无法按岗位和已学内容跳转。',
    roiAnalysis: '定性：缩短上岗路径；量化：人均学习时长预计下降。',
    remark: '已发布解决方案，持续观察使用情况。',
    description:
      '【背景】学习路径是一张表推到底。\n【目标】按岗位与完成情况推荐下一步。\n【要求】可人工覆盖推荐结果。',
    light: 'BLUE',
    stalledDays: null,
  },
  {
    id: 'REQ-2024-0651',
    name: '企业培训报表自定义导出',
    domain: '政企',
    proposer: '周强',
    owner: '陈华',
    reviewState: '已评审',
    outlet: 'DEVELOP',
    currentState: '已上线',
    expectedDate: '2024-05-20',
    proposedDate: '2024-04-08',
    priority: 'P0（紧急重要）',
    demandSource: '战略任务',
    demandType: '成本降低',
    businessBackground: '政企客户要按项目导出培训报表，现靠手工拼表，出错且慢。',
    roiAnalysis: '定性：交付周期缩短；量化：单次导出从半天降到分钟级。',
    remark: '已上线，后续按项目模板迭代。',
    description:
      '【背景】报表字段因项目而异，无法一次导出。\n【目标】支持自定义列并落档。\n【要求】导出走异步任务，不卡页面。',
    light: 'BLUE',
    stalledDays: null,
  },
  {
    id: 'REQ-2024-0620',
    name: '案例库智能检索优化',
    domain: '零售',
    proposer: '李明',
    owner: '王芳',
    reviewState: '待评审',
    outlet: null,
    currentState: null,
    expectedDate: '2024-07-10',
    proposedDate: '2024-05-30',
    priority: 'P2（一般）',
    demandSource: '案例反推',
    demandType: '效率提升',
    businessBackground: '案例库只能按标题搜，零售一线找不到相近场景的案例。',
    roiAnalysis: '定性：复用成功案例；量化：减少重复整理同类材料。',
    remark: '待评审，检索策略先做关键词 + 领域。',
    description:
      '【背景】案例检索召回差，相近业务找不到参考。\n【目标】按领域与关键词提高命中。\n【要求】不引入独立搜索引擎，先用库内检索。',
    light: 'RED',
    lightReason: 'STALLED',
    stalledDays: 4,
  },
]);

/** 默认选中行。文档「默认状态与交互」：当前行浅蓝底 */
export const DEMAND_SELECTED_ID = withCurrentDates('REQ-2024-0822');

/**
 * 需求ID 的固定前缀。列表里只显示它后面那一段。
 *
 * <h3>为什么要去掉前缀</h3>
 *
 * 文档 6「内部几何」把 ID 列钉死在 95px 且标注「必须照抄」，
 * 而文档 14.2 给的 ID 是 13 个字符。实测「REQ-2024-0831」在 12px 下要 101.94px，
 * 列内可用宽度（95 减左右各 4px 内边距）只有 87px —— <b>文档这两处数据自己打架</b>，
 * 95px 装不下 13 位 ID，把字号压到 10px 才勉强进得去，那已经低于字号阶梯的下限。
 *
 * <p>去掉前缀后是「2024-0831」，13px 下约 76px，装得进 87px 且不必降字号。
 *
 * <p>可以安全去掉的理由是它<b>在这张表里恒为常量</b>：这是需求列表，每一行都是需求，
 * 「REQ-」在八行里重复八遍，一个信息量为零的前缀占掉了这一列四分之一的宽度。
 * 反过来不能去掉的是年份段 —— 那个会随年份变，去掉就真的丢信息了。
 *
 * <p>完整 ID 仍在两处可得：单元格的 title，以及右侧详情区的标题。
 */
export const DEMAND_ID_PREFIX = 'REQ-';

/**
 * R5 分页。文档：第 1 页、10 条/页、总 1,268 条。
 *
 * <p>{@code totalPages} 由总数与页大小算出来，不写字面量 —— 1268/10 向上取整正好 127，
 * 与设计稿末页号一致。写死 127 的话改页大小会得到一个静默错误的末页号。
 */
export const DEMAND_PAGINATION = { pageNum: 1, pageSize: 10, total: 1268 } as const;

export const DEMAND_TOTAL_PAGES = Math.ceil(DEMAND_PAGINATION.total / DEMAND_PAGINATION.pageSize);

/**
 * 页码条。前五页 + 省略号 + 末页，与设计稿一致。
 *
 * <p>省略号是 {@code null} 而不是字符串 '…'：字符串会被当成可点的页码渲染，
 * 而它点不动 —— 用类型把「这一格不是页码」表达出来。
 */
export const DEMAND_PAGE_ITEMS: Array<number | null> = [1, 2, 3, 4, 5, null, DEMAND_TOTAL_PAGES];

/**
 * R4 筛选器。取需求 12.x P1-1 定的筛选条件，其余（解决方案状态、需求开发状态、
 * 业务验收状态、提出时间区间）收在「更多筛选」里。
 *
 * <p>{@code placeholder} 区分两类控件：单选下拉用「请选择」，
 * 带「全部」这个真实取值的枚举筛选用「全部」——后者的空态<b>就是</b>一个有效选项，
 * 写成「请选择」会让人以为不选就没生效。
 *
 * <p>全部是未选中态：文档 0.3 禁止让 fixture 随当前时间或交互变化。
 */
export const DEMAND_FILTERS = [
  { id: 'domain', label: '所属领域', placeholder: '请选择' },
  { id: 'reviewState', label: '需求评审状态', placeholder: '全部' },
  { id: 'outlet', label: DEMAND_OUTLET_LABEL, placeholder: '全部' },
  { id: 'owner', label: '负责人', placeholder: '请选择' },
  { id: 'light', label: '预警', placeholder: '全部' },
] as const;

/**
 * 回归模式下「需求评审状态」筛选的下拉项。
 *
 * <p>产品模式取 {@code /api/meta/enums} 下发的评审状态（纪律 STK-1）。
 * {@code ?fixture=1} 跑在 {@code vite build} 的静态产物上，没有后端可问，
 * 下拉会空——空下拉本身不参与像素比对，但展开后的截图会缺三行，所以这里冻结一份。
 */
export const DEMAND_REVIEW_STATE_OPTIONS = ['待评审', '评审中', '已评审'] as const;

/** 搜索框的占位文案。三个可搜字段全写出来，否则运营不知道能不能按提出人搜 */
export const DEMAND_SEARCH_PLACEHOLDER = '搜索需求ID/名称/提出人';

/** 日期区间筛选。两个纯日期输入，不带时分——三色灯与效率指标按自然日算 */
export const DEMAND_DATE_RANGE = { label: '日期区间', from: '开始日期', to: '结束日期' } as const;

/**
 * R6 分析区左侧：领域分布柱图。
 *
 * <p>数组取文档 14.3「P02 领域柱图」的 7 个值，领域名按现场口径 D-21 七类，
 * 按数值降序对应 —— 文档只给了数组没给标签顺序，这里按柱高从高到低配领域，
 * 与表格里的领域集合完全一致，不额外发明领域。
 */
export const DEMAND_DOMAIN_BARS = [
  { domain: '零售', value: 356 },
  { domain: 'GTM', value: 298 },
  { domain: '电商', value: 214 },
  { domain: 'MKT', value: 156 },
  { domain: '服务', value: 108 },
  { domain: '渠道', value: 76 },
  { domain: '政企', value: 60 },
] as const;

/** 柱图纵轴刻度。封顶 400 略高于最大值 356，五档与设计稿一致 */
export const DEMAND_BAR_AXIS_TICKS = [0, 100, 200, 300, 400] as const;

/**
 * R6 左侧的两个统计口径。竖排分段控件，默认选中第一个。
 *
 * <p>只有两个：文档 6 的分析区就画了这两个。不要顺手补「按负责人统计」——
 * 组织维度统计随 N18 整体删除，按人统计在一期没有对应的指标口径。
 */
export const DEMAND_TREND_TABS = [
  { id: 'domain', label: '按所属领域统计' },
  { id: 'state', label: '按状态分布统计' },
] as const;

/**
 * R6 分析区右侧：状态漏斗。
 *
 * <p>六段与 R3 的后六张 KPI 同源同值（文档 14.3「P02 状态漏斗」＝[162,214,689,327,186,132]）。
 * 注意它<b>不是</b>严格递减的漏斗：已评审 689 比评审中 214 大得多。
 * 这是对的——一个需求一生只经过一次「评审中」，却会长期停在「已评审」之后的各状态里，
 * 所以中间段小、后段大。不要「顺手」把它排成递减。
 */
export const DEMAND_FUNNEL = [
  { state: '待评审', value: 162 },
  { state: '评审中', value: 214 },
  { state: '已评审', value: 689 },
  { state: '已立项', value: 327 },
  { state: '开发中', value: 186 },
  { state: '已上线', value: 132 },
] as const;

/**
 * 漏斗每段的占比 = 该段计数 ÷ 需求总数（1,268）。
 *
 * <p>算出来而不是抄设计稿的六个百分数：抄的话，哪天有人改了某一段的计数，
 * 百分比不会跟着变，而「214 显示成 16.9%」看起来完全正常。
 *
 * <p>3.3：百分比保留一位小数，整数也保留。
 */
export function funnelShare(value: number): string {
  return `${((value / DEMAND_PAGINATION.total) * 100).toFixed(1)}%`;
}

/**
 * 漏斗下方的必现说明。
 *
 * <p>六段占比之和是 134.9%，远超 100%。这不是算错：需求的评审状态与开发状态是
 * <b>两组并行的状态字段</b>（见本文件头注），一个「已评审 + 开发中」的需求同时被
 * 计进「已评审」和「开发中」两段。不写这句话，第一个把六个百分数加一遍的人
 * 就会去提一个数据错误的缺陷。
 */
export const DEMAND_FUNNEL_NOTE = '说明：评审状态与开发状态并行，各段占比之和可能超过 100%';

/** R6 右侧的需求动态卡。一期没有动态流（不做站内信与消息渠道），这里是空态 */
export const DEMAND_FEED = {
  title: '需求新的动态',
  caption: '有需求状态变更时会在这里展示',
} as const;

/**
 * R7 需求详情：默认选中 REQ-2024-0822 的「基本信息」页签。
 *
 * <p>「分流与处理」字段组仍按出口一落地（解决方案名称／已发布），点到该页签可见；
 * 需求开发状态整组不显示，因为它是出口二专用。
 */
/**
 * 六个页签，顺序照设计稿；默认落在第一个「基本信息」。
 *
 * <p>「评审信息」与「催办记录」对应的是需求自己的评审记录与催办台账明细，
 * 两者在一期都是真实存在的从表；「催办记录」<b>不是消息记录</b>——
 * 系统不发任何消息，这个页签下是催办台账的条目（催了谁、催的什么、什么时候催的）。
 */
export const DEMAND_DETAIL_TABS = [
  '基本信息',
  '评审信息',
  '分流与处理',
  '关联课程',
  '催办记录',
  '状态流转日志',
] as const;

/** 默认页签。写成常量而不是下标，改顺序时不会静默换掉默认页 */
export const DEMAND_DETAIL_ACTIVE_TAB = '基本信息';

/** 当前页签下的小节标题 */
export const DEMAND_DETAIL_SECTION_TITLE = '分流与处理信息';

export interface DemandDetailField {
  label: string;
  value: string | null;
  /**
   * 是否渲染成状态徽章。
   *
   * <p>只有状态机的状态值才给 true。「解决方案名称」这类自由文本渲染成徽章的话，
   * 会让人以为它是个可流转的状态。
   */
  tag?: boolean;
  /** 字段说明的悬浮提示，如分流出口的口径 */
  hint?: string;
}

/**
 * 详情字段表。<b>需求ID 与需求名称不在这里</b>——它们由详情区的标题承担，
 * 再在字段表里列一遍就是同一页上同一个值出现两次，运营会以为是两个不同的字段。
 *
 * <p>只出出口一那一组。设计稿把「解决方案状态」与「需求开发状态」并列画了出来，
 * 但两组按需求 1215 互斥，同时显示会让人以为这个需求既走了出口一又走了出口二。
 */
export const DEMAND_DETAIL_FIELDS: DemandDetailField[] = withCurrentDates([
  {
    label: DEMAND_OUTLET_LABEL,
    value: DEMAND_OUTLETS.SOLUTION.value,
    hint: '出口一：用现有工具输出解决方案。选定后仅激活解决方案状态一组字段',
  },
  { label: '解决方案名称', value: '学员画像分析引擎 v2.3' },
  { label: '解决方案状态', value: '已发布', tag: true },
  // 「标记」不是状态机的状态，是两个布尔标记位，所以不渲染成徽章
  { label: '交付使用标记', value: '未标记' },
  { label: '归档标记', value: '未归档' },
  { label: '预计完成时间', value: '2024-06-20' },
  // API-5：「—」用 null 表达。出口一的需求要等标记交付使用后才进业务验收，
  // 此刻还没标记，所以业务验收状态整组为空
  { label: '业务验收状态', value: null },
]);

/**
 * 详情里的两个人。
 *
 * <p>{@code title} 是这个人的岗位，不是账号角色 —— 一期全平台只有两个共享账号，
 * 没有个人身份、没有角色表（禁区第 11 项）。这两行来自人员台账（org_employee）。
 */
export const DEMAND_DETAIL_PEOPLE = [
  { role: '当前负责人', name: '陈华', title: 'AI平台产品经理' },
  { role: '提出人', name: '张小北', title: '平台管理员' },
] as const;

/** 领域与提出时间。领域是字典值，渲染成徽章；时间含时分，3.3 规定不显示秒 */
export const DEMAND_DETAIL_META = withCurrentDates([
  { label: '所属领域', value: 'GTM', tag: true },
  { label: '提出时间', value: '2024-05-22 14:30', tag: false },
] as const);

/** 需求描述。超出三行折叠，展开入口固定文案「查看更多」 */
export const DEMAND_DESCRIPTION =
  '当前学员画像逻辑中，无法及时精细化运营需求，希望基于行为数据、学习偏好、能力水平等多维度进行画像优化，' +
  '提升个性化推荐精度与培训资源匹配效率。';

export const DEMAND_DESCRIPTION_MORE = '查看更多';

/**
 * R7 底部四个固定按钮的可用性，形状照 `/api/{objectType}/{id}/transitions/available`。
 *
 * <p>V2.0 写的四个是「提交评审、录入结论、关联课程、一键催办」。前两个换成了状态机里
 * 真实存在的动作名：需求的评审动作只有「开始评审」「录入评审结论」「退回待评审」，
 * <b>没有「提交评审」</b>——那是课程主状态的动作。「提交评审」按位置对应「开始评审」。
 *
 * <p>当前行是评审中，所以「开始评审」不可执行，但按体验总纲 C-1 它<b>要渲染成置灰 + 原因</b>，
 * 而不是消失：按钮凭空少一个，运营会以为自己看错了页签。
 * 原因文案照 7.2 的样式写成可直接展示的中文，不是英文错误码。
 */
export const DEMAND_ACTION_AVAILABILITY: ActionAvailability = {
  allowedActions: ['录入评审结论', '关联课程', '一键催办'],
  blockedActions: [{ action: '开始评审', reason: '当前状态为「评审中」，不能再执行「开始评审」' }],
};

/** 按钮的渲染顺序照 V2.0 的四个位置，不按可用性排序——位置变动比置灰更让人困惑 */
export const DEMAND_ACTION_ORDER = ['开始评审', '录入评审结论', '关联课程', '一键催办'] as const;

/**
 * 产品模式操作区。视觉回归 {@code ?fixture=1} 仍用 {@link DEMAND_ACTION_ORDER}，不要改上面那四个。
 * 这四个是操作名，不是状态值；显隐不按评审状态推断（纪律 STK-1）。
 */
export const PRODUCT_DEMAND_ACTION_ORDER = [
  '修改需求信息',
  '录入评审结论',
  '录入开发状态',
  '一键催办',
] as const;

export const PRODUCT_DEMAND_ACTION_AVAILABILITY: ActionAvailability = {
  allowedActions: [...PRODUCT_DEMAND_ACTION_ORDER],
  blockedActions: [],
};

/**
 * 回归模式下非选中行的按钮可用性。
 *
 * <p>产品模式走 {@link PRODUCT_DEMAND_ACTION_AVAILABILITY}，<b>不经过这里</b>——
 * 真实数据的可执行动作由 {@code transitions/available} 下发。这段只服务
 * {@code ?fixture=1} 的像素比对：设计稿冻结了「按状态置灰并给出原因」的那一版四按钮，
 * 换成产品模式的四个会让 p02 的截图对不上。
 *
 * <p>它住在 fixtures 而不是页面里，是因为它扮演的正是<b>后端响应本身</b>——
 * 状态值在这里是载荷，和真实响应里的状态值一样（见本目录在 STK-1 门禁里的豁免理由）。
 */
export function regressionAvailability(reviewState: string): ActionAvailability {
  if (reviewState === '待评审') {
    return {
      allowedActions: ['开始评审', '关联课程', '一键催办'],
      blockedActions: [{ action: '录入评审结论', reason: '当前状态为「待评审」，请先「开始评审」' }],
    };
  }
  if (reviewState === '评审中') {
    return {
      allowedActions: ['录入评审结论', '关联课程', '一键催办'],
      blockedActions: [
        { action: '开始评审', reason: '当前状态为「评审中」，不能再执行「开始评审」' },
      ],
    };
  }
  return {
    allowedActions: ['关联课程', '一键催办'],
    blockedActions: [
      { action: '开始评审', reason: '当前状态为「已评审」，不能再执行「开始评审」' },
      { action: '录入评审结论', reason: '当前状态为「已评审」，不能再执行「录入评审结论」' },
    ],
  };
}

