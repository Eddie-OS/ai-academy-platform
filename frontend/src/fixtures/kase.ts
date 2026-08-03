/**
 * P06 案例与组织覆盖的冻结数据（《设计文档 V2.0》第 10 章）。
 *
 * <h3>逐条替换清单（业务已裁决）</h3>
 *
 * | V2.0 原值 | 替换为 | 依据 |
 * |---|---|---|
 * | KPI「阅读量」 | 「浏览次数」 | 15.5／12.4 硬要求改名；共享账号下是 PV |
 * | 卡片状态「审核中」 | 「待审核」 | 案例状态机只有 待整理／整理中／待审核／已上架（5.9） |
 * | 「+ 新建案例」可点 | 渲染但 disabled | 议题 27、N15：只能由精品课程自动创建；按钮只为对齐版式（V-65） |
 * | 互动分布「分享 0%」 | 去掉；圆环改点赞／评论两点 | 12.4 没有分享；消息渠道整类禁止 |
 * | 「分享报告」可点 | 渲染但 disabled | 触碰消息渠道禁区；三钮版式保留（V-65） |
 * | R7 组织覆盖 + 第六张 KPI | **两种模式都渲染** | V-65 覆盖 V-8：整页对齐设计稿；数据仍是 fixture，不建 org_department |
 */

import { ASSETS } from '@/shared/theme/designTokensV2';

/** 案例状态四值 */
export type CaseState = '待整理' | '整理中' | '待审核' | '已上架';

export interface CaseKpi {
  id: string;
  label: string;
  value: string;
  delta: string;
  icon: string;
}

/**
 * R3 六张 KPI。
 *
 * <p>「浏览次数」不是「阅读量」：数字照抄 128,358，只换标签。
 * 第六张「已覆盖部门数」随整页展示（V-65），数值仍是冻结 fixture。
 */
export const CASE_KPIS: CaseKpi[] = [
  { id: 'total', label: '案例总数', value: '1,268', delta: '↑ 12.5%', icon: 'Trophy' },
  { id: 'published', label: '已上架案例数', value: '986', delta: '↑ 10.2%', icon: 'Megaphone' },
  { id: 'views', label: '浏览次数', value: '128,358', delta: '↑ 18.7%', icon: 'Eye' },
  { id: 'likes', label: '点赞量', value: '6,842', delta: '↑ 16.3%', icon: 'ThumbsUp' },
  { id: 'comments', label: '评论数', value: '1,236', delta: '↑ 9.8%', icon: 'MessageSquare' },
  { id: 'coveredDepts', label: '已覆盖部门数', value: '68', delta: '↑ 8.6%', icon: 'Building2' },
];

/** @deprecated 保留别名，避免旧调用方断裂；现恒等于 {@link CASE_KPIS} */
export function caseKpis(): CaseKpi[] {
  return CASE_KPIS;
}

export const CASE_FILTERS = [
  { id: 'state', label: '案例状态', value: '全部' },
  { id: 'domain', label: '应用领域', value: '全部' },
  { id: 'org', label: '贡献组织', value: '全部' },
  { id: 'badge', label: '精品标注', value: '全部' },
  { id: 'range', label: '统计区间', value: '近 30 天' },
] as const;

export interface CaseCard {
  id: string;
  title: string;
  domain: string;
  tags: string[];
  state: CaseState;
  /** 精品标注。无则不显示角标 */
  featured?: boolean;
  views: string;
  likes: string;
  comments: string;
  cover: string;
}

/**
 * R5 五张案例卡。卡宽 177、间距 12 标注「必须照抄」。
 *
 * <p>默认选中第一张（文档 10）。第二张状态原设计稿是「审核中」，已换成「待审核」。
 */
export const CASE_CARDS: CaseCard[] = [
  {
    id: 'AL2024050001',
    title: 'AI助力智能合同审查',
    domain: '法务/合同管理',
    tags: ['RPA', '大模型', '文档理解'],
    state: '已上架',
    featured: true,
    views: '9,245',
    likes: '1,286',
    comments: '214',
    cover: ASSETS.A14,
  },
  {
    id: 'AL2024050002',
    title: '销售预测与线索评分实践',
    domain: '销售运营',
    tags: ['预测模型', 'CRM'],
    state: '待审核',
    featured: true,
    views: '8,132',
    likes: '986',
    comments: '168',
    cover: ASSETS.A15,
  },
  {
    id: 'AL2024050003',
    title: '智能客服知识库构建',
    domain: '客户服务',
    tags: ['RAG', '知识库'],
    state: '已上架',
    featured: true,
    views: '6,731',
    likes: '742',
    comments: '132',
    cover: ASSETS.A16,
  },
  {
    id: 'AL2024050004',
    title: '设备异常检测与预警',
    domain: '生产制造',
    tags: ['时序', '异常检测'],
    state: '已上架',
    views: '5,602',
    likes: '618',
    comments: '96',
    cover: ASSETS.A17,
  },
  {
    id: 'AL2024050005',
    title: '培训课程智能推荐系统',
    domain: '培训运营',
    tags: ['推荐', '画像'],
    state: '整理中',
    views: '4,912',
    likes: '520',
    comments: '88',
    cover: ASSETS.A18,
  },
];

export const CASE_SELECTED_ID = 'AL2024050001';
export const CASE_CARD_WIDTH = 177;
export const CASE_CARD_GAP = 12;

export const CASE_LIBRARY_VIEWS = ['卡片视图', '列表视图'] as const;
export type CaseLibraryView = (typeof CASE_LIBRARY_VIEWS)[number];
export const CASE_LIBRARY_DEFAULT_VIEW: CaseLibraryView = '卡片视图';

