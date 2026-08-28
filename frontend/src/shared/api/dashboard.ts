import { api } from './client';

export interface DashboardWarningBlock {
  healthy: number;
  blue: number;
  yellow: number;
  red: number;
}

export interface DashboardWorklistItem {
  objectType: string;
  objectId: number;
  objectName: string;
  currentState: string;
  ownerNo: string | null;
  ownerName: string | null;
  expectFinishDate: string | null;
  remainingDays: number | null;
  light: 'BLUE' | 'YELLOW' | 'RED' | 'NONE';
  lightDays: number | null;
  lightReason: string | null;
}

export interface DashboardValueBlock {
  year: number;
  efficiencyGainCount: number;
  qualityGainCount: number;
  costSavingByUnit: Record<string, string>;
}

export interface DashboardEfficiencyTrends {
  /** yyyy-MM，固定 6 格 */
  months: string[];
  /** key 与 efficiency 字段对齐；无样本月为 null */
  series: Record<string, Array<string | null>>;
}

export interface DashboardOverview {
  quantity: Record<string, number>;
  cockpits: Record<string, Record<string, number>>;
  warnings: DashboardWarningBlock;
  worklist: DashboardWorklistItem[];
  efficiency: Record<string, string | null>;
  efficiencyTrends: DashboardEfficiencyTrends;
  value: DashboardValueBlock;
  openTasks: Array<{
    id: number;
    title: string;
    taskType: string;
    objectType: string;
    objectId: number | null;
    ownerNo: string | null;
    ownerName: string | null;
    dueDate: string | null;
    taskState: string;
    overdue: boolean;
  }>;
}

export const dashboardApi = {
  overview: () => api.get<DashboardOverview>('/api/dashboard/overview'),
};
