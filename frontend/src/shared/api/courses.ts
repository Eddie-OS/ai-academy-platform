import { api, query } from './client';
import type { PageResult } from './types';

/**
 * 课程工作台接口（需求第 9 章，页面 P2-1～P2-4）。
 *
 * <p>类型手写的原因与 {@code imports.ts} 相同：生成器无法在当前离线环境安装，已记入待办。
 * 但这里<b>一个状态值与枚举字面量都没有</b>——评审轨道、有效期时长、材料类型、评审结果、
 * 试讲结论全部来自 {@code /api/meta/field-enums}，状态与动作来自 {@code /api/meta/enums} 与
 * 转换接口（纪律 STK-1）。
 */

export interface Course {
  id: number;
  courseNo: string;
  courseName: string;
  reviewTrack: string;
  domainCode: string;
  ownerNo: string;
  ownerName: string | null;
  initiatedDate: string;
  expectPublishDate: string;
  summary: string | null;
  targetAudience: string | null;
  classHours: string | null;
  categoryCode: string | null;
  validityPeriod: string;
  validityEndDate: string | null;
  /** 有效 / 30 天内到期 / 已过期 / 长期有效 / 未发布（规则 EX7 实时计算） */
  validityStatus: string;
  expired: boolean;
  /** 距到期天数。长期有效与未发布为 null，已过期为负数 */
  daysToExpiry: number | null;
  externalLink: string | null;
  mainState: string;
  devState: string | null;
  selfcheckState: string | null;
  trialState: string | null;
  publishState: string | null;
  firstPublishDate: string | null;
  qualityMarks: string[];
  closeReason: string | null;
  currentMaterialVersion: string | null;
  reviewRound: number | null;
  hasDemand: boolean;
  lastStateChangedAt: string | null;
  updatedAt: string;
  updatedBy: string | null;
  /** 乐观锁版本号（规则 K1）。编辑与状态转换都要原样带回 */
  version: number;
}

export interface CourseForm {
  courseName: string;
  reviewTrack: string;
  domainCode: string;
  ownerNo: string;
  initiatedDate: string;
  expectPublishDate: string;
  summary?: string | null;
  targetAudience?: string | null;
  classHours?: string | null;
  categoryCode?: string | null;
  validityPeriod: string;
  externalLink?: string | null;
  qualityMarks?: string[];
}

export interface CourseFilter {
  keyword?: string | null;
  reviewTrack?: string | null;
  domainCode?: string | null;
  mainState?: string | null;
  subState?: string | null;
  ownerNo?: string | null;
  qualityMark?: string | null;
  validityStatus?: string | null;
  initiatedFrom?: string | null;
  initiatedTo?: string | null;
  expectPublishFrom?: string | null;
  expectPublishTo?: string | null;
  hasDemand?: boolean | null;
  sortBy?: string | null;
  sortAsc?: boolean | null;
}

export interface CourseMaterial {
  id: number;
  courseId: number;
  materialType: string;
  attachmentId: number;
  fileName: string;
  fileSize: number;
  seqNo: number;
  createdAt: string;
  createdBy: string;
}

export interface CourseMaterialVersion {
  id: number;
  courseId: number;
  versionNo: string;
  /** 提交评审自动 / 手动创建 */
  triggerType: string;
  remark: string | null;
  /** 绑定的评审轮次；手动快照为 null */
  boundReviewRound: number | null;
  createdAt: string;
  createdBy: string;
}

export interface CourseMaterialVersionFile {
  id: number;
  versionId: number;
  materialType: string;
  attachmentId: number;
  /** 快照当时的文件名。附件被删也照常显示 */
  fileNameSnapshot: string;
  seqNo: number;
  attachmentDeleted: boolean;
}

export interface CourseReview {
  id: number;
  courseId: number;
  roundNo: number;
  versionId: number | null;
  boundVersionNo: string | null;
  reviewForms: string[];
  reviewDate: string | null;
  participants: string | null;
  reviewResult: string | null;
  reviewOpinion: string | null;
  issueList: string | null;
  recordState: string;
  /** 结论还没录入。已录入的记录一律只读（需求 9.8） */
  editable: boolean;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string | null;
}

export interface CourseReviewForm {
  reviewForms: string[];
  reviewDate: string;
  participants?: string | null;
  reviewResult: string;
  reviewOpinion: string;
  issueList?: string | null;
}

export interface CourseTrial {
  id: number;
  courseId: number;
  roundNo: number;
  trialDate: string;
  lecturerId: number;
  lecturerName: string | null;
  participants: string | null;
  acceptanceChecks: string[];
  courseConclusion: string | null;
  lecturerConclusion: string | null;
  /** 两个结论不一致。为真时必须显示需求 9.7.3 规定的那句提示 */
  inconsistent: boolean;
  expertOpinion: string | null;
  issueList: string | null;
  recordState: string;
  editable: boolean;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string | null;
}

export interface CourseTrialForm {
  trialDate: string;
  lecturerId: number;
  participants?: string | null;
  attachmentIds?: number[];
}

export interface CourseTrialConclusionForm {
  acceptanceChecks: string[];
  courseConclusion: string;
  lecturerConclusion: string;
  expertOpinion: string;
  issueList?: string | null;
}

