import { api, query } from './client';
import type { PageResult } from './types';

/**
 * 培训运营图接口（需求第 11 章，页面 P4-1～P4-4）。
 *
 * <p>类型手写的原因与 {@code courses.ts} 相同：生成器无法在当前离线环境安装，已记入待办。
 * 这里同样<b>一个状态值与枚举字面量都没有</b>——培训形式、签到状态、加入方式来自
 * {@code /api/meta/field-enums}，状态与动作来自 {@code /api/meta/enums} 与转换接口（纪律 STK-1）。
 */

export interface TrainingPlan {
  id: number;
  planNo: string;
  planName: string;
  courseId: number;
  courseName: string | null;
  ownerNo: string;
  ownerName: string | null;
  targetScope: string;
  planStartDate: string;
  planEndDate: string;
  planSessionCount: number | null;
  /** 下属场次记录数，实时 COUNT（需求 11.3 第 10 项）。与计划场次数的差额就是还没排的场次 */
  actualSessionCount: number;
  planState: string;
  actualFinishDate: string | null;
  remark: string | null;
  lastStateChangedAt: string | null;
  updatedAt: string;
  updatedBy: string | null;
  /** 灯色 API 码 BLUE／YELLOW／RED／NONE */
  light: string;
  lightDays: number | null;
  lightReason: string | null;
}

export interface TrainingPlanForm {
  planName: string;
  courseId: number;
  ownerNo: string;
  targetScope: string;
  planStartDate: string;
  planEndDate: string;
  planSessionCount?: number | null;
  remark?: string | null;
}

export interface TrainingPlanFilter {
  keyword?: string | null;
  light?: string | null;
  courseId?: number | null;
  ownerNo?: string | null;
  planState?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  sortBy?: string | null;
  sortAsc?: boolean | null;
}

export interface TrainingSession {
  id: number;
  sessionNo: string;
  planId: number;
  planNo: string;
  planName: string;
  sessionName: string | null;
  courseId: number;
  courseName: string | null;
  lecturerId: number;
  lecturerName: string | null;
  trainingDate: string;
  startTime: string;
  endTime: string;
  durationHours: string | null;
  trainingForm: string;
  venue: string | null;
  onlineLink: string | null;
  studentScope: string;
  planAttendeeCount: number | null;
  /** 签到状态＝已签到的记录数，实时 COUNT（需求 11.4 第 14 项） */
  actualAttendeeCount: number;
  attendanceImported: boolean;
  sessionState: string;
  remark: string | null;
  lastStateChangedAt: string | null;
  updatedAt: string;
  updatedBy: string | null;
}

export interface TrainingSessionForm {
  sessionName?: string | null;
  courseId: number;
  lecturerId: number;
  trainingDate: string;
  startTime: string;
  endTime: string;
  /** 留空由起止时间算出；填了以填的为准（需求 11.4 第 8 项） */
  durationHours?: string | null;
  trainingForm: string;
  venue?: string | null;
  onlineLink?: string | null;
  studentScope: string;
  planAttendeeCount?: number | null;
  remark?: string | null;
}

export interface TrainingSessionFilter {
  keyword?: string | null;
  planId?: number | null;
  courseId?: number | null;
  lecturerId?: number | null;
  sessionState?: string | null;
  trainingForm?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  attendanceImported?: boolean | null;
  sortBy?: string | null;
  sortAsc?: boolean | null;
}

/**
 * 场次保存的结果。
 *
 * <p><b>有 {@code warnings} 不代表没保存成功</b>：时段冲突与课程已过期是提示不阻断
 * （需求 11.4.1 校验三、规则 EX6），硬阻断走的是错误响应。
 */
export interface SessionSaved {
  id: number;
  warnings: string[];
}

/** 排课表单的候选项。课程限已发布之后的主状态，讲师限可上岗——过滤在后端做（需求 11.4.1 校验一、二）。 */
export interface SchedulingOptions {
  courses: Array<{
    id: number;
    courseNo: string;
    courseName: string;
    mainState: string;
    validityEndDate: string | null;
  }>;
  lecturers: Array<{
    id: number;
    lecturerNo: string;
    lecturerName: string;
    employeeNo: string;
    sourceDept: string;
    trainingState: string;
  }>;
}

/** 参训名单与签到的合并行（需求 11.5）。签到未导入时后三个字段为 null。 */
export interface AttendeeRow {
  id: number;
  sessionId: number;
  employeeNo: string;
  employeeName: string;
  deptName: string | null;
  joinSource: string;
  importBatchNo: string | null;
  createdAt: string;
  attendanceId: number | null;
  attendStatus: string | null;
  attendTime: string | null;
  attendRemark: string | null;
  attendanceBatch: string | null;
}

/** @param noRecord 名单上还没有签到记录的人数。等于 total 时说明这场还没导过签到 */
export interface AttendeeBoard {
  rows: AttendeeRow[];
  total: number;
  present: number;
  absent: number;
  noRecord: number;
}

export interface AttendanceForm {
  attendStatus: string;
  attendTime?: string | null;
  remark?: string | null;
}

/** 培训归档记录（需求 11.6）。没归档过的场次 {@code id} 为 null，不是 404。 */
export interface TrainingArchive {
  id: number | null;
  sessionId: number;
  liveLink: string | null;
  videoLink: string | null;
  minutesText: string | null;
  archiveCompleted: boolean;
  completedAt: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
}

