/**
 * P08 的冻结数据。界面标题保留「消息中心」，但这里与页面业务字段一律使用
 * escalation：一期只记录催办对象、内容、时间，不存在消息渠道、送达或已读状态。
 *
 * <p>设计稿 V2.0 P08 画过站内信收件箱；业务裁决沿用三栏几何，内容改催办台账（V-1／MSG1）。
 */

import { withCurrentDates } from './fixtureClock';
export type EscalationLight = 'BLUE' | 'YELLOW' | 'RED';
export type EscalationSource = '系统生成清单' | '运营手动';
/** 列表左侧类型图标，仅展示用 */
export type EscalationObjectKind = 'course' | 'demand' | 'training' | 'kase' | 'other';

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
  kind: EscalationObjectKind;
  pending?: boolean;
}

export const ESCALATION_TABS = [
  { id: 'all', label: '全部记录' },
  { id: 'pending', label: '待催办清单' },
  { id: 'week', label: '本周台账' },
  { id: 'manual', label: '手动催办' },
] as const;

export type EscalationTabId = (typeof ESCALATION_TABS)[number]['id'];

export const ESCALATION_RECORDS: readonly EscalationRecord[] = withCurrentDates([
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
    kind: 'course',
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
    kind: 'demand',
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
    kind: 'training',
  },
  {
    id: 'esc-004',
    objectName: '课程《数据分析入门》',
    owner: '陈浩',
    node: '课程开发',
    light: 'BLUE',
    lightLabel: '即将到期 · 剩余 6 天',
    urgedAt: '2024-06-09 11:10',
    content: '请同步课程材料准备进度，便于运营更新开发台账。',
    source: '运营手动',
    kind: 'course',
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
    kind: 'kase',
    pending: true,
  },
  // 产品模式主区按 711 行高拉满；仅 5 行会在列表底部留白。补密度行，且不改
  // pending／运营手动 的条数（P08 页签筛选断言仍是 2）。
  {
    id: 'esc-006',
    objectName: '课程《职场高效沟通技巧》',
    owner: '张小北',
    node: '试讲验收',
    light: 'BLUE',
    lightLabel: '即将到期 · 剩余 8 天',
    urgedAt: '2024-06-08 10:15',
    content: '试讲结论已线下确认，请补录双结论以便推进后续发布。',
    source: '系统生成清单',
    kind: 'course',
  },
  {
    id: 'esc-007',
    objectName: 'AI需求「知识库问答」',
    owner: '李华',
    node: '业务验收',
    light: 'YELLOW',
    lightLabel: '需要关注 · 剩余 4 天',
    urgedAt: '2024-06-07 15:40',
    content: '验收材料尚未齐套，请与业务方确认补充清单。',
    source: '系统生成清单',
    kind: 'demand',
  },
  {
    id: 'esc-008',
    objectName: '培训场次「提示工程专场」',
    owner: '王敏',
    node: '待归档',
    light: 'BLUE',
    lightLabel: '即将到期 · 剩余 5 天',
    urgedAt: '2024-06-07 09:05',
    content: '场次反馈已收集，请完成归档字段录入。',
    source: '系统生成清单',
    kind: 'training',
  },
] as const);

export const ESCALATION_SELECTED_ID = 'esc-001';

export const ESCALATION_KPIS = [
  { id: 'pending', label: '待催办清单', value: '8', delta: '+2', period: '较昨日', tone: 'info' },
  { id: 'recordedToday', label: '今日已记台账', value: '128', delta: '+18%', period: '较昨日', tone: 'success' },
  { id: 'objects', label: '涉及对象', value: '3', delta: '—', period: '较昨日', tone: 'brand' },
  { id: 'blocked', label: '防重复拦截', value: '1', delta: '-1', period: '较昨日', tone: 'warning' },
] as const;

/**
 * 右侧「系统催办摘要」四行——对齐目标稿右侧中卡的分类块视觉，
 * 语义仍是催办维度（不是作业批改／证书审核等消息中心旧稿）。
 */
export const ESCALATION_DIGEST_GROUPS = [
  { id: 'yellow', label: '黄灯待跟进', count: 3, tone: 'warning' },
  { id: 'red', label: '红灯已逾期', count: 2, tone: 'danger' },
  { id: 'blue', label: '蓝灯即将到期', count: 3, tone: 'info' },
  { id: 'manual', label: '手动催办待复核', count: 2, tone: 'brand' },
] as const;

export function escalationCount(tab: EscalationTabId): number {
  if (tab === 'pending') return ESCALATION_RECORDS.filter((record) => record.pending).length;
  if (tab === 'manual') return ESCALATION_RECORDS.filter((record) => record.source === '运营手动').length;
  if (tab === 'week') return ESCALATION_RECORDS.length;
  return ESCALATION_RECORDS.length;
}

export function inferEscalationKind(objectName: string): EscalationObjectKind {
  if (objectName.includes('课程') || objectName.includes('《')) return 'course';
  if (objectName.includes('需求') || objectName.includes('「')) return 'demand';
  if (objectName.includes('培训') || objectName.includes('场次')) return 'training';
  if (objectName.includes('案例')) return 'kase';
  return 'other';
}
