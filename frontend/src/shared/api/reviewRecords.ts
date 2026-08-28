import { api } from './client';
import type { PageResult } from './types';

export type ReviewTabCode =
  | 'COURSE_REVIEW'
  | 'COURSE_TRIAL'
  | 'DEMAND_REVIEW'
  | 'DEMAND_ACCEPTANCE'
  | 'CASE_AUDIT'
  | 'PENDING';

export interface ReviewRecordItem {
  tab: ReviewTabCode | string;
  id: number;
  objectId: number;
  objectName: string;
  roundNo: number | null;
  boundVersion: string | null;
  occurredOn: string | null;
  result: string | null;
  secondaryResult: string | null;
  inconsistent: boolean | null;
  feedbackAvgScore: string | null;
  opinion: string | null;
  recordState: string | null;
  operator: string | null;
  outlet: string | null;
  acceptorName: string | null;
  createdAt: string | null;
}

export interface ReviewRecordFilter {
  tab?: ReviewTabCode | string;
  keyword?: string;
  result?: string;
  dateFrom?: string;
  dateTo?: string;
  operator?: string;
  inconsistent?: boolean;
  pageNum?: number;
  pageSize?: number;
}

export interface ReviewKpis {
  courseReviewMonth: number | string;
  trialMonth: number | string;
  demandReviewTotal: number | string;
  pendingTotal: number | string;
}

function toQuery(filter: ReviewRecordFilter): string {
  const params = new URLSearchParams();
  Object.entries(filter).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') params.set(k, String(v));
  });
  const q = params.toString();
  return q ? `?${q}` : '';
}

export const reviewRecordsApi = {
  page: (filter: ReviewRecordFilter = {}) =>
    api.get<PageResult<ReviewRecordItem>>(`/api/review-records${toQuery(filter)}`),
  kpis: () => api.get<ReviewKpis>('/api/review-records/kpis'),
};
