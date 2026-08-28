/**
 * P07 任务中心的冻结数据。
 *
 * 共享账号没有可识别的「我」，因此第二个页签使用「按负责人」；逾期是根据截止日派生的
 * 标记，不与任务状态混存。页面只是 V2.0 复刻件，评论输入框不发送任何消息。
 */

import { withCurrentDates } from './fixtureClock';

export const TASK_TABS = ['全部任务', '按负责人', '已完成'] as const;
export type TaskTab = (typeof TASK_TABS)[number];
export const TASK_DEFAULT_TAB: TaskTab = TASK_TABS[0];

export const TASK_STATES = ['待处理', '处理中', '已完成', '已关闭'] as const;
export type TaskState = (typeof TASK_STATES)[number];

export const TASK_LIGHTS = ['全部', '蓝灯', '黄灯', '红灯', '无灯'] as const;

export const TASK_KPIS = [
  { id: 'all', label: '全部任务', value: '1,268', delta: '↑ 12.5%', period: '较上周', icon: 'ListTodo' },
  { id: 'pending', label: '待处理', value: '312', delta: '↑ 8.2%', period: '较上周', icon: 'CircleDotDashed' },
  { id: 'processing', label: '处理中', value: '214', delta: '↑ 6.7%', period: '较上周', icon: 'LoaderCircle' },
  { id: 'completed', label: '已完成', value: '689', delta: '↑ 15.3%', period: '较上周', icon: 'CircleCheck' },
  { id: 'overdue', label: '逾期', value: '53', delta: '↑ 23.1%', period: '较上周', icon: 'TriangleAlert', warn: true },
] as const;

/** 十列合计 1001px，区域内没有左右额外内边距。 */
export const TASK_COLUMNS = [
  { id: 'select', label: '', width: 36 },
  { id: 'title', label: '任务标题', width: 240 },
  { id: 'type', label: '类型', width: 95 },
  { id: 'object', label: '关联对象', width: 130 },
  { id: 'owner', label: '责任人', width: 80 },
  { id: 'deadline', label: '截止时间', width: 100 },
  { id: 'remaining', label: '剩余', width: 80 },
  { id: 'state', label: '状态', width: 85 },
  { id: 'overdue', label: '逾期标记', width: 100 },
  { id: 'action', label: '操作', width: 55 },
] as const;

export interface TaskRow {
  id: string;
  title: string;
  type: string;
  object: string;
  owner: string;
  deadline: string;
  remaining: string;
  state: TaskState;
  /** 文案由后端三色灯口径产生；没有绿色健康灯。 */
  warningLight: 'BLUE' | 'YELLOW' | 'RED' | 'NONE';
  overdue: string;
}

