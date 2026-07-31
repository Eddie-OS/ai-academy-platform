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

export const metaApi = {
  enums: () => api.get<MachineMeta[]>('/api/meta/enums'),
  dicts: () => api.get<Record<string, DictOption[]>>('/api/meta/dicts'),
  thresholds: () => api.get<ThresholdMeta[]>('/api/meta/thresholds'),
};
