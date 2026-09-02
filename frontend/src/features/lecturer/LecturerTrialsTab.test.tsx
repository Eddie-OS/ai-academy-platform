import { describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LecturerTrialsTab } from './LecturerTrialsTab';
import type { TrialLedgerRow } from '@/shared/api/lecturers';

const row: TrialLedgerRow = {
  id: 9,
  courseId: 3,
  courseNo: 'KC0003',
  courseName: '门店 AI 导购助手实战',
  roundNo: 2,
  trialDate: '2026-08-20',
  lecturerId: 1,
  lecturerNo: 'JS0001',
  lecturerName: '张三',
  participants: '李四',
  courseConclusion: '合格',
  lecturerConclusion: '合格',
  inconsistent: false,
  expertOpinion: '达到验收要求',
  issueList: null,
  recordState: '已完成',
  trialSatisfaction: '整体满意',
  trialOptimizeAdvice: '加一线案例',
  trialScheduledDate: '2026-08-18',
};

vi.mock('@/shared/api/lecturers', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/shared/api/lecturers')>();
  return {
    ...actual,
    lecturerApi: {
      trialLedger: () =>
        Promise.resolve({ records: [row], total: 1, pageNum: 1, pageSize: 100 }),
    },
  };
});

describe('讲师详情试讲记录', () => {
  it('按轮次展示课程工作台六字段', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <LecturerTrialsTab lecturerId={1} />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findByTestId('lecturer-trial-round')).toBeTruthy();
    expect(screen.getByRole('button', { name: '第 2 轮' })).toBeTruthy();
    expect(screen.getByText('试讲结果')).toBeTruthy();
    expect(screen.getByText('课程名称')).toBeTruthy();
    expect(screen.getByText('整体满意度')).toBeTruthy();
    expect(screen.getByText('整体满意')).toBeTruthy();
    expect(screen.getByText('优化建议')).toBeTruthy();
    expect(screen.getByText('加一线案例')).toBeTruthy();
    expect(screen.getByText('试讲时间')).toBeTruthy();
    expect(screen.getByText('2026-08-20')).toBeTruthy();
    expect(screen.getByRole('button', { name: '门店 AI 导购助手实战' })).toBeTruthy();
  });
});
