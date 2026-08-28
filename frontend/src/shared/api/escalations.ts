import { api } from './client';
import type { PageResult } from './types';

export interface EscalationRecord {
  id: number;
  objectType: string;
  objectId: number;
  objectName: string;
  ownerNo: string | null;
  ownerName: string | null;
  escalateType: string;
  channelNote: string | null;
  remark: string | null;
  escalatedAt: string;
  processNode: string | null;
  light: string | null;
  source: string;
  content: string | null;
  createdAt: string | null;
  createdBy: string | null;
}

export interface EscalationFilter {
  pageNum?: number;
  pageSize?: number;
  objectType?: string;
  objectId?: number;
  escalateType?: string;
  ownerNo?: string;
  source?: string;
  keyword?: string;
}

export interface EscalationMarkForm {
  objectType: string;
  objectId: number;
  objectName: string;
  ownerNo?: string | null;
  ownerName?: string | null;
  escalateType: string;
  channelNote?: string | null;
  remark?: string | null;
  escalatedAt?: string | null;
  processNode?: string | null;
  light?: string | null;
  source?: string | null;
  content?: string | null;
  force?: boolean;
}

export interface PendingItem {
  objectType: string;
  objectId: number;
  objectName: string;
  currentState: string | null;
  light: string | null;
  lightDays: number | null;
  lightReason: string | null;
  escalateType: string;
  defaultContent: string;
  urgedThisCycle: boolean;
  urgedLabel: string | null;
  lightChanged: boolean;
}

export interface OwnerGroup {
  ownerNo: string | null;
  ownerName: string | null;
  dimensions: {
    tasks: { openCount: number; overdueCount: number };
    demands: { blue: number; yellow: number; red: number; pendingAcceptance: number };
    courses: {
      pendingReview: number;
      pendingTrial: number;
      pendingOptimize: number;
      validitySoon30d: number;
    };
    trainings: { pendingStart: number; pendingAttendance: number; pendingArchive: number };
    cases: { pendingOrganize: number; organizing: number; pendingAudit: number };
  };
  items: PendingItem[];
}

export interface EscalationPending {
  cycleStart: string;
  summary: {
    pendingCount: number;
    urgedThisCycle: number;
    redUnurgedOver7Days: number;
  };
  groups: OwnerGroup[];
}

function toQuery(filter: EscalationFilter): string {
  const params = new URLSearchParams();
  Object.entries(filter).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') params.set(k, String(v));
  });
  const q = params.toString();
  return q ? `?${q}` : '';
}

export const escalationsApi = {
  pending: () => api.get<EscalationPending>('/api/escalations/pending'),
  page: (filter: EscalationFilter = {}) =>
    api.get<PageResult<EscalationRecord>>(`/api/escalations${toQuery(filter)}`),
  get: (id: number) => api.get<EscalationRecord>(`/api/escalations/${id}`),
  mark: (form: EscalationMarkForm) => api.post<number>('/api/escalations', form),
};
