import { useQuery } from '@tanstack/react-query';
import { FIELD_ENUM_KEYS, metaApi } from '@/shared/api/meta';
import { configApi } from '@/shared/api/config';
import {
  DICT_KEYS,
  META_STALE_TIME,
  selectOptions,
  useDicts,
  useEmployees,
  useFieldEnums,
  useMachines,
  useStates,
} from '@/shared/meta/metaHooks';

/**
 * 课程页面用到的全部下拉选项，集中在这里取。
 *
 * <p><b>没有一个取值是前端写死的</b>（纪律 STK-1）：状态与动作来自 {@code /api/meta/enums}，
 * 字段枚举来自 {@code /api/meta/field-enums}，作战单元与课程分类来自字典，人员来自人员台账。
 *
 * <p>通用的那几个 hooks 已抽到 {@code shared/meta/metaHooks}（需求驾驶舱用的是同一批数据，
 * 各存一份会让缓存键分叉）。这里原样再导出，课程页面的调用点不变。
 */

export const COURSE_OBJECT_TYPE_CODE = 'COURSE';

/**
 * 五个状态<b>字段名</b>，与后端 {@code CourseStateMachines.FIELD_*} 一致。
 *
 * <p>字段名是状态机的对外契约（转换接口的 {@code stateField} 入参），不是状态值——
 * 纪律 STK-1 禁止的是前端手写状态<b>值</b>。写错字段名的症状是「状态字段 xxx 不存在」，
 * 当场就能发现；即便如此也只在这里写一次。
 */
export const COURSE_STATE_FIELDS = {
  main: '课程主状态',
  dev: '课程开发状态',
  selfcheck: '课程自检状态',
  trial: '试讲状态',
  publish: '课程发布状态',
} as const;

export function useMaterialTypes() {
  return useQuery({
    queryKey: ['meta', 'material-types'],
    queryFn: () => metaApi.materialTypes(),
    staleTime: META_STALE_TIME,
  });
}

/**
 * 说明必填性的三档取值（无 / 选填 / 必填），取自后端而不是在前端写死。
 *
 * <p>下发的是一个有序数组，顺序即后端 {@code SelfcheckItem.NOTE_REQUIREMENTS} 的定义顺序：
 * 无、选填、必填。按下标取而不是按字面量比较，是为了让「必填」这三个字只存在于后端一处。
 */
export function useNoteRequirements() {
  const query = useQuery({
    queryKey: ['config', 'note-requirements'],
    queryFn: () => configApi.noteRequirements(),
    staleTime: META_STALE_TIME,
  });
  const values = query.data ?? [];
  return { none: values[0], optional: values[1], required: values[2] };
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
