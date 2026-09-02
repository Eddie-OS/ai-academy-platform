import { describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from 'antd';
import { render, screen } from '@testing-library/react';
import { LecturerCultivationTab } from './LecturerCultivationTab';
import type { CultivationRecord, Lecturer } from '@/shared/api/lecturers';
import { useAuthStore } from '@/shared/store/authStore';
import { FIXTURE_ACCOUNT } from '@/fixtures/account';

const lecturer = {
  id: 1,
  lecturerNo: 'JS0001',
  lecturerName: '张三',
  trainingState: '培养中',
  dutyState: '暂停授课',
} as Lecturer;

const row: CultivationRecord = {
  id: 8,
  lecturerId: 1,
  planText: '门店带教',
  plannedFrom: '2026-08-15',
  plannedTo: '2026-08-31',
  cultivationTypes: ['定向培养'],
  recordText: '观摩一场',
  actualFrom: '2026-08-16',
  actualTo: '2026-08-20',
  planState: '培养中',
  evaluation: '节奏偏快',
  remark: null,
  createdAt: '2026-08-16T10:00:00+08:00',
  createdBy: 'operator',
  updatedAt: '2026-08-16T10:00:00+08:00',
  updatedBy: 'operator',
};

vi.mock('@/shared/api/lecturers', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/shared/api/lecturers')>();
  return {
    ...actual,
    lecturerApi: {
      cultivationRecords: () => Promise.resolve([row]),
    },
  };
});

describe('培养计划与培养记录', () => {
  it('列出十字段并带出讲师ID与姓名', async () => {
    useAuthStore.setState({ account: FIXTURE_ACCOUNT, resolved: true });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <App>
          <LecturerCultivationTab lecturer={lecturer} />
        </App>
      </QueryClientProvider>,
    );

    expect(await screen.findByTestId('cultivation-record')).toBeTruthy();
    expect(screen.getByText('JS0001')).toBeTruthy();
    expect(screen.getByText('张三')).toBeTruthy();
    expect(screen.getByText('培养计划')).toBeTruthy();
    expect(screen.getByText('门店带教')).toBeTruthy();
    expect(screen.getByText('计划培养周期')).toBeTruthy();
    expect(screen.getByText('培养类型')).toBeTruthy();
    expect(screen.getByText('定向培养')).toBeTruthy();
    expect(screen.getByText('培养记录')).toBeTruthy();
    expect(screen.getByText('实际培养周期')).toBeTruthy();
    expect(screen.getByText('培养评价')).toBeTruthy();
    expect(screen.getByText('新建培养记录')).toBeTruthy();
  });
});
