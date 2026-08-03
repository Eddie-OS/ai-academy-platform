import { describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from 'antd';
import { render, screen } from '@testing-library/react';
import { DemandOutletTab } from './DemandOutletTab';
import { useAuthStore } from '@/shared/store/authStore';
import type { AccountInfo } from '@/shared/api/types';
import type { Demand } from '@/shared/api/demands';

/**
 * 需求 8.3.3 的界面动态显示规则：<b>分流出口为空时字段 21–27 全部隐藏，出口一显示 21–23，
 * 出口二显示 24–27。</b>
 *
 * <p>两组字段同时摆出来的后果是，运营在出口一的需求上看到一个永远是「—」的「首次上线时间」，
 * 然后来问「为什么上线时间不自动填」。
 */

const OUTLET_SOLUTION = '用现有工具输出解决方案';
const OUTLET_DEVELOPMENT = '造工具需求开发';

vi.mock('@/shared/api/transitions', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/shared/api/transitions')>();
  return {
    ...actual,
    transitionApi: {
      available: () => Promise.resolve({ objectType: 'DEMAND', objectId: 1, version: 0, fields: [] }),
    },
  };
});

vi.mock('@/shared/api/attachments', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/shared/api/attachments')>();
  return { ...actual, attachmentApi: { ...actual.attachmentApi, listOf: () => Promise.resolve([]) } };
});

vi.mock('./demandMeta', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./demandMeta')>();
  return {
    ...actual,
    useOutlets: () => ({ solution: OUTLET_SOLUTION, development: OUTLET_DEVELOPMENT }),
  };
});

function demand(outlet: string | null): Demand {
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
    description: '合同要素靠人工抄录',
    demandSource: null,
    demandType: null,
    priority: null,
    reviewState: '已评审',
    reviewDate: '2026-08-02',
    reviewConclusion: null,
    reviewOpinion: null,
    outlet,
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
    lastStateChangedAt: null,
    updatedAt: '2026-08-01T10:00:00+08:00',
    updatedBy: 'operator',
    version: 0,
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

function renderTab(outlet: string | null) {
  useAuthStore.setState({ account: operatorAccount(), resolved: true });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <App>
        <DemandOutletTab demand={demand(outlet)} />
      </App>
    </QueryClientProvider>,
  );
}

describe('分流与处理页签按出口显示字段', () => {
  it('出口为空：两组字段都不显示，并说明出口在哪里录入', () => {
    renderTab(null);

    expect(screen.queryByText('解决方案名称')).toBeNull();
    expect(screen.queryByText('首次上线时间')).toBeNull();
    expect(screen.getByText(/出口在「评审信息」页签随评审结论一起录入/)).toBeTruthy();
  });

  it('出口一：显示解决方案那一组，不显示上线与优化次数', () => {
    renderTab(OUTLET_SOLUTION);

    expect(screen.getByText('解决方案名称')).toBeTruthy();
    expect(screen.getByText('解决方案附件')).toBeTruthy();
    expect(screen.queryByText('首次上线时间')).toBeNull();
    expect(screen.queryByText('优化次数')).toBeNull();
  });

  it('出口二：显示开发那一组，不显示解决方案字段', () => {
    renderTab(OUTLET_DEVELOPMENT);

    expect(screen.getByText('首次上线时间')).toBeTruthy();
    expect(screen.getByText('最新上线时间')).toBeTruthy();
    expect(screen.getByText('优化次数')).toBeTruthy();
    expect(screen.queryByText('解决方案名称')).toBeNull();
  });
});
