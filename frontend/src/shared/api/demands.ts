import { api, query } from './client';
import type { PageResult } from './types';

/**
 * AI需求驾驶舱接口（需求第 8 章，页面 P1-1～P1-3）。
 *
 * <p>类型手写的原因与 {@code courses.ts} 相同：OpenAPI 生成器在当前离线环境装不上，已记入待办。
 * 但这里<b>一个状态值与枚举字面量都没有</b>——需求来源、需求类型、优先级、分流出口、验收结论
 * 全部来自 {@code /api/meta/field-enums}，状态与动作来自 {@code /api/meta/enums} 与转换接口
 * （纪律 STK-1）。
 */

export interface Demand {
  id: number;
  demandNo: string;
  demandName: string;
  domainCode: string;
  proposerNo: string;
  proposerName: string | null;
  /** 提出人部门。随提出人自动带出的快照，人员台账改了也不回写历史（需求 8.3.1 第 5 项） */
  proposerDept: string | null;
  ownerNo: string;
  ownerName: string | null;
  /** 多负责人姓名，顿号分隔（现场口径 D-21） */
  ownerNames?: string | null;
  proposedDate: string;
  /** 预计开发完成时间。三色灯蓝灯与黄灯的判定基准（需求 8.3.1 第 9 项） */
  expectFinishDate: string;
  description: string;
  demandSource: string | null;
  demandType: string | null;
  priority: string | null;
  businessBackground?: string | null;
  roiAnalysis?: string | null;
  remark?: string | null;
  reviewState: string;
  reviewDate: string | null;
  reviewConclusion: string | null;
  reviewOpinion: string | null;
  /** 评审备注，与登记表单 remark 独立 */
  reviewRemark?: string | null;
  /** 分流出口。为空时字段 21–27 整体隐藏（需求 8.3.3 界面动态显示规则） */
  outlet: string | null;
  solutionState: string | null;
  solutionName: string | null;
  solutionRemark?: string | null;
  devName?: string | null;
  devState: string | null;
  devRemark?: string | null;
  /** 当前处理状态：出口一取解决方案状态，出口二取需求开发状态（需求 8.6） */
  currentProcessState: string | null;
  firstOnlineDate: string | null;
  latestOnlineDate: string | null;
  optimizeCount: number | null;
  /** 交付标记状态机的当前取值（已交付 / 已归档），不是布尔 */
  deliveryMark: string | null;
  deliveryRemark?: string | null;
  deliveredAt: string | null;
  actualFinishDate?: string | null;
  solutionLink?: string | null;
  courseLink?: string | null;
  archivedAt: string | null;
  acceptanceState: string | null;
  acceptorName: string | null;
  acceptedAt: string | null;
  acceptanceOpinion: string | null;
  acceptanceRemark?: string | null;
  acceptanceRound: number | null;
  courseCount: number | null;
  hasCourse: boolean | null;
  lastStateChangedAt: string | null;
  updatedAt: string;
  updatedBy: string | null;
  /** 乐观锁版本号（规则 K1）。编辑与状态转换都要原样带回 */
  version: number;
  /** 灯色 API 码 BLUE／YELLOW／RED／NONE */
  light: string;
  lightDays: number | null;
  lightReason: string | null;
}

export interface DemandForm {
  demandName: string;
  domainCode: string;
  proposerNo: string;
  ownerNo: string;
  proposedDate: string;
  expectFinishDate: string;
  description: string;
  demandSource?: string | null;
  demandType?: string | null;
  priority?: string | null;
  businessBackground?: string | null;
  roiAnalysis?: string | null;
  remark?: string | null;
  ownerNames?: string | null;
}

export interface DemandFilter {
  keyword?: string | null;
  light?: string | null;
  domainCode?: string | null;
  reviewState?: string | null;
  outlet?: string | null;
  solutionState?: string | null;
  devState?: string | null;
  acceptanceState?: string | null;
  ownerNo?: string | null;
  proposedFrom?: string | null;
  proposedTo?: string | null;
  expectFinishFrom?: string | null;
  expectFinishTo?: string | null;
  hasCourse?: boolean | null;
  sortBy?: string | null;
  sortAsc?: boolean | null;
}

export interface DemandReview {
  id: number;
  demandId: number;
  roundNo: number;
  reviewDate: string | null;
  reviewConclusion: string | null;
  reviewOpinion: string | null;
  remark?: string | null;
  createdAt: string;
  createdBy: string;
}

export interface DemandReviewForm {
  reviewDate: string | null;
  reviewConclusion?: string | null;
  reviewOpinion?: string | null;
  /** 分流出口必填：评审已结束却没有出口的需求，没有任何动作能推进它（需求 5.2.1） */
  outlet: string;
  version?: number | null;
}

export interface DemandProcessInfoForm {
  outlet: string;
  solutionName?: string | null;
  solutionState?: string | null;
  solutionRemark?: string | null;
  devName?: string | null;
  devState?: string | null;
  devRemark?: string | null;
  expectFinishDate?: string | null;
  acceptanceState?: string | null;
  acceptanceRemark?: string | null;
  deliveryMark?: string | null;
  deliveryRemark?: string | null;
  actualFinishDate?: string | null;
  solutionLink?: string | null;
  version?: number | null;
}

