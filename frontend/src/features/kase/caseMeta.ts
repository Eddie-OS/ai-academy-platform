import { FIELD_ENUM_KEYS } from '@/shared/api/meta';
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
 * 应用领域来自「作战单元」字典。
 */

/** 案例状态机的对象类型码与状态字段名，与后端 {@code CaseStateMachines} 一致。 */
export const CASE_OBJECT_TYPE = 'CASE';
export const CASE_STATE_FIELD = '案例状态';

/** 应用领域取自「作战单元」字典（需求 12.3 第 6 项），与课程的所属领域同一套。 */
export function useCaseDomains() {
  const dicts = useDicts();
  return dicts.data?.[DICT_KEYS.combatUnit] ?? [];
}

/**
 * 领域编码 → 名称。
 *
 * <p>案例存的是<b>编码</b>而不是名称（与讲师擅长领域相反，那边存名称）：案例的领域来自课程的
 * {@code domain_code}，两边不一致会让同一个筛选条件下的案例互相看不见。展示时统一在这里翻译，
 * 查不到的编码原样显示——藏起来只会让「字典里删了一项」这件事无声无息。
 */
export function useDomainNames(): (code: string) => string {
  const domains = useCaseDomains();
  return (code: string) => domains.find((item) => item.code === code)?.name ?? code;
}

export { FIELD_ENUM_KEYS, DICT_KEYS, selectOptions, useDicts, useEmployees, useFieldEnums, useMachines, useStates };
