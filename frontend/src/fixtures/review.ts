/**
 * P09 评审记录中心的冻结数据（《设计文档 V2.0》第 13 章）。
 *
 * 默认页签刻意是「试讲记录」，而不是设计稿上标注的「课程评审记录」：
 * 默认选中行是试讲记录，必须让表格、选中态与下方详情来自同一条数据。
 *
 * 设计稿里的「待定」不能进冻结数据（STK-1／V-7）；课程评审样例用「不通过」，
 * 试讲结论只用「合格／不合格」。
 */

export const REVIEW_TABS = ['课程评审记录', '试讲记录', '需求评审'] as const;
export type ReviewTab = (typeof REVIEW_TABS)[number];

export const REVIEW_DEFAULT_TAB: ReviewTab = '试讲记录';
export const REVIEW_SELECTED_ID = 'trial-workplace-communication';
export const REVIEW_COLUMNS = [
  { id: 'select', label: '选择', width: 46 },
  { id: 'name', label: '名称', width: 240 },
  { id: 'round', label: '轮次', width: 150 },
  { id: 'version', label: '版本', width: 100 },
  { id: 'date', label: '评审日期', width: 165 },
  { id: 'result', label: '评审结果', width: 220 },
  { id: 'operator', label: '录入人', width: 120 },
  { id: 'consistent', label: '结论一致', width: 140 },
  { id: 'action', label: '操作', width: 129 },
] as const;

export const REVIEW_KPIS = [
  { id: 'course', label: '本月课程评审数', value: '512' },
  { id: 'trial', label: '本月试讲验收数', value: '328' },
  { id: 'demand', label: '需求评审数', value: '186' },
  { id: 'pending', label: '待录入结论', value: '12' },
] as const;

export interface ReviewRecord {
  id: string;
  type: ReviewTab;
  name: string;
  round: string;
  version: string;
  reviewedAt: string;
  result: string;
  operator: string;
  lecturerConclusion?: string;
  courseConclusion?: string;
  score?: string;
  opinion: string;
}

export const REVIEW_RECORDS: ReviewRecord[] = [
  {
    id: 'trial-workplace-communication',
    type: '试讲记录',
    name: '职场高效沟通技巧（试讲）',
    round: '第 2 轮试讲',
    version: 'V1.0',
    reviewedAt: '2024-06-10',
    result: '讲师：合格 / 课程：不合格',
    operator: '张小北',
    lecturerConclusion: '合格',
    courseConclusion: '不合格',
    score: '讲师 86 / 课程 64',
    opinion: '讲师表现达到试讲要求，但课程案例与互动设计不足，需完善后重新提交课程结论。',
  },
  {
    id: 'trial-prompt-engineering',
    type: '试讲记录',
    name: 'AI提示词工程实战',
    round: '第 1 轮试讲',
    version: 'V2.1',
    reviewedAt: '2024-06-08',
    result: '讲师：合格 / 课程：合格',
    operator: '李华',
    lecturerConclusion: '合格',
    courseConclusion: '合格',
    score: '讲师 92 / 课程 90',
    opinion: '结构清晰，案例完整，可进入后续课程发布流程。',
  },
  {
    id: 'trial-data-visualization',
    type: '试讲记录',
    name: '数据分析思维与可视化',
    round: '第 1 轮试讲',
    version: 'V1.2',
    reviewedAt: '2024-06-06',
    result: '讲师：不合格 / 课程：不合格',
    operator: '张小北',
    lecturerConclusion: '不合格',
    courseConclusion: '不合格',
    score: '讲师 58 / 课程 61',
    opinion: '表达节奏与实操深度均需改进，建议完成辅导后再次试讲。',
  },
  {
    id: 'trial-training-evaluation',
    type: '试讲记录',
    name: '企业内训效果评估模型',
    round: '第 3 轮试讲',
    version: 'V1.0',
    reviewedAt: '2024-06-03',
    result: '讲师：不合格 / 课程：不合格',
    operator: '王敏',
    lecturerConclusion: '不合格',
    courseConclusion: '不合格',
    score: '讲师 62 / 课程 59',
    opinion: '评估模型与案例之间的对应关系仍不清晰，建议补充演练材料。',
  },
  {
    id: 'course-ai-governance',
    type: '课程评审记录',
    name: '企业 AI 治理实践',
    round: '第 2 轮评审',
    version: 'V3.0',
    reviewedAt: '2024-06-09',
    result: '不通过',
    operator: '李华',
    opinion: '内容边界需要进一步明确。',
  },
  {
    id: 'demand-knowledge-base',
    type: '需求评审',
    name: '智能知识库建设需求',
    round: '业务评审',
    version: 'V1.0',
    reviewedAt: '2024-06-07',
    result: '通过',
    operator: '王敏',
    opinion: '需求范围和验收口径已确认。',
  },
];
