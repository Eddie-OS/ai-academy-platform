/**
 * 业务对象 → 详情深链。
 *
 * <p>总看板待办「去处理」、预警明细点对象名都走这里。路径与
 * {@code navigation.ts} 的 {@code detailPaths} 对齐：打开的是对应驾驶舱并展开右栏，
 * 不是另起一页。
 *
 * <p>未知类型回落到任务中心而不是 {@code /}——回首页会让人以为链接坏了，
 * 任务中心至少还是「处理待办」的上下文。
 */
export function objectDetailPath(objectType: string, objectId: number): string {
  switch (objectType) {
    case 'DEMAND':
      return `/demands/${objectId}`;
    case 'COURSE':
      return `/courses/${objectId}`;
    case 'TRAINING_PLAN':
      return `/training-plans/${objectId}`;
    case 'TRAINING_SESSION':
      return `/training-sessions/${objectId}`;
    case 'LECTURER':
      return `/lecturers/${objectId}`;
    case 'CASE':
      return `/cases/${objectId}`;
    default:
      return '/tasks';
  }
}
