import { describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from 'antd';
import { render, screen } from '@testing-library/react';
import { LecturerLevelLogTab } from './LecturerLevelLogTab';
import type { Lecturer, LevelLogRecord } from '@/shared/api/lecturers';
import { useAuthStore } from '@/shared/store/authStore';
import { FIXTURE_ACCOUNT } from '@/fixtures/account';

const lecturer = {
  id: 1,
  lecturerNo: 'JS0001',
  lecturerName: '张三',
  lecturerLevel: 'L2',
} as Lecturer;

const row: LevelLogRecord = {
  id: 8,
  lecturerId: 1,
  changeNo: 'BG0001',
  triggerReason: '定期评审',
  changeDesc: '由 L1 变更为 L2',
  changedOn: '2026-08-20',
  levelAfter: 'L2',
  reviewer: '张小北',
  reviewComment: '能力达标',
  createdAt: '2026-08-20T10:00:00+08:00',
  createdBy: 'operator',
  updatedAt: '2026-08-20T10:00:00+08:00',
  updatedBy: 'operator',
};

vi.mock('@/shared/api/lecturers', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/shared/api/lecturers')>();
  return {
    ...actual,
    lecturerApi: {
      levelLogs: () => Promise.resolve([row]),
    },
  };
});

describe('等级变更记录', () => {
  it('列出十一字段并带出系统编号', async () => {
    useAuthStore.setState({ account: FIXTURE_ACCOUNT, resolved: true });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <App>
          <LecturerLevelLogTab lecturer={lecturer} />
        </App>
      </QueryClientProvider>,
    );

    expect(await screen.findByTestId('level-log-record')).toBeTruthy();
    expect(screen.getByText('JS0001')).toBeTruthy();
    expect(screen.getByText('张三')).toBeTruthy();
    expect(screen.getByText('变更记录编号')).toBeTruthy();
    expect(screen.getAllByText('BG0001').length).toBeGreaterThan(0);
    expect(screen.getByText('变更触发原因')).toBeTruthy();
    expect(screen.getByText('记录创建人')).toBeTruthy();
    expect(screen.getByText('记录更新时间')).toBeTruthy();
    expect(screen.getByText('新建等级变更记录')).toBeTruthy();
    expect(screen.getByText('只记录等级变更结果，不做评估模型')).toBeTruthy();
  });
});
