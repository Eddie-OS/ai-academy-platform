import { api } from './client';

/** 驾驶舱数量类指标 scope，与 {@code GET /api/metrics/quantity/{scope}} 对齐。 */
export type QuantityScope = 'demands' | 'courses' | 'lecturers' | 'trainings' | 'cases';

/** card key → 非负整数；未接入的 key 不出现。 */
export type QuantityMetrics = Record<string, number>;

/** 驾驶舱周期卡摘要（15.2 #1／#3）；无样本为 null →「—」。 */
export interface EfficiencySummary {
  demandReviewCycle: string | null;
  courseDevCycle: string | null;
}

export interface CourseMonthlyOverview {
  newCourses: string | null;
  newCoursesMom: string | null;
  reviewFirstPass: string | null;
  reviewFirstPassMom: string | null;
  trialFirstPass: string | null;
  trialFirstPassMom: string | null;
}

export const metricsApi = {
  quantity: (scope: QuantityScope) =>
    api.get<QuantityMetrics>(`/api/metrics/quantity/${scope}`),

  efficiencySummary: () =>
    api.get<EfficiencySummary>('/api/metrics/efficiency/summary'),

  courseMonthlyOverview: () =>
    api.get<CourseMonthlyOverview>('/api/metrics/efficiency/course-monthly-overview'),
};