/** R6 精选排行（文档 10「冻结数据」） */
export const CASE_RANKING = [
  { rank: 1, title: 'AI助力智能合同审查', views: '9,245' },
  { rank: 2, title: '销售预测与线索评分实践', views: '8,132' },
  { rank: 3, title: '智能客服知识库构建', views: '6,731' },
  { rank: 4, title: '设备异常检测与预警', views: '5,602' },
  { rank: 5, title: '培训课程智能推荐系统', views: '4,912' },
] as const;

/**
 * R6 互动分布。去掉分享后两点占比仍用设计稿的 84.7%／15.3%
 * （6842÷(6842+1236)≈84.7%），圆环几何与标注位置对得上。
 */
export const CASE_INTERACTION = {
  total: '8,078',
  slices: [
    { id: 'likes', label: '点赞', value: 6842, percent: '84.7%' },
    { id: 'comments', label: '评论', value: 1236, percent: '15.3%' },
  ],
} as const;

/** R6 浏览趋势（占位序列，只服务版式） */
export const CASE_VIEW_TREND = {
  current: [42, 58, 51, 67, 72, 69, 88, 94, 91, 105, 112, 128],
  previous: [38, 44, 48, 52, 55, 60, 63, 70, 74, 80, 86, 92],
  labels: ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7', 'W8', 'W9', 'W10', 'W11', 'W12'],
} as const;

/** R7 组织覆盖率（冻结） */
export const COVERAGE_RATE = '68%';
export const COVERAGE_DELTA = '↑ 8.6%';

/**
 * 部门覆盖分布：分组 + 子部门横向条。
 *
 * <p>不是地理热力图（禁区第 14 项）。设计稿这一格就是树形进度条。
 * 组织名是展示用占位文本，不对应 `org_department` 表（N18）。
 */
export const COVERAGE_HEATMAP_GROUPS = [
  {
    name: '业务一线',
    rate: 86,
    children: [
      { name: '法务合规', rate: 92 },
      { name: '销售运营', rate: 78 },
      { name: '客户服务', rate: 81 },
    ],
  },
  {
    name: '职能平台',
    rate: 72,
    children: [
      { name: '人才发展', rate: 90 },
      { name: '财务管理', rate: 64 },
      { name: '信息技术', rate: 58 },
    ],
  },
] as const;

/** 兼容旧热力条断言：扁平五档 */
export const COVERAGE_HEATMAP = [
  { name: '业务一线', rate: 86 },
  { name: '职能平台', rate: 72 },
  { name: '研发中心', rate: 64 },
  { name: '区域公司', rate: 48 },
  { name: '新业务单元', rate: 31 },
] as const;

export const COVERAGE_TREND = {
  labels: ['1月', '2月', '3月', '4月', '5月', '6月'],
  values: [42, 48, 52, 58, 63, 68],
} as const;

/** 部门详情表列宽标注「必须照抄」，合计 480 */
export const COVERAGE_COLUMNS = [
  { id: 'dept', label: '部门', width: 210 },
  { id: 'headcount', label: '在职', width: 90 },
  { id: 'trained', label: '已培训', width: 90 },
  { id: 'rate', label: '渗透率', width: 90 },
] as const;

export const COVERAGE_ROWS = [
  { dept: '法务合规部', headcount: 86, trained: 72, rate: '83.7%' },
  { dept: '销售运营部', headcount: 142, trained: 98, rate: '69.0%' },
  { dept: '客户服务中心', headcount: 210, trained: 156, rate: '74.3%' },
  { dept: '智能制造部', headcount: 178, trained: 94, rate: '52.8%' },
  { dept: '人才发展中心', headcount: 64, trained: 58, rate: '90.6%' },
] as const;

export const COVERAGE_TOTAL = 68;

export const CASE_DETAIL_TABS = ['案例正文', '互动数据', '评论'] as const;
export const CASE_DETAIL_ACTIVE_TAB = 0;

export const CASE_DETAIL = {
  id: 'AL2024050001',
  title: 'AI助力智能合同审查',
  domain: '法务/合同管理',
  tags: ['RPA', '大模型', '文档理解'],
  state: '已上架' as CaseState,
  featured: true,
  cover: ASSETS.A14,
  summary:
    '合同审查平均耗时 2.5 小时/份，风险条款漏检率约 12%。引入大模型 + RPA 后，标准合同初审压到 20 分钟内，并给出可追溯的风险标注。',
  outcomes: [
    '标准合同初审效率提升 65%',
    '高风险条款召回率 96.2%',
    '法务人均周处理量 18 → 41 份',
  ],
  audiences: ['集团法务', '合同管理员', '采购签约支持', '销售签约支持'],
  reportGeneratedAt: '2024-06-10 09:30',
  reportBullets: [
    '本月新增上架案例 28 篇，浏览次数环比 ↑ 18.7%',
    '互动以点赞为主（84.7%），评论质量稳定，未见异常刷量',
    '合同审查、销售预测、智能客服三类主题贡献了 Top 5 中的前三名',
  ],
  nextSteps: [
    '推动「设备异常检测」从整理中完成审核上架',
    '对浏览次数＞5,000 且评论＜100 的案例补一波运营引导提问',
  ],
} as const;

export const CASE_COMMENTS = [
  { name: '周敏', text: '条款定位很准，我们法务侧已经当成标准作业的一部分。', at: '2024-06-08 14:20' },
  { name: '韩磊', text: '希望后续能支持更多非标合同模板。', at: '2024-06-07 09:12' },
] as const;
