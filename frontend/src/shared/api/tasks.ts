import { api } from './client';
import type { PageResult } from './types';

export interface TaskItem {
  id: number;
  title: string;
  taskType: string;
  objectType: string;
  objectId: number | null;
  ownerNo: string | null;
  ownerName: string | null;
  dueDate: string | null;
  taskState: string;
  deriveType: string | null;
  overdue: boolean;
  createdAt: string | null;
  lastStateChangedAt: string | null;
}

export interface TaskFilter {
  pageNum?: number;
  pageSize?: number;
  ownerNo?: string;
  taskState?: string;
  taskType?: string;
  overdueOnly?: boolean;
}

function toQuery(filter: TaskFilter): string {
  const params = new URLSearchParams();
  Object.entries(filter).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') {
      params.set(k, String(v));
    }
  });
  const q = params.toString();
  return q ? `?${q}` : '';
}

export const tasksApi = {
  page: (filter: TaskFilter = {}) =>
    api.get<PageResult<TaskItem>>(`/api/tasks${toQuery(filter)}`),
};
