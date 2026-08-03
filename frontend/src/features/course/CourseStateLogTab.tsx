import { COURSE_OBJECT_TYPE } from '@/shared/api/courses';
import { StateLogTab } from '@/shared/ui/StateLogTab';

/**
 * 课程详情页「状态流转日志」页签（需求 5.11）。
 *
 * <p>五个状态字段混排在一条时间线上，实现见 {@link StateLogTab}——需求驾驶舱的同名页签用的是
 * 同一份，两份各自演化的结果是其中一份忘了区分系统流转与人工流转。
 */

interface CourseStateLogTabProps {
  courseId: number;
}

export function CourseStateLogTab({ courseId }: CourseStateLogTabProps) {
  return <StateLogTab objectType={COURSE_OBJECT_TYPE} objectId={courseId} />;
}
