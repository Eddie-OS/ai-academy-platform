import { api } from './client';

export type WarningLightColor = 'BLUE' | 'YELLOW' | 'RED' | 'NONE';

export interface WarningSummary {
  healthy: number;
  blue: number;
  yellow: number;
  red: number;
}

export interface WarningDetailItem {
  objectType: string;
  objectId: number;
  objectName: string;
  currentState: string;
  ownerNo: string | null;
  ownerName: string | null;
  expectFinishDate: string | null;
  lastStateChangedAt: string | null;
  light: WarningLightColor;
  lightDays: number | null;
  lightReason: string | null;
}

export const warningsApi = {
  summary: () => api.get<WarningSummary>('/api/warnings/summary'),
  list: (light?: string, limit = 100) => {
    const params = new URLSearchParams();
    if (light) params.set('light', light);
    params.set('limit', String(limit));
    return api.get<WarningDetailItem[]>(`/api/warnings?${params.toString()}`);
  },
};
