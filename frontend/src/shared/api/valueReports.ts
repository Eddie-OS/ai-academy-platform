import { api } from './client';

export interface ValueReport {
  id: number;
  reportPeriod: string;
  efficiencyGain: string | null;
  qualityGain: string | null;
  costSaving: string | null;
  costSavingUnit: string | null;
  demandIds: number[] | null;
  caseIds: number[] | null;
  description: string | null;
  createdAt: string;
  createdBy: string;
}

export interface ValueYearSummary {
  year: number;
  efficiencyGainCount: number;
  qualityGainCount: number;
  costSavingByUnit: Record<string, string>;
}

export interface ValueReportForm {
  reportPeriod: string;
  efficiencyGain?: string;
  qualityGain?: string;
  costSaving?: number | string;
  costSavingUnit?: string;
  demandIds?: number[];
  caseIds?: number[];
  description?: string;
}

export const valueReportsApi = {
  list: (year?: number) =>
    api.get<ValueReport[]>(`/api/value-reports${year ? `?year=${year}` : ''}`),
  summary: (year?: number) =>
    api.get<ValueYearSummary>(`/api/value-reports/summary${year ? `?year=${year}` : ''}`),
  create: (form: ValueReportForm) => api.post<ValueReport>('/api/value-reports', form),
  update: (id: number, form: ValueReportForm) =>
    api.put<ValueReport>(`/api/value-reports/${id}`, form),
  remove: (id: number) => api.delete<void>(`/api/value-reports/${id}`),
};