export interface CourseSelfcheckItem {
  itemId: number;
  groupName: string;
  seq: number;
  itemText: string;
  /** 无 / 选填 / 必填。「必填」勾了没写说明视为未完成（规则 CK2） */
  noteRequirement: string;
  guideText: string | null;
  enabled: boolean;
  checked: boolean;
  note: string | null;
  completed: boolean;
}

export interface CourseSelfcheckView {
  courseId: number;
  totalCount: number;
  completedCount: number;
  items: CourseSelfcheckItem[];
}

export interface CourseSchedule {
  id: number;
  courseId: number;
  nodeName: string;
  planDate: string;
  remark: string | null;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string | null;
}

export interface CourseScheduleForm {
  nodeName: string;
  planDate: string;
  remark?: string | null;
}

export interface CourseCalendarItem {
  courseId: number;
  courseNo: string;
  courseName: string;
  ownerNo: string;
  ownerName: string | null;
  mainState: string;
  expectPublishDate: string | null;
  /** 开发节点 / 预计发布 */
  eventType: string;
  eventDate: string;
  nodeName: string | null;
  scheduleId: number | null;
  /** 三色灯属阶段 3，此刻恒为 null */
  warningLight: string | null;
}

/** 试讲讲师的候选项。讲师池完整列表属阶段 2 D 段，这里只有选择器需要的字段。 */
export interface LecturerOption {
  id: number;
  lecturerNo: string;
  lecturerName: string;
  employeeNo: string;
  sourceDept: string;
  /** 待培养 / 培养中 / 可上岗。<b>不用它过滤候选</b>：可上岗是排课条件，不是试讲条件 */
  trainingState: string;
}

export const courseApi = {
  page: (filter: CourseFilter, pageNum: number, pageSize: number) =>
    api.get<PageResult<Course>>(`/api/courses${query({ ...filter, pageNum, pageSize })}`),

  detail: (id: number) => api.get<Course>(`/api/courses/${id}`),

  initiate: (form: CourseForm) => api.post<number>('/api/courses', form),

  update: (id: number, form: CourseForm, version: number) =>
    api.put<void>(`/api/courses/${id}${query({ version })}`, form),

  close: (id: number, closeReason: string, version: number) =>
    api.post<void>(`/api/courses/${id}/close`, { closeReason, version }),

  remove: (id: number) => api.delete<void>(`/api/courses/${id}`),

  materials: (courseId: number) => api.get<CourseMaterial[]>(`/api/courses/${courseId}/materials`),

  attachMaterials: (courseId: number, materialType: string, attachmentIds: number[]) =>
    api.post<CourseMaterial[]>(`/api/courses/${courseId}/materials`, { materialType, attachmentIds }),

  detachMaterial: (courseId: number, materialId: number) =>
    api.delete<CourseMaterial[]>(`/api/courses/${courseId}/materials/${materialId}`),

  versions: (courseId: number) =>
    api.get<CourseMaterialVersion[]>(`/api/courses/${courseId}/material-versions`),

  versionDetail: (courseId: number, versionId: number) =>
    api.get<{ files: CourseMaterialVersionFile[]; selfcheck: Array<Record<string, unknown>> }>(
      `/api/courses/${courseId}/material-versions/${versionId}`,
    ),

  snapshot: (courseId: number, remark: string | null) =>
    api.post<CourseMaterialVersion>(`/api/courses/${courseId}/material-versions`, { remark }),

  reviews: (courseId: number) => api.get<CourseReview[]>(`/api/courses/${courseId}/reviews`),

  recordReviewConclusion: (reviewId: number, form: CourseReviewForm) =>
    api.post<void>(`/api/course-reviews/${reviewId}/conclusion`, form),

  trials: (courseId: number) => api.get<CourseTrial[]>(`/api/courses/${courseId}/trials`),

  acceptanceChecks: (courseId: number) =>
    api.get<string[]>(`/api/courses/${courseId}/trials/acceptance-checks`),

  lecturerOptions: () => api.get<LecturerOption[]>('/api/course-trials/lecturer-options'),

  createTrial: (courseId: number, form: CourseTrialForm) =>
    api.post<number>(`/api/courses/${courseId}/trials`, form),

  recordTrialConclusion: (trialId: number, form: CourseTrialConclusionForm) =>
    api.post<void>(`/api/course-trials/${trialId}/conclusion`, form),

  selfcheck: (courseId: number) => api.get<CourseSelfcheckView>(`/api/courses/${courseId}/selfcheck`),

  saveSelfcheck: (courseId: number, answers: Array<{ itemId: number; checked: boolean; note?: string | null }>) =>
    api.put<CourseSelfcheckView>(`/api/courses/${courseId}/selfcheck`, { answers }),

  schedules: (courseId: number) => api.get<CourseSchedule[]>(`/api/courses/${courseId}/schedules`),

  createSchedule: (courseId: number, form: CourseScheduleForm) =>
    api.post<number>(`/api/courses/${courseId}/schedules`, form),

  updateSchedule: (scheduleId: number, form: CourseScheduleForm) =>
    api.put<void>(`/api/course-schedules/${scheduleId}`, form),

  deleteSchedule: (scheduleId: number) => api.delete<void>(`/api/course-schedules/${scheduleId}`),

  calendar: (from: string, to: string) =>
    api.get<CourseCalendarItem[]>(`/api/course-schedules/calendar${query({ from, to })}`),
};

/** 课程的对象类型路径段，用于统一转换接口。不在各页面里各写一遍字符串。 */
export const COURSE_OBJECT_TYPE = 'courses';
