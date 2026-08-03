import { api } from './client';

/**
 * 统一状态转换接口（《开发实施文档》7.4）。
 *
 * <p>15 个状态机共用这三个接口，前端<b>不为任何一个动作单独写请求函数</b>——那会让「新增一条
 * 转换」变成前后端各改一处。页面按 {@link ObjectStateView} 渲染，动作码从后端给的对照表里取
 * （纪律 STK-1：前端不手写状态值与动作码）。
 */

export interface ActionOption {
  action: string;
  label: string;
  toState: string;
}

export interface FieldAvailability {
  stateField: string;
  machineName: string;
  currentState: string | null;
  /** 终态。前端据此判断「已结束」，不自己列举状态名 */
  terminal: boolean;
  /** 当前可执行动作的中文名，直接喂给 ActionGuard */
  allowedActions: string[];
  blockedActions: Array<{ action: string; reason: string }>;
  actions: ActionOption[];
}

export interface ObjectStateView {
  objectType: string;
  objectId: number;
  /** 乐观锁版本号；只有需求、课程、案例三类对象有（规则 K1） */
  version: number | null;
  fields: FieldAvailability[];
}

export interface TransitResponse {
  stateField: string;
  fromState: string | null;
  toState: string;
  action: string;
  actionLabel: string;
}

export interface StateLogRow {
  stateField: string;
  fromState: string | null;
  toState: string;
  actionCode: string;
  /** OPS = 运营手动，SYSTEM = 随主状态自动置位。界面必须把两者区分开 */
  accountType: 'OPS' | 'SYSTEM';
  changedAt: string;
  remark: string | null;
}

export const transitionApi = {
  available: (objectType: string, id: number) =>
    api.get<ObjectStateView>(`/api/${objectType}/${id}/transitions/available`),

  transit: (
    objectType: string,
    id: number,
    body: { stateField: string; action: string; version?: number | null; remark?: string | null },
  ) => api.post<TransitResponse>(`/api/${objectType}/${id}/transitions`, body),

  stateLogs: (objectType: string, id: number) =>
    api.get<StateLogRow[]>(`/api/${objectType}/${id}/state-logs`),
};

/** 在某个状态字段上找「能走到目标状态」的动作。状态地图拖动卡片时用它判定合法性。 */
export function actionTo(field: FieldAvailability | undefined, toState: string): ActionOption | null {
  if (!field) {
    return null;
  }
  return (
    field.actions.find(
      (option) => option.toState === toState && field.allowedActions.includes(option.label),
    ) ?? null
  );
}

export function fieldOf(view: ObjectStateView | undefined, stateField: string): FieldAvailability | undefined {
  return view?.fields.find((field) => field.stateField === stateField);
}

/**
 * 按动作码找「当前可执行」的动作，找不到返回 null。
 *
 * <p>录入类页签（评审结论、验收结论）用它决定录入入口显不显示：<b>入口的显隐与状态区的按钮
 * 出自同一份 available 数据</b>，前端不另写一套「什么时候能录」的判断——那套判断就是需求第 5 章
 * 转换表的第二份拷贝。
 */
export function allowedAction(field: FieldAvailability | undefined, action: string): ActionOption | null {
  if (!field) {
    return null;
  }
  const option = field.actions.find((item) => item.action === action);
  return option && field.allowedActions.includes(option.label) ? option : null;
}

/** 该动作当前被状态挡住的原因。后端没提到这个动作时为 null（此时它不该被渲染）。 */
export function blockedReason(field: FieldAvailability | undefined, action: string): string | null {
  const option = field?.actions.find((item) => item.action === action);
  if (!field || !option) {
    return null;
  }
  return field.blockedActions.find((item) => item.action === option.label)?.reason ?? null;
}
