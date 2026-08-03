/**
 * P08 的冻结数据。界面标题保留「消息中心」，但这里与页面业务字段一律使用
 * escalation：一期只记录催办对象、内容、时间，不存在消息渠道、送达或已读状态。
 */
export type EscalationLight = 'BLUE' | 'YELLOW' | 'RED';
export type EscalationSource = '系统生成清单' | '运营手动';

export interface EscalationRecord {
  id: string;
  objectName: string;
  owner: string;
  node: string;
  light: EscalationLight;
  lightLabel: string;
  urgedAt: string;
  content: string;
  source: EscalationSource;
  pending?: boolean;
}

export const ESCALATION_TABS = [
  { id: 'all', label: '全部记录' },
  { id: 'pending', label: '待发送清单' },
  { id: 'week', label: '本周台账' },
  { id: 'manual', label: '手动催办' },
] as const;

export type EscalationTabId = (typeof ESCALATION_TABS)[number]['id'];

export const ESCALATION_RECORDS: readonly EscalationRecord[] = [
  {
    id: 'esc-001',
    objectName: '课程《Prompt工程实战》',
    owner: '张敏',
    node: '培训即将到期',
    light: 'YELLOW',
    lightLabel: '需要关注 · 剩余 3 天',
    urgedAt: '2024-06-10 09:20',
    content: '课程有效期即将到期，请确认续期安排并补充后续培训计划。',
    source: '系统生成清单',
  },
  {
    id: 'esc-002',
    objectName: 'AI需求「智能质检助手」',
    owner: '王芳',
    node: '评审决策',
    light: 'RED',
    lightLabel: '状态停滞 · 停滞 5 天',
    urgedAt: '2024-06-10 08:45',
    content: '评审结论尚未记录，请在完成线下评审后补录结果。',
    source: '系统生成清单',
  },
  {
    id: 'esc-003',
    objectName: '培训计划「新员工AI基础」',
    owner: '李昕',
    node: '待导入签到',
    light: 'YELLOW',
    lightLabel: '需要关注 · 剩余 1 天',
    urgedAt: '2024-06-09 16:30',
    content: '培训已结束，请导入签到记录以完成场次归档准备。',
    source: '运营手动',
  },
  {
    id: 'esc-004',
    objectName: '课程《数据分析入门》',
    owner: '陈浩',
    node: '课程开发',
    light: 'BLUE',
    lightLabel: '正常运行',
    urgedAt: '2024-06-09 11:10',
    content: '请同步课程材料准备进度，便于运营更新开发台账。',
    source: '运营手动',
    pending: true,
  },
  {
    id: 'esc-005',
    objectName: '案例「智能合同审查」',
    owner: '刘洋',
    node: '待审核',
    light: 'RED',
    lightLabel: '已逾期 · 逾期 2 天',
    urgedAt: '2024-06-08 14:00',
    content: '案例已进入待审核节点，请完成线下审核并录入结果。',
    source: '系统生成清单',
    pending: true,
  },
] as const;

export const ESCALATION_SELECTED_ID = 'esc-001';

export const ESCALATION_KPIS = [
  { id: 'pending', label: '待发送清单', value: '8' },
  { id: 'recordedToday', label: '今日已记台账', value: '128' },
  { id: 'objects', label: '涉及对象', value: '3' },
  { id: 'blocked', label: '防重复拦截', value: '1' },
] as const;

export function escalationCount(tab: EscalationTabId): number {
  if (tab === 'pending') return ESCALATION_RECORDS.filter((record) => record.pending).length;
  if (tab === 'manual') return ESCALATION_RECORDS.filter((record) => record.source === '运营手动').length;
  if (tab === 'week') return ESCALATION_RECORDS.length;
  return ESCALATION_RECORDS.length;
}
