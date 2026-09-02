import { describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from 'antd';
import { render, screen } from '@testing-library/react';
import { LecturerCertTab } from './LecturerCertTab';
import type { CertificationRecord, Lecturer } from '@/shared/api/lecturers';
import { useAuthStore } from '@/shared/store/authStore';
import { FIXTURE_ACCOUNT } from '@/fixtures/account';

const lecturer = {
  id: 1,
  lecturerNo: 'JS0001',
  lecturerName: '张三',
  trainingState: '可上岗',
  trialQualified: true,
  lecturerLevel: 'L2',
} as Lecturer;

const row: CertificationRecord = {
  id: 8,
  lecturerId: 1,
  certBatch: '2026-08 批次',
  lecturerLevel: 'L2',
  certState: '已认证',
  reviewers: '张小北',
  opinion: '准予认证',
  passedOn: '2026-08-31',
  validFrom: '2026-08-31',
  validTo: '2027-08-31',
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
      certificationRecords: () => Promise.resolve([row]),
    },
  };
});

describe('认证记录', () => {
  it('列出九字段并带出讲师ID与姓名', async () => {
    useAuthStore.setState({ account: FIXTURE_ACCOUNT, resolved: true });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <App>
          <LecturerCertTab lecturer={lecturer} />
        </App>
      </QueryClientProvider>,
    );

    expect(await screen.findByTestId('cert-record')).toBeTruthy();
    expect(screen.getByText('JS0001')).toBeTruthy();
    expect(screen.getByText('张三')).toBeTruthy();
    expect(screen.getByText('认证批次')).toBeTruthy();
    expect(screen.getByText('2026-08 批次')).toBeTruthy();
    expect(screen.getByText('认证有效期')).toBeTruthy();
    expect(screen.getByText('新建认证记录')).toBeTruthy();
    expect(screen.getByText('只记录认证结果，不做认证审批')).toBeTruthy();
  });
});
