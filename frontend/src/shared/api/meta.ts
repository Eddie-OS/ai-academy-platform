import { api } from './client';

/**
 * 枚举与字典下发（开发实施文档 7.5）。
 *
 * <p>这是纪律 STK-1 在运行期的一半：状态值、动作名、字典项<b>全部从后端取</b>，
 * 前端不维护第二份。状态筛选下拉的选项顺序也照后端给的顺序渲染——那个顺序是转换表的
 * 出现顺序，即业务流程顺序，比按字典序排更贴近使用者的理解。
 */

export interface ActionMeta {
  action: string;
  label: string;
  from: string | null;
  to: string;
}

export interface MachineMeta {
  machineName: string;
  objectType: string;
  stateField: string;
  states: string[];
  /** 终态集合。前端用它决定「已结束」类样式，不自己列举状态名 */
  terminalStates: string[];
  actions: ActionMeta[];
}

export interface DictOption {
  code: string;
  name: string;
  parentCode: string | null;
}

export interface ThresholdMeta {
  objectType: string;
  blueDays: number;
  redDays: number;
  expectFinishField: string;
}

/** 课程材料类型与各自的单文件上限（规则 F1）。上限由后端给，前端不抄。 */
export interface MaterialTypeMeta {
  materialType: string;
  scene: string;
  maxBytes: number;
  maxSizeText: string;
}

export const metaApi = {
  enums: () => api.get<MachineMeta[]>('/api/meta/enums'),
  dicts: () => api.get<Record<string, DictOption[]>>('/api/meta/dicts'),
  /** 非状态机的字段枚举：评审轨道、有效期时长、评审结果、试讲结论、验收标准…… */
  fieldEnums: () => api.get<Record<string, string[]>>('/api/meta/field-enums'),
  materialTypes: () => api.get<MaterialTypeMeta[]>('/api/meta/material-types'),
  thresholds: () => api.get<ThresholdMeta[]>('/api/meta/thresholds'),
};

/**
 * 枚举名常量。<b>这些是枚举的「键」不是「值」</b>——键要与需求文档的字段名对齐才能人工对账，
 * 值（如「内部端到端课程」）一律来自后端。
 */
export const FIELD_ENUM_KEYS = {
  demandSource: '需求来源',
  demandType: '需求类型',
  demandDomain: '需求所属领域',
  demandPriority: '需求优先级',
  demandOutlet: '需求分流出口',
  demandReviewConclusion: '需求评审结论',
  demandAcceptanceResult: '需求验收结论',
  solutionPendingOutput: '解决方案待输出',
  deliveryUndelivered: '需求未交付展示',
  reviewTrack: '课程评审轨道',
  validityPeriod: '课程有效期',
  validityStatus: '课程有效期状态',
  qualityMark: '课程精品标注',
  materialType: '课程材料类型',
  versionStatus: '课程版本状态',
  enterSelfCheck: '是否进入课程自检',
  submitExpertReview: '是否提交专家评审',
  meetsRequirement: '是否符合要求',
  reviewRound: '课程评审轮数',
  enterTrial: '是否进入试讲环节',
  enterMeeting: '是否进入上会评审环节',
  trialReadyToPublish: '课程是否满足发布要求',
  trialLecturerQualified: '讲师试讲是否合格',
  reviewForm: '课程评审形式',
  reviewResult: '课程评审结果',
  trialConclusion: '试讲结论',
  acceptanceCheckPrefix: '试讲验收标准·',
  lecturerTrainingState: '讲师培养状态',
  lecturerPoolState: '讲师在池状态',
  lecturerJoinType: '讲师入池方式',
  lecturerLevel: '讲师等级',
  lecturerDutyState: '讲师上岗状态',
  caseAuditResult: '案例审核结论',
  caseQualityMark: '案例精品标注',
  caseBoardSort: '案例看板排序',
  caseReportGenerateMode: '总结报告生成方式',
  /** 三色灯 API 码 BLUE／YELLOW／RED／NONE（与 calc_light 一致） */
  light: '灯色',
} as const;
