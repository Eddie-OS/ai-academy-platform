import { FIELD_ENUM_KEYS } from '@/shared/api/meta';
import { useBusinessDomains, useDomainLabel } from '@/shared/meta/domains';
import {
  DICT_KEYS,
  selectOptions,
  useDicts,
  useEmployees,
  useFieldEnums,
  useMachines,
  useStates,
} from '@/shared/meta/metaHooks';

/**
 * 案例驾驶舱用到的元数据。
 *
 * <p>取值一个都不写死（纪律 STK-1）：案例状态来自 {@code /api/meta/enums} 的转换表，
 * 审核结论、精品标注、看板排序与报告生成方式来自 {@code /api/meta/field-enums}，
 * 应用领域与需求所属领域同一套（零售／MKT 等）。
 */

/** 案例状态机的对象类型码与状态字段名，与后端 {@code CaseStateMachines} 一致。 */
export const CASE_OBJECT_TYPE = 'CASE';
export const CASE_STATE_FIELD = '案例状态';

/** 应用领域与课程、需求同一套现场口径。 */
export function useCaseDomains() {
  return useBusinessDomains().map((domain) => ({ code: domain, name: domain, parentCode: null }));
}

/**
 * 领域编码 → 名称。现场口径下编码即名称；历史作战单元编码原样回退。
 */
export function useDomainNames(): (code: string) => string {
  const labelOf = useDomainLabel();
  return (code: string) => labelOf(code) ?? code;
}

export { FIELD_ENUM_KEYS, DICT_KEYS, selectOptions, useDicts, useEmployees, useFieldEnums, useMachines, useStates };
