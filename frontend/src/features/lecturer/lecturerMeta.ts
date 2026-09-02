import { useQuery } from '@tanstack/react-query';
import { lecturerApi } from '@/shared/api/lecturers';
import { FIELD_ENUM_KEYS } from '@/shared/api/meta';
import { useBusinessDomains } from '@/shared/meta/domains';
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
 * 讲师驾驶舱用到的元数据。
 *
 * <p><b>这里没有 OBJECT_TYPE 也没有 STATE_FIELDS。</b>其余四个驾驶舱的 meta 文件都以这两组
 * 常量开头，讲师没有——培养状态与在池状态都不是状态机（规则 TS1、C10、需求 5.13），
 * 它们是自由选择的枚举字段，改值走 {@code PUT /api/lecturers/{id}} 而不是转换接口。
 * 因此讲师详情没有状态区、没有转换按钮。页签上的「状态流转日志」读的是操作审计，
 * 不是 audit_state_log（TS2）。
 *
 * <p>取值仍然一个都不写死（纪律 STK-1）：三组枚举来自 {@code /api/meta/field-enums}，
 * 试讲结论与试讲记录状态分别来自字段枚举与 {@code /api/meta/enums}。
 */

/** 试讲记录状态机的对象类型码与状态字段名，与后端 {@code CourseStateMachines} 一致。 */
export const TRIAL_OBJECT_TYPE_CODE = 'COURSE_TRIAL';
export const TRIAL_STATE_FIELD = '试讲记录状态';

/** 擅长领域与需求所属领域同一套现场口径。 */
export function useExpertiseDomains() {
  return useBusinessDomains();
}

/**
 * 来源部门的去重清单。
 *
 * <p>V1.2 起来源部门是自由文本（N18），没有部门表可查，筛选下拉只能列出库里已有的取值。
 * 讲师增删后它会变，因此与其他元数据共用同一个 5 分钟窗口，不做更长的缓存。
 */
export function useSourceDepts() {
  return useQuery({
    queryKey: ['lecturers', 'source-depts'],
    queryFn: () => lecturerApi.sourceDepts(),
    staleTime: META_STALE_TIME,
  });
}

export { FIELD_ENUM_KEYS, DICT_KEYS, selectOptions, useDicts, useEmployees, useFieldEnums, useMachines, useStates };
