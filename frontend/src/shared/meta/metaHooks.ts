import { useQuery } from '@tanstack/react-query';
import { metaApi } from '@/shared/api/meta';
import { employeeApi } from '@/shared/api/employees';

/**
 * 全部驾驶舱共用的元数据取数（开发实施文档 7.5）。
 *
 * <p>状态与动作来自 {@code /api/meta/enums}，字段枚举来自 {@code /api/meta/field-enums}，
 * 字典来自 {@code /api/meta/dicts}，人员来自人员台账——<b>没有一个取值是前端写死的</b>（纪律 STK-1）。
 *
 * <p>这些 hooks 原本住在 {@code features/course/courseMeta.ts}。需求驾驶舱要用同一批数据时，
 * 照抄一份的代价不是多几行代码，而是缓存键会分叉：配置中心保存后 invalidate 一个键，
 * 另一个页面仍拿着旧字典。因此抽到共享层，课程侧原样再导出，调用点不动。
 */

/** 元数据在一次会话内基本不变；5 分钟内不重复请求，配置中心保存后由那边 invalidate。 */
export const META_STALE_TIME = 5 * 60 * 1000;

/** 字典类型键，与后端 {@code DictQuery.TYPE_*} 一致。 */
export const DICT_KEYS = {
  combatUnit: '作战单元',
  courseCategory: '课程分类',
  courseInitiationStatus: '课程立项状态',
  courseInitiationReviewConclusion: '课程立项评审结论',
  courseSelfcheckRecordStatus: '课程自检记录状态',
  courseSelfcheckConclusion: '课程自检结论',
  courseReviewPhase: '课程评审阶段',
  courseReviewLedgerStatus: '课程评审台账状态',
  prelimReviewConclusion: '初步评审结论',
  meetingConclusion: '上会最终结论',
  courseTrialPhase: '课程试讲阶段',
  courseTrialLedgerStatus: '课程试讲台账状态',
  courseTrialFormat: '课程试讲形式',
  trialAcceptanceResult: '试讲验收结果',
} as const;

export function useFieldEnums() {
  return useQuery({
    queryKey: ['meta', 'field-enums'],
    queryFn: () => metaApi.fieldEnums(),
    staleTime: META_STALE_TIME,
  });
}

export function useDicts() {
  return useQuery({
    queryKey: ['meta', 'dicts'],
    queryFn: () => metaApi.dicts(),
    staleTime: META_STALE_TIME,
  });
}

export function useMachines() {
  return useQuery({
    queryKey: ['meta', 'enums'],
    queryFn: () => metaApi.enums(),
    staleTime: META_STALE_TIME,
  });
}

/**
 * 人员台账，负责人与提出人下拉用它。
 *
 * <p><b>不按在职状态过滤。</b>历史对象的负责人可能已经离职，过滤掉会让编辑这类对象时
 * 负责人一栏变空，保存时又被必填规则拦住。人员状态在选项文案里显示出来，由运营自己判断。
 */
export function useEmployees() {
  return useQuery({
    queryKey: ['employees', 'all'],
    queryFn: () => employeeApi.page({}, 1, 200),
    staleTime: META_STALE_TIME,
  });
}

/** 某个状态机的全部状态值，按转换表的出现顺序（即业务流程顺序）。 */
export function useStates(objectType: string, stateField: string): string[] {
  const machines = useMachines();
  return machines.data?.find((m) => m.objectType === objectType && m.stateField === stateField)?.states ?? [];
}

/**
 * 某个状态机的终态集合。
 *
 * <p>表单要排除「进去就出不来」的状态时用它，而不是比较状态名——终态是转换表算出来的，
 * 后端加一条出边它就自动不再是终态，前端跟着变。
 */
export function useTerminalStates(objectType: string, stateField: string): string[] {
  const machines = useMachines();
  return (
    machines.data?.find((m) => m.objectType === objectType && m.stateField === stateField)
      ?.terminalStates ?? []
  );
}

export function selectOptions(values: string[] | undefined) {
  return (values ?? []).map((value) => ({ value, label: value }));
}
