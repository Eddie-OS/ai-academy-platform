import { describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from 'antd';
import { render, screen } from '@testing-library/react';
import { DemandEscalationsTab, escalationStatus } from './DemandEscalationsTab';
import type { Demand } from '@/shared/api/demands';
import type { EscalationRecord } from '@/shared/api/escalations';

const records: EscalationRecord[] = [
  {
    id: 2,
    objectType: 'DEMAND',
    objectId: 1,
    objectName: '合同要素自动抽取',
    ownerNo: 'E002',
    ownerName: '李四',
    escalateType: '停滞',
    channelNote: null,
    remark: null,
    escalatedAt: '2026-08-20T10:00:00+08:00',
    processNode: '评审中',
    light: 'YELLOW',
    source: '运营手动',
    content: '请关注',
    createdAt: '2026-08-20T10:00:00+08:00',
    createdBy: '运营',
  },
  {
    id: 1,
    objectType: 'DEMAND',
    objectId: 1,
    objectName: '合同要素自动抽取',
    ownerNo: 'E002',
    ownerName: '李四',
    escalateType: '停滞',
    channelNote: null,
    remark: null,
    escalatedAt: '2026-08-10T10:00:00+08:00',
    processNode: '待评审',
    light: 'RED',
    source: '运营手动',
    content: '请关注',
    createdAt: '2026-08-10T10:00:00+08:00',
    createdBy: '运营',
  },
];

vi.mock('@/shared/api/escalations', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/shared/api/escalations')>();
  return {
    ...actual,
    escalationsApi: {
      ...actual.escalationsApi,
      page: () => Promise.resolve({ records, total: 2, pageNum: 1, pageSize: 200 }),
    },
  };
});

function demand(): Demand {
  return {
    id: 1,
    demandNo: 'XQ2026080001',
    demandName: '合同要素自动抽取',
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
    reviewState: '评审中',
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
    archivedAt: null,
    acceptanceState: null,
    acceptorName: null,
    acceptedAt: null,
    acceptanceOpinion: null,
    acceptanceRound: null,
    courseCount: 0,
    hasCourse: false,
    lastStateChangedAt: '2026-08-15T12:00:00+08:00',
    updatedAt: '2026-08-15T12:00:00+08:00',
    updatedBy: 'operator',
    version: 1,
    light: 'YELLOW',
    lightDays: 3,
    lightReason: null,
  };
}

describe('催办记录页签', () => {
  it('按催办时间倒序，并按状态变更自动闭环', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <App>
          <DemandEscalationsTab demand={demand()} />
        </App>
      </QueryClientProvider>,
    );

    expect(await screen.findByText('2026-08-20 10:00')).toBeInTheDocument();
    expect(screen.getByText('2026-08-10 10:00')).toBeInTheDocument();
    expect(screen.getByText('待响应')).toBeInTheDocument();
    expect(screen.getByText('已处理')).toBeInTheDocument();
    expect(screen.getAllByText('合同要素自动抽取').length).toBeGreaterThan(0);
    expect(screen.getAllByText('李四').length).toBeGreaterThan(0);
  });

  it('对方尚未改状态时显示待响应', () => {
    expect(escalationStatus({ escalatedAt: '2026-08-20T10:00:00+08:00' }, '2026-08-15T12:00:00+08:00')).toBe(
      '待响应',
    );
    expect(escalationStatus({ escalatedAt: '2026-08-10T10:00:00+08:00' }, '2026-08-15T12:00:00+08:00')).toBe(
      '已处理',
    );
    expect(escalationStatus({ escalatedAt: '2026-08-10T10:00:00+08:00' }, null)).toBe('待响应');
  });
});
