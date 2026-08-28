import { FIELD_ENUM_KEYS } from '@/shared/api/meta';
import { BUSINESS_DOMAIN_VALUES, useBusinessDomains, useDomainLabel } from '@/shared/meta/domains';
import {
  DICT_KEYS,
  selectOptions,
  useDicts,
  useEmployees,
  useFieldEnums,
  useMachines,
  useStates,
  useTerminalStates,
} from '@/shared/meta/metaHooks';

/**
 * AI需求页面用到的全部下拉选项与状态字段名，集中在这里取。
 *
 * <p>取数 hooks 与课程驾驶舱共用（{@code shared/meta/metaHooks}），这里只放需求特有的两件事：
 * 五个状态字段名，以及两个「要按业务含义分支」的枚举取值。
 */

export const DEMAND_OBJECT_TYPE_CODE = 'DEMAND';

/**
 * 五个状态<b>字段名</b>，与后端 {@code DemandStateMachines.FIELD_*} 一致。
 *
 * <p>字段名是状态机的对外契约（转换接口的 {@code stateField} 入参），不是状态值——
 * 纪律 STK-1 禁止的是前端手写状态<b>值</b>。写错字段名当场就会报「状态字段 xxx 不存在」，
 * 即便如此也只在这里写一次。
 */
export const DEMAND_STATE_FIELDS = {
  review: '需求评审状态',
  solution: '解决方案状态',
  dev: '需求开发状态',
  acceptance: '业务验收状态',
  deliveryMark: '需求交付标记',
} as const;

/**
 * 分流出口（需求 5.2.2 + 现场口径 D-20）。
 *
 * <p>界面要按出口决定显示哪一组字段（需求 8.3.3：出口一显示 21–23，出口二显示 24–27；
 * 出口三「需求驳回」两组都不显示）。<b>按下标取而不是按字面量比较</b>——
 * 下发数组的顺序即后端 {@code DemandEnums.OUTLETS}：出口一、出口二、需求驳回。
 *
 * <p>数据还没到时三个值都是 undefined，此时与任何出口都不相等，界面按「出口为空」渲染——
 * 这正是想要的：宁可少显示一组字段，也不要在元数据到位前把出口二的字段显示成出口一的。
 */
/**
 * 需求所属领域（现场口径 D-21），与后端 {@code DemandEnums.DOMAINS} 同序。
 *
 * <p>优先用 {@code /api/meta/field-enums} 的「需求所属领域」。旧进程还没下发这个键时，
 * 表单不能只剩「手动输入」——那是哨兵，不是领域。
 */
export const DEMAND_DOMAIN_VALUES = BUSINESS_DOMAIN_VALUES;

export function useDemandDomains(): string[] {
  return useBusinessDomains();
}

export function useOutlets(): { solution?: string; development?: string; reject?: string } {
  const enums = useFieldEnums();
  const values = enums.data?.[FIELD_ENUM_KEYS.demandOutlet] ?? [];
  return { solution: values[0], development: values[1], reject: values[2] };
}

/**
 * 评审结论下拉。顺序与分流出口相同：解决方案 / 需求开发 / 驳回。
 *
 * <p>旧数据的结论文案是自由文本，表单用出口按下标反推当前结论，避免手写三值。
 */
export function reviewConclusionValue(
  stored: string | null | undefined,
  outlet: string | null | undefined,
  conclusions: string[] | undefined,
  outlets: { solution?: string; development?: string; reject?: string },
): string | undefined {
  if (stored && conclusions?.includes(stored)) {
    return stored;
  }
  if (!outlet || !conclusions?.length) {
    return undefined;
  }
  if (outlet === outlets.solution) return conclusions[0];
  if (outlet === outlets.development) return conclusions[1];
  if (outlet === outlets.reject) return conclusions[2];
  return undefined;
}

export {
  DICT_KEYS,
  FIELD_ENUM_KEYS,
  selectOptions,
  useDicts,
  useDomainLabel,
  useEmployees,
  useFieldEnums,
  useMachines,
  useStates,
  useTerminalStates,
};