export const TASK_ROWS: TaskRow[] = withCurrentDates([
  {
    id: 'TASK-2024-0612-001',
    title: 'AI课程《提示工程》内容审核',
    type: '课程审核',
    object: '提示工程',
    owner: '李玥',
    deadline: '2024-06-12',
    remaining: '剩余 2 天',
    state: '待处理',
    warningLight: 'BLUE',
    overdue: '即将到期 · 剩余 2 天',
  },
  {
    id: 'TASK-2024-0611-014',
    title: '智能客服需求调研结论录入',
    type: '需求跟进',
    object: '智能客服',
    owner: '陈晨',
    deadline: '2024-06-11',
    remaining: '剩余 1 天',
    state: '处理中',
    warningLight: 'BLUE',
    overdue: '即将到期 · 剩余 1 天',
  },
  {
    id: 'TASK-2024-0608-022',
    title: '大模型应用课程试讲记录补充',
    type: '试讲记录',
    object: '大模型应用',
    owner: '王航',
    deadline: '2024-06-08',
    remaining: '逾期 2 天',
    state: '处理中',
    warningLight: 'YELLOW',
    overdue: '已逾期 · 逾期 2 天',
  },
  {
    id: 'TASK-2024-0605-031',
    title: '销售预测案例总结报告更新',
    type: '报告更新',
    object: '销售预测',
    owner: '周敏',
    deadline: '2024-06-05',
    remaining: '逾期 5 天',
    state: '待处理',
    warningLight: 'RED',
    overdue: '状态停滞 · 停滞 5 天',
  },
  {
    id: 'TASK-2024-0603-041',
    title: '数据分析训练营签到归档',
    type: '培训归档',
    object: '数据分析训练营',
    owner: '张小北',
    deadline: '2024-06-03',
    remaining: '已完成',
    state: '已完成',
    warningLight: 'NONE',
    overdue: '—',
  },
  // 产品模式表格区按设计比拉高；仅 5 行会在表体与分页之间留出大块白，补满一屏密度。
  // 预警灯仍保持前 4 条有灯（P07 断言 warning=4），新增行一律 NONE。
  {
    id: 'TASK-2024-0602-052',
    title: '提示工程课程材料版本核对',
    type: '课程审核',
    object: '提示工程',
    owner: '李玥',
    deadline: '2024-06-15',
    remaining: '剩余 5 天',
    state: '待处理',
    warningLight: 'NONE',
    overdue: '—',
  },
  {
    id: 'TASK-2024-0601-063',
    title: '企业 AI 治理需求出口确认',
    type: '需求跟进',
    object: 'AI 治理',
    owner: '陈晨',
    deadline: '2024-06-14',
    remaining: '剩余 4 天',
    state: '处理中',
    warningLight: 'NONE',
    overdue: '—',
  },
  {
    id: 'TASK-2024-0530-074',
    title: '讲师池本周入池名单复核',
    type: '讲师跟进',
    object: '讲师池',
    owner: '王航',
    deadline: '2024-06-13',
    remaining: '剩余 3 天',
    state: '待处理',
    warningLight: 'NONE',
    overdue: '—',
  },
  {
    id: 'TASK-2024-0528-085',
    title: '培训场次反馈录入补齐',
    type: '培训归档',
    object: '沟通技巧专场',
    owner: '周敏',
    deadline: '2024-06-10',
    remaining: '已完成',
    state: '已完成',
    warningLight: 'NONE',
    overdue: '—',
  },
  {
    id: 'TASK-2024-0525-096',
    title: '案例《销售预测》互动数据更新',
    type: '报告更新',
    object: '销售预测',
    owner: '张小北',
    deadline: '2024-06-09',
    remaining: '已关闭',
    state: '已关闭',
    warningLight: 'NONE',
    overdue: '—',
  },
]);

/** 选中任务的编号，平移前的原值。两处导出都从它派生，避免同一个编号被平移两次 */
const SELECTED_TASK_ID_FROZEN = 'TASK-2024-0612-001';

export const TASK_SELECTED_ID = withCurrentDates(SELECTED_TASK_ID_FROZEN);

export const TASK_FILTERS = [
  { id: 'type', label: '任务类型' },
  { id: 'state', label: '任务状态' },
  { id: 'light', label: '预警灯' },
  { id: 'range', label: '截止日期' },
] as const;

export const TASK_WEEKLY_FOCUS = withCurrentDates([
  { rank: 1, title: '完成重点课程的内容审核', owner: '李玥', deadline: '06-12', state: '待处理' },
  { rank: 2, title: '补齐大模型应用试讲记录', owner: '王航', deadline: '已逾期', state: '处理中' },
  { rank: 3, title: '更新销售预测案例总结报告', owner: '周敏', deadline: '已逾期', state: '待处理' },
] as const);

export const TASK_DETAIL = withCurrentDates({
  id: SELECTED_TASK_ID_FROZEN,
  title: 'AI课程《提示工程》内容审核',
  state: TASK_ROWS[0]!.state,
  createdAt: '2024-06-10 10:30',
  fields: [
    { label: '任务类型', value: '课程审核' },
    { label: '关联对象', value: '课程 · 提示工程' },
    { label: '责任人', value: '李玥' },
    { label: '截止时间', value: '2024-06-12' },
  ],
  description:
    '请核对课程目标、教学材料与课程大纲是否一致，并记录线下审核结论。重点核对提示词示例是否覆盖业务场景，以及自检清单是否齐备。',
  source: { label: '课程 · 提示工程', id: 'KC-2024-0518' },
  timeline: [
    { at: '2024-06-10 10:30', text: '系统派生任务，状态「待处理」' },
    { at: '2024-06-10 11:05', text: '已指派给 李玥' },
  ],
  deriveRule: '课程进入「评审决策」后派生内容审核任务；完成后回写评审记录，逾期超过 3 天记黄灯。',
  comments: [
    { name: '陈晨', at: '2024-06-10 10:20', text: '课程材料已补齐，等待审核意见。' },
    { name: '李玥', at: '2024-06-09 16:42', text: '已开始核对课程大纲与讲义。' },
  ],
} as const);