export interface DemandCourseLinkForm {
  courseLink?: string | null;
  version?: number | null;
}

export interface DemandReviewInfoForm {
  reviewState: string;
  reviewConclusion: string;
  reviewOpinion: string;
  reviewRemark?: string | null;
  priority?: string | null;
  version?: number | null;
}

export interface DemandAcceptance {
  id: number;
  demandId: number;
  roundNo: number;
  acceptorName: string;
  acceptedAt: string;
  acceptanceResult: string;
  acceptanceOpinion: string | null;
  createdAt: string;
  createdBy: string;
}

export interface DemandAcceptanceForm {
  acceptorName: string;
  acceptedAt: string;
  /** 通过 / 不通过。取自 {@code /api/meta/field-enums} 的「需求验收结论」，决定走哪条转换 */
  acceptanceResult: string;
  acceptanceOpinion?: string | null;
  version?: number | null;
}

/** 需求详情「关联课程」页签的行（需求 8.4 界面要求第 1 行）。 */
export interface LinkedCourse {
  courseId: number;
  courseNo: string;
  courseName: string;
  mainState: string;
  ownerNo: string;
  ownerName: string | null;
  linkNote: string | null;
  createdAt: string;
  createdBy: string;
}

/** 课程详情「关联需求」页签的行。同一份关联的另一个视角（规则 R4）。 */
export interface LinkedDemand {
  demandId: number;
  demandNo: string;
  demandName: string;
  reviewState: string;
  outlet: string | null;
  ownerNo: string;
  ownerName: string | null;
  linkNote: string | null;
  createdAt: string;
  createdBy: string;
}

export const demandApi = {
  page: (filter: DemandFilter, pageNum: number, pageSize: number) =>
    api.get<PageResult<Demand>>(`/api/demands${query({ ...filter, pageNum, pageSize })}`),

  detail: (id: number) => api.get<Demand>(`/api/demands/${id}`),

  register: (form: DemandForm) => api.post<number>('/api/demands', form),

  update: (id: number, form: DemandForm, version: number) =>
    api.put<void>(`/api/demands/${id}${query({ version })}`, form),

  remove: (id: number) => api.delete<void>(`/api/demands/${id}`),

  reviews: (demandId: number) => api.get<DemandReview[]>(`/api/demands/${demandId}/reviews`),

  recordReviewConclusion: (demandId: number, form: DemandReviewForm) =>
    api.post<number>(`/api/demands/${demandId}/review-conclusion`, form),

  saveReviewInfo: (demandId: number, form: DemandReviewInfoForm) =>
    api.put<void>(`/api/demands/${demandId}/review-info`, form),

  saveProcessInfo: (demandId: number, form: DemandProcessInfoForm) =>
    api.put<void>(`/api/demands/${demandId}/process-info`, form),

  saveCourseLink: (demandId: number, form: DemandCourseLinkForm) =>
    api.put<void>(`/api/demands/${demandId}/course-link`, form),

  createSolution: (demandId: number, solutionName: string, version: number) =>
    api.post<void>(`/api/demands/${demandId}/solution`, { solutionName, version }),

  /**
   * 标记交付使用。一次调用推进「需求交付标记」与「业务验收状态」两个状态机，
   * 因此它不走统一转换接口——那个接口一次只推一个状态字段。
   */
  markDelivered: (demandId: number, version: number) =>
    api.post<void>(`/api/demands/${demandId}/delivery${query({ version })}`),

  acceptances: (demandId: number) => api.get<DemandAcceptance[]>(`/api/demands/${demandId}/acceptances`),

  recordAcceptanceConclusion: (demandId: number, form: DemandAcceptanceForm) =>
    api.post<number>(`/api/demands/${demandId}/acceptance-conclusion`, form),

  courses: (demandId: number) => api.get<LinkedCourse[]>(`/api/demands/${demandId}/courses`),

  linkCourse: (demandId: number, courseId: number, linkNote: string | null) =>
    api.post<void>(`/api/demands/${demandId}/courses`, { courseId, linkNote }),

  unlinkCourse: (demandId: number, courseId: number) =>
    api.delete<void>(`/api/demands/${demandId}/courses/${courseId}`),

  /** 课程侧的同一份关联（规则 R4）。放在这里而不是 courses.ts：它查的是需求 */
  demandsOfCourse: (courseId: number) => api.get<LinkedDemand[]>(`/api/courses/${courseId}/demands`),

  linkDemandFromCourse: (courseId: number, demandId: number, linkNote: string | null) =>
    api.post<void>(`/api/courses/${courseId}/demands`, { demandId, linkNote }),

  unlinkDemandFromCourse: (courseId: number, demandId: number) =>
    api.delete<void>(`/api/courses/${courseId}/demands/${demandId}`),
};

/** 需求的对象类型路径段，用于统一转换接口。不在各页面里各写一遍字符串。 */
export const DEMAND_OBJECT_TYPE = 'demands';
