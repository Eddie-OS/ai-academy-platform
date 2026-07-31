import { api } from './client';

/**
 * 配置中心接口（需求 13.9，四个 Tab）。类型与后端 record 逐字段对齐，
 * 手写原因同 {@link ./imports.ts} 顶部说明（离线环境暂无法跑 OpenAPI 生成）。
 */

export interface ThresholdRow {
  id: number;
  objectType: string;
  blueDays: number;
  redDays: number;
  /** 「预计完成时间」在该对象上对应的字段名，界面要显示出来（需求 13.9.2） */
  expectFinishField: string;
  updatedAt: string | null;
  updatedBy: string | null;
}

export interface DictItem {
  id: number;
  dictType: string;
  itemCode: string;
  itemName: string;
  parentCode: string | null;
  seqNo: number;
  enabled: boolean;
  updatedAt: string | null;
  updatedBy: string | null;
}

export interface SelfcheckItem {
  id: number;
  groupName: string;
  seq: number;
  itemText: string;
  /** 无 / 选填 / 必填。取值来自后端，前端只做展示与下拉 */
  noteRequirement: string;
  guideText: string | null;
  /** 锁定条目不允许停用（需求 9.4.1 列明的 5 条），但允许改文案 */
  locked: boolean;
  enabled: boolean;
  updatedAt: string | null;
  updatedBy: string | null;
}

export interface DeriveRuleRow {
  id: number;
  taskType: string;
  titleTemplate: string;
  ownerSource: string;
  dueBaseLabel: string;
  dueOffsetDays: number | null;
  /** 截止日取自对象字段（如课程的期望上线日），此时不填默认天数 */
  fixedByObjectField: boolean;
  enabled: boolean;
  updatedAt: string | null;
  updatedBy: string | null;
}

export interface DictItemForm {
  itemCode: string;
  itemName: string;
  parentCode?: string | null;
  seqNo: number;
  enabled: boolean;
}

export interface SelfcheckItemForm {
  groupName: string;
  seq: number;
  itemText: string;
  noteRequirement: string;
  guideText?: string | null;
  enabled: boolean;
}

export interface DictTypeOption {
  dictType: string;
  /** 课程分类有二级结构，作战单元是平的：决定「上级分类」列与表单项是否出现 */
  hierarchical: boolean;
}

export const configApi = {
  thresholds: () => api.get<ThresholdRow[]>('/api/config/thresholds'),
  updateThreshold: (id: number, blueDays: number, redDays: number) =>
    api.put<void>(`/api/config/thresholds/${id}`, { blueDays, redDays }),

  dictTypes: () => api.get<DictTypeOption[]>('/api/config/dicts'),
  dictItems: (dictType: string) =>
    api.get<DictItem[]>(`/api/config/dicts/${encodeURIComponent(dictType)}/items`),
  createDictItem: (dictType: string, form: DictItemForm) =>
    api.post<number>(`/api/config/dicts/${encodeURIComponent(dictType)}/items`, form),
  updateDictItem: (id: number, form: DictItemForm) => api.put<void>(`/api/config/dicts/items/${id}`, form),
  deleteDictItem: (id: number) => api.delete<void>(`/api/config/dicts/items/${id}`),

  selfcheckItems: () => api.get<SelfcheckItem[]>('/api/config/selfcheck-items'),
  noteRequirements: () => api.get<string[]>('/api/config/selfcheck-items/note-requirements'),
  createSelfcheckItem: (form: SelfcheckItemForm) => api.post<number>('/api/config/selfcheck-items', form),
  updateSelfcheckItem: (id: number, form: SelfcheckItemForm) =>
    api.put<void>(`/api/config/selfcheck-items/${id}`, form),
  deleteSelfcheckItem: (id: number) => api.delete<void>(`/api/config/selfcheck-items/${id}`),

  taskDeriveRules: () => api.get<DeriveRuleRow[]>('/api/config/task-derive-rules'),
  updateTaskDeriveRule: (
    id: number,
    form: { titleTemplate: string; dueOffsetDays: number | null; enabled: boolean },
  ) => api.put<void>(`/api/config/task-derive-rules/${id}`, form),
};
