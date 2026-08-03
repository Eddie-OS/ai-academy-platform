import { api, query } from './client';
import type { PageResult } from './types';

/**
 * 讲师图接口（需求第 10 章，页面 P3-1～P3-3）。
 *
 * <p>类型手写的原因与 {@code courses.ts} 相同：生成器无法在当前离线环境安装，已记入待办。
 * 这里同样<b>一个状态值与枚举字面量都没有</b>——培养状态、在池状态、入池方式来自
 * {@code /api/meta/field-enums}，试讲记录状态与试讲结论来自 {@code /api/meta/enums} 与
 * 课程侧的字段枚举（纪律 STK-1）。
 *
 * <p><b>没有 transitions 相关的导出。</b>讲师是五个驾驶舱里唯一没有状态机的对象：
 * 培养状态与在池状态都是自由选择的枚举（规则 TS1、C10），改值走普通编辑接口。
 */

export interface Lecturer {
  id: number;
  lecturerNo: string;
  lecturerName: string;
  employeeNo: string;
  sourceDept: string;
  expertiseDomains: string[];
  teachingDirection: string;
  /** 入池方式（需求 10.4）。由入池路径决定，不可编辑 */
  joinType: string;
  joinedDate: string;
  trainingState: string;
  /** 试讲合格标记。只能由试讲结论录入产生，表单里没有这一项 */
  trialQualified: boolean;
  firstQualifiedDate: string | null;
  /** 累计授课次数（需求 10.3 第 11 项）。实时聚合，不落库 */
  teachingCount: number | null;
  attendeeCount: number | null;
  /** 平均评分。无反馈时为 null，按「—」显示，不要显示成 0.0 */
  avgScore: string | null;
  poolState: string;
  removedReason: string | null;
  importBatchNo: string | null;
  createdAt: string;
  updatedAt: string;
  updatedBy: string | null;
}

export interface LecturerForm {
  lecturerName: string;
  employeeNo: string;
  sourceDept: string;
  expertiseDomains: string[];
  teachingDirection: string;
  trainingState: string;
  poolState: string;
  /** 在池状态为「已移出」时必填（需求 10.3 第 15 项），跨字段校验在后端 */
  removedReason?: string | null;
}

export interface LecturerFilter {
  keyword?: string | null;
  sourceDept?: string | null;
  expertiseDomain?: string | null;
  trainingState?: string | null;
  trialQualified?: boolean | null;
  poolState?: string | null;
  joinType?: string | null;
  joinedFrom?: string | null;
  joinedTo?: string | null;
  scoreFrom?: string | null;
  scoreTo?: string | null;
  sortBy?: string | null;
  sortAsc?: boolean | null;
}

/**
 * 一条授课记录（需求 10.5）。
 *
 * <p>由培训场次实时派生，不是一张独立台账——签到导入后人次立刻跟着变。
 * @param avgScore 本场平均评分；没有反馈时为 null
 */
export interface TeachingRecord {
  sessionId: number;
  sessionNo: string;
  sessionName: string | null;
  courseId: number | null;
  courseName: string | null;
  teachingDate: string;
  sessionState: string;
  attendeeCount: number;
  avgScore: string | null;
}

/** 一条学员评价（需求 10.6）。{@code submitterName} 为 null 即匿名。 */
export interface LecturerEvaluation {
  id: number;
  sessionId: number;
  sessionNo: string;
  trainingDate: string;
  submitterName: string | null;
  submitterDept: string | null;
  score: number;
  content: string | null;
  feedbackScene: string | null;
  submittedAt: string;
}

/** 试讲台账的一行（需求 10.2 页面 P3-3）。台账只读，录结论走课程详情页的试讲页签。 */
export interface TrialLedgerRow {
  id: number;
  courseId: number;
  courseNo: string;
  courseName: string;
  roundNo: number;
  trialDate: string;
  lecturerId: number;
  lecturerNo: string;
  lecturerName: string;
  participants: string | null;
  courseConclusion: string | null;
  lecturerConclusion: string | null;
  /** 双结论不一致。库里是生成列，前端不自己比较两个结论 */
  inconsistent: boolean;
  expertOpinion: string | null;
  issueList: string | null;
  recordState: string;
}

export interface TrialLedgerFilter {
  keyword?: string | null;
  courseId?: number | null;
  lecturerId?: number | null;
  roundNo?: number | null;
  courseConclusion?: string | null;
  lecturerConclusion?: string | null;
  inconsistent?: boolean | null;
  recordState?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  sortBy?: string | null;
  sortAsc?: boolean | null;
}

export const lecturerApi = {
  page: (filter: LecturerFilter, pageNum: number, pageSize: number) =>
    api.get<PageResult<Lecturer>>(`/api/lecturers${query({ ...filter, pageNum, pageSize })}`),

  detail: (id: number) => api.get<Lecturer>(`/api/lecturers/${id}`),

  create: (form: LecturerForm) => api.post<number>('/api/lecturers', form),

  update: (id: number, form: LecturerForm) => api.put<void>(`/api/lecturers/${id}`, form),

  remove: (id: number) => api.delete<void>(`/api/lecturers/${id}`),

  teachingRecords: (id: number) => api.get<TeachingRecord[]>(`/api/lecturers/${id}/teaching-records`),

  evaluations: (id: number) => api.get<LecturerEvaluation[]>(`/api/lecturers/${id}/evaluations`),

  /** 来源部门是自由文本（N18），筛选下拉只能列出库里已有的取值 */
  sourceDepts: () => api.get<string[]>('/api/lecturers/source-depts'),

  trialLedger: (filter: TrialLedgerFilter, pageNum: number, pageSize: number) =>
    api.get<PageResult<TrialLedgerRow>>(
      `/api/lecturers/trial-ledger${query({ ...filter, pageNum, pageSize })}`,
    ),
};
