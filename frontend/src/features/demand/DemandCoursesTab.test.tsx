import { describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from 'antd';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DemandCoursesTab } from './DemandCoursesTab';
import { useAuthStore } from '@/shared/store/authStore';
import type { AccountInfo } from '@/shared/api/types';
import type { Demand } from '@/shared/api/demands';

vi.mock('@/shared/api/demands', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/shared/api/demands')>();
  return {
    ...actual,
    demandApi: {
      ...actual.demandApi,
      courses: () => Promise.resolve([]),
      saveCourseLink: vi.fn(),
    },
  };
});

vi.mock('@/shared/api/attachments', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/shared/api/attachments')>();
  return { ...actual, attachmentApi: { ...actual.attachmentApi, listOf: () => Promise.resolve([]) } };
});

function demand(): Demand {
  return {
    id: 9,
    demandNo: 'XQ2026080009',
    demandName: '课程外链',
    domainCode: 'CU-01',
    proposerNo: 'E001',
    proposerName: '张三',
    proposerDept: '客服中心',
    ownerNo: 'E002',
    ownerName: '李四',
    proposedDate: '2026-08-01',
    expectFinishDate: '2026-09-01',
    description: '描述',
    demandSource: null,
    demandType: null,
    priority: null,
    reviewState: '待评审',
    reviewDate: null,
    reviewConclusion: null,
    reviewOpinion: null,
    outlet: null,
    solutionState: null,
    solutionName: null,
    devState: null,
    currentProcessState: null,
    firstOnlineDate: null,
    latestOnlineDate: null,
    optimizeCount: null,
    deliveryMark: null,
    deliveredAt: null,
    courseLink: 'https://example.com/course',
    archivedAt: null,
    acceptanceState: null,
    acceptorName: null,
    acceptedAt: null,
    acceptanceOpinion: null,
    acceptanceRound: null,
    courseCount: 0,
    hasCourse: false,
    lastStateChangedAt: null,
    updatedAt: '2026-08-01T10:00:00+08:00',
    updatedBy: 'operator',
    version: 0,
    light: 'NONE',
    lightDays: null,
    lightReason: null,
  };
}

function operatorAccount(): AccountInfo {
  return {
    username: 'operator',
    displayName: '运营',
    accountType: 'OPERATOR',
    typeLabel: '运营账号',
    operator: true,
  };
}

describe('需求详情关联课程页签', () => {
  it('展示可跳转的课程链接与关联文档上传', async () => {
    useAuthStore.setState({ account: operatorAccount(), resolved: true });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <MemoryRouter>
        <QueryClientProvider client={client}>
          <App>
            <DemandCoursesTab demand={demand()} />
          </App>
        </QueryClientProvider>
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: '课程链接' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '关联文档' })).toBeInTheDocument();
    const link = await screen.findByRole('link', { name: 'https://example.com/course' });
    expect(link).toHaveAttribute('href', 'https://example.com/course');
    expect(link).toHaveAttribute('target', '_blank');
  });
});
