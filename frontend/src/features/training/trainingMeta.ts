import { useQuery } from '@tanstack/react-query';
import { trainingApi } from '@/shared/api/trainings';
import {
  META_STALE_TIME,
  selectOptions,
  useEmployees,
  useFieldEnums,
  useMachines,
  useStates,
} from '@/shared/meta/metaHooks';

/**
 * 培训运营图页面用到的元数据。
 *
 * <p><b>没有一个取值是前端写死的</b>（纪律 STK-1）：状态来自 {@code /api/meta/enums}，
 * 培训形式与签到状态来自 {@code /api/meta/field-enums}，排课候选来自后端的
 * {@code scheduling-options}——「可上岗」「已发布」这两条过滤条件也不在前端。
 */

/** 对象类型码，与后端 {@code TrainingStateMachines.*_OBJECT_TYPE} 一致（用于匹配 /api/meta/enums）。 */
export const TRAINING_OBJECT_TYPE_CODES = {
  plan: 'TRAINING_PLAN',
  session: 'TRAINING_SESSION',
} as const;

/**
 * 两个状态<b>字段名</b>，与后端 {@code TrainingStateMachines.FIELD_*} 一致。
 *
 * <p>字段名是状态机的对外契约（转换接口的 {@code stateField} 入参），不是状态值——
 * 纪律 STK-1 禁止的是前端手写状态<b>值</b>。
 */
export const TRAINING_STATE_FIELDS = {
  plan: '培训计划状态',
  session: '培训场次状态',
} as const;

/**
 * 培训侧的字段枚举键。<b>这些是键不是值</b>，键与需求第 11 章的字段名逐字对齐才能人工对账。
 *
 * <p>后两个键下发的是「哪些培训形式要填这一项」，表单据此决定星号与必填校验——
 * 否则前端就得写死「线下」「混合」（需求 11.4 第 10、11 项）。
 */
export const TRAINING_ENUM_KEYS = {
  trainingForm: '培训形式',
  attendStatus: '签到状态',
  joinSource: '参训加入方式',
  formsNeedVenue: '培训形式·需填培训地点',
  formsNeedOnlineLink: '培训形式·需填线上链接',
} as const;

/** 排课表单的课程与讲师候选（需求 11.4.1 落地要点第 4 条）。 */
export function useSchedulingOptions(keyword?: string | null, enabled = true) {
  return useQuery({
    queryKey: ['training-scheduling-options', keyword ?? ''],
    queryFn: () => trainingApi.schedulingOptions(keyword),
    enabled,
    staleTime: META_STALE_TIME,
  });
}

export { selectOptions, useEmployees, useFieldEnums, useMachines, useStates };