export interface TrainingArchiveForm {
  liveLink?: string | null;
  videoLink?: string | null;
  minutesText?: string | null;
  archiveCompleted?: boolean | null;
}

/** 学员反馈（需求 11.7）。{@code submitterNo} 为 null 即匿名，正文不可改（规则 FB1）。 */
export interface TrainingFeedbackItem {
  id: number;
  sessionId: number;
  submitterNo: string | null;
  submitterName: string | null;
  submitterDept: string | null;
  score: number;
  content: string | null;
  feedbackScene: string | null;
  importBatchNo: string | null;
  importedAt: string;
  opsRemark: string | null;
  remarkedAt: string | null;
}

export interface FeedbackSummary {
  total: number;
  /** 无反馈时为 null，按「—」显示；不要显示成 0.0 分 */
  averageScore: string | null;
  score5: number;
  score4: number;
  score3: number;
  score2: number;
  score1: number;
  anonymousCount: number;
}

export const trainingApi = {
  plans: (filter: TrainingPlanFilter, pageNum: number, pageSize: number) =>
    api.get<PageResult<TrainingPlan>>(`/api/training-plans${query({ ...filter, pageNum, pageSize })}`),

  plan: (id: number) => api.get<TrainingPlan>(`/api/training-plans/${id}`),

  createPlan: (form: TrainingPlanForm) => api.post<number>('/api/training-plans', form),

  updatePlan: (id: number, form: TrainingPlanForm) => api.put<void>(`/api/training-plans/${id}`, form),

  deletePlan: (id: number) => api.delete<void>(`/api/training-plans/${id}`),

  sessions: (filter: TrainingSessionFilter, pageNum: number, pageSize: number) =>
    api.get<PageResult<TrainingSession>>(
      `/api/training-sessions${query({ ...filter, pageNum, pageSize })}`,
    ),

  session: (id: number) => api.get<TrainingSession>(`/api/training-sessions/${id}`),

  createSession: (planId: number, form: TrainingSessionForm) =>
    api.post<SessionSaved>(`/api/training-plans/${planId}/sessions`, form),

  updateSession: (id: number, form: TrainingSessionForm) =>
    api.put<SessionSaved>(`/api/training-sessions/${id}`, form),

  /** 日历拖动改期（需求 11.8）。只改日期，讲师与课程不变 */
  reschedule: (id: number, trainingDate: string) =>
    api.put<SessionSaved>(`/api/training-sessions/${id}/training-date${query({ trainingDate })}`),

  deleteSession: (id: number) => api.delete<void>(`/api/training-sessions/${id}`),

  schedulingOptions: (keyword?: string | null) =>
    api.get<SchedulingOptions>(`/api/training-sessions/scheduling-options${query({ keyword })}`),

  /** 保存前的预检，只返回提示类结果；硬阻断由保存时的接口报错（需求 11.4.1） */
  schedulingCheck: (params: {
    courseId: number;
    lecturerId: number;
    trainingDate: string;
    startTime: string;
    endTime: string;
    excludeSessionId?: number | null;
  }) => api.get<string[]>(`/api/training-sessions/scheduling-check${query({ ...params })}`),

  attendees: (sessionId: number) =>
    api.get<AttendeeBoard>(`/api/training-sessions/${sessionId}/attendees`),

  /** @returns ignored 为已在名单上、本次跳过的条数 */
  addAttendees: (sessionId: number, employeeNos: string[]) =>
    api.post<{ added: number; ignored: number; addedEmployeeNos: string[] }>(
      `/api/training-sessions/${sessionId}/attendees`,
      { employeeNos },
    ),

  removeAttendee: (sessionId: number, attendeeId: number) =>
    api.delete<void>(`/api/training-sessions/${sessionId}/attendees/${attendeeId}`),

  updateAttendance: (sessionId: number, attendanceId: number, form: AttendanceForm) =>
    api.put<void>(`/api/training-sessions/${sessionId}/attendances/${attendanceId}`, form),

  archive: (sessionId: number) =>
    api.get<TrainingArchive>(`/api/training-sessions/${sessionId}/archive`),

  saveArchive: (sessionId: number, form: TrainingArchiveForm) =>
    api.put<TrainingArchive>(`/api/training-sessions/${sessionId}/archive`, form),

  feedbacks: (sessionId: number, pageNum: number, pageSize: number) =>
    api.get<PageResult<TrainingFeedbackItem>>(
      `/api/training-sessions/${sessionId}/feedbacks${query({ pageNum, pageSize })}`,
    ),

  feedbackSummary: (sessionId: number) =>
    api.get<FeedbackSummary>(`/api/training-sessions/${sessionId}/feedbacks/summary`),

  updateFeedbackRemark: (sessionId: number, feedbackId: number, opsRemark: string | null) =>
    api.put<void>(`/api/training-sessions/${sessionId}/feedbacks/${feedbackId}/ops-remark`, {
      opsRemark,
    }),
};

/** 培训计划与场次的对象类型路径段，用于统一转换接口。不在各页面里各写一遍字符串。 */
export const TRAINING_PLAN_OBJECT_TYPE = 'training-plans';
export const TRAINING_SESSION_OBJECT_TYPE = 'training-sessions';
