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
 * 两个分流出口（需求 5.2.2）。
 *
 * <p>界面要按出口决定显示哪一组字段（需求 8.3.3 的界面动态显示规则：出口一显示 21–23，
 * 出口二显示 24–27），因此前端必须能区分这两个值。<b>按下标取而不是按字面量比较</b>——
 * 下发数组的顺序即后端 {@code DemandEnums.OUTLETS} 的定义顺序，出口一在前、出口二在后。
 * 把「用现有工具输出解决方案」这十一个字抄进前端，等于在前端建了第二处枚举定义（STK-1）。
 *
 * <p>数据还没到时两个值都是 undefined，此时与任何出口都不相等，界面按「出口为空」渲染——
 * 这正是想要的：宁可少显示一组字段，也不要在元数据到位前把出口二的字段显示成出口一的。
 */
export function useOutlets(): { solution?: string; development?: string } {
  const enums = useFieldEnums();
  const values = enums.data?.[FIELD_ENUM_KEYS.demandOutlet] ?? [];
  return { solution: values[0], development: values[1] };
}

export {
  DICT_KEYS,
  FIELD_ENUM_KEYS,
  selectOptions,
  useDicts,
  useEmployees,
  useFieldEnums,
  useMachines,
  useStates,
};
