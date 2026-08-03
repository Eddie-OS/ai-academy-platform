import { api, query } from './client';
import type { PageResult } from './types';

/**
 * 案例图接口（需求第 12 章，页面 P5-1～P5-4）。
 *
 * <p><b>没有 create。</b>案例只有一个来源：课程标注达到精品标准时由后端自动创建
 * （议题 27、C16-b、N10）。看到这里只有 update 没有 create 时不要补一个——那会把
 * 「学员成果与业务侧实践不能直接提交为案例」这条范围边界打开。
 *
 * <p><b>点赞与评论是用户账号唯一能写的两件事</b>（需求 6.2.5）。其余写接口在用户账号下
 * 整体不渲染入口，依据是登录时拿到的账号类型（纪律 PMI-5），不靠字段是否为空推断。
 *
 * <p>状态值与枚举一个都没写死：案例状态来自 {@code /api/meta/enums}，审核结论、精品标注、
 * 看板排序来自 {@code /api/meta/field-enums}（纪律 STK-1）。
 */

export interface CaseInfo {
  id: number;
  caseNo: string;
  caseName: string;
  courseId: number | null;
  /** 来源课程名称。案例与课程 1:1，由后端补齐 */
  courseName: string | null;
  contributingOrg: string;
  contributors: string[];
  domainCodes: string[];
  ownerNo: string;
  ownerName: string | null;
  caseState: string;
  reviewerNo: string | null;
  reviewerName: string | null;
  reviewedAt: string | null;
  reviewOpinion: string | null;
  /** 审核结论。<b>不记轮次</b>，后一次覆盖前一次（C09 第 4 条） */
  reviewResult: string | null;
  qualityMarks: string[];
  /** 富文本正文（HTML）。列表接口也会带，卡片摘要由前端截断 */
  content: string | null;
  publishedAt: string | null;
  expectPublishDate: string | null;
  /** 浏览次数。<b>不去重</b>——含义是「被打开了多少次」而不是「多少人看过」 */
  viewCount: number | null;
  likeCount: number | null;
  commentCount: number | null;
  readSeconds: number | null;
  /** 平均阅读时长（秒）。没人打开过或没人回报过时长时为 null，显示「—」而不是 0 */
  avgReadSeconds: number | null;
  createdAt: string;
  createdBy: string;
  lastStateChangedAt: string | null;
  updatedAt: string;
  updatedBy: string | null;
  version: number;
  /** 本次打开所记的浏览记录主键。<b>只有详情接口会填</b>，供离开页面时回报停留时长 */
  viewId: number | null;
}

export interface CaseForm {
  caseName: string;
  contributingOrg: string;
  contributors: string[];
  domainCodes: string[];
  ownerNo: string;
  qualityMarks: string[];
  content?: string | null;
  expectPublishDate?: string | null;
}

/** 审核结论四字段（需求 12.3 第 9a～9d 项）。落库与状态推进在后端同一个事务里完成。 */
export interface CaseAuditForm {
  reviewerNo: string;
  reviewedAt: string;
  reviewOpinion?: string | null;
  reviewResult: string;
  version?: number | null;
}

export interface CaseFilter {
  keyword?: string | null;
  domainCode?: string | null;
  caseState?: string | null;
  contributingOrg?: string | null;
  qualityMark?: string | null;
  ownerNo?: string | null;
  publishedFrom?: string | null;
  publishedTo?: string | null;
  /** 只看已上架。看板卡片流默认开，运营列表默认关 */
  activeOnly?: boolean | null;
  sortBy?: string | null;
  sortAsc?: boolean | null;
}

export interface CaseComment {
  id: number;
  caseId: number;
  /** 署名。留空即 null，展示层显示成「匿名」——库里不写死这两个字 */
  signature: string | null;
  content: string;
  commentedAt: string;
  accountType: string;
}

export interface CaseInteractionStats {
  viewCount: number;
  likeCount: number;
  commentCount: number;
  readSeconds: number;
  avgReadSeconds: number | null;
}

export interface CaseReport {
  id: number;
  reportName: string;
  periodStart: string;
  periodEnd: string;
  /** 生成方式。自动生成的报告一经编辑即转为「手动编辑」 */
  generateMode: string;
  content: string | null;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string | null;
}

export interface CaseReportForm {
  reportName: string;
  periodStart: string;
  periodEnd: string;
  content?: string | null;
}

export const caseApi = {
  page: (filter: CaseFilter, pageNum: number, pageSize: number) =>
    api.get<PageResult<CaseInfo>>(`/api/cases${query({ ...filter, pageNum, pageSize })}`),

  /**
   * 案例详情。<b>每次调用记一条浏览记录</b>（需求 12.4），返回体里的 {@code viewId}
   * 供离开页面时回报停留时长。因此不要为了「刷新一下数据」重复调它。
   */
  detail: (id: number) => api.get<CaseInfo>(`/api/cases/${id}`),

  update: (id: number, form: CaseForm, version: number) =>
    api.put<void>(`/api/cases/${id}${query({ version })}`, form),

  remove: (id: number) => api.delete<void>(`/api/cases/${id}`),

  /** 录入审核结论。写四个字段并按结论推进状态，两件事在后端同一事务里 */
  audit: (id: number, form: CaseAuditForm) => api.post<void>(`/api/cases/${id}/audit`, form),

  /** 点赞。<b>用户账号也能调</b>。返回 false 表示被防刷静默丢弃，不要提示成失败 */
  like: (id: number) => api.post<boolean>(`/api/cases/${id}/likes`),

  /** 发表评论。<b>用户账号也能调</b> */
  comment: (id: number, payload: { signature?: string | null; content: string }) =>
    api.post<void>(`/api/cases/${id}/comments`, payload),

  comments: (id: number) => api.get<CaseComment[]>(`/api/cases/${id}/comments`),

  /** 删除评论。仅运营，且是逻辑删除 */
  removeComment: (id: number, commentId: number) =>
    api.delete<void>(`/api/cases/${id}/comments/${commentId}`),

  interactions: (id: number) => api.get<CaseInteractionStats>(`/api/cases/${id}/interactions`),

  /** 回报停留时长。超过 30 分钟按 30 分钟计，由后端截断 */
  reportDuration: (id: number, viewId: number, seconds: number) =>
    api.patch<void>(`/api/cases/${id}/views/${viewId}${query({ seconds })}`),

  reports: () => api.get<CaseReport[]>('/api/case-reports'),

  reportDetail: (id: number) => api.get<CaseReport>(`/api/case-reports/${id}`),

  /** 按区间取数并返回正文，不落库。生成弹窗里改区间时实时预览 */
  previewReport: (from: string, to: string) =>
    api.get<string>(`/api/case-reports/preview${query({ from, to })}`),

  generateReport: (form: CaseReportForm) => api.post<number>('/api/case-reports', form),

  updateReport: (id: number, form: CaseReportForm) =>
    api.put<void>(`/api/case-reports/${id}`, form),

  removeReport: (id: number) => api.delete<void>(`/api/case-reports/${id}`),
};
