import { describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from 'antd';
import { render, screen } from '@testing-library/react';
import { DemandOutletTab } from './DemandOutletTab';
import { useAuthStore } from '@/shared/store/authStore';
import type { AccountInfo } from '@/shared/api/types';
import type { Demand } from '@/shared/api/demands';

/**
 * 需求 8.3.3 的界面动态显示规则：选解决方案只出方案字段，选需求开发只出开发字段。
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
    useOutlets: () => ({
      solution: OUTLET_SOLUTION,
      development: OUTLET_DEVELOPMENT,
      reject: '需求驳回',
    }),
    useStates: (_objectType: string, field: string) => {
      if (field === '解决方案状态') return ['已输出', '已发布'];
      if (field === '需求开发状态') return ['已立项', '待开发', '开发中', '已上线', '优化中'];
      if (field === '业务验收状态') return ['待验收', '验收中', '验收通过', '验收不通过'];
      if (field === '需求交付标记') return ['已交付', '已归档'];
      return [];
    },
    useFieldEnums: () => ({
      data: {
        解决方案待输出: ['待输出'],
        需求未交付展示: ['未交付'],
      },
    }),
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
    solutionName: outlet === OUTLET_SOLUTION ? '抽取方案' : null,
    devName: outlet === OUTLET_DEVELOPMENT ? '报表开发' : null,
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
  it('出口为空：只显示流转去向，不展开两组处理字段', () => {
    renderTab(null);

    expect(screen.getByText('流转去向')).toBeTruthy();
    expect(screen.getByText('关联解决方案')).toBeTruthy();
    expect(screen.queryByText('解决方案名称')).toBeNull();
    expect(screen.queryByText('需求开发名称')).toBeNull();
    expect(screen.queryByText('首次上线时间')).toBeNull();
  });

  it('出口一：显示解决方案那一组，不显示开发字段', () => {
    renderTab(OUTLET_SOLUTION);

    expect(screen.getByText('解决方案名称')).toBeTruthy();
    expect(screen.getByText('解决方案状态')).toBeTruthy();
    expect(screen.getByText('关联解决方案')).toBeTruthy();
    expect(screen.queryByText('需求开发名称')).toBeNull();
    expect(screen.queryByText('首次上线时间')).toBeNull();
  });

  it('出口二：显示开发那一组，不显示解决方案字段', () => {
    renderTab(OUTLET_DEVELOPMENT);

    expect(screen.getByText('需求开发名称')).toBeTruthy();
    expect(screen.getByText('需求开发状态')).toBeTruthy();
    expect(screen.getByText('首次上线时间')).toBeTruthy();
    expect(screen.getByText('关联解决方案')).toBeTruthy();
    expect(screen.queryByText('解决方案名称')).toBeNull();
  });

  it('需求驳回：两组字段都不显示，处理状态为结束', () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    useAuthStore.setState({ account: operatorAccount(), resolved: true });
    render(
      <QueryClientProvider client={client}>
        <App>
          <DemandOutletTab demand={{ ...demand('需求驳回'), currentProcessState: '结束' }} />
        </App>
      </QueryClientProvider>,
    );

    expect(screen.getByText('结束')).toBeTruthy();
    expect(screen.queryByText('解决方案名称')).toBeNull();
    expect(screen.queryByText('首次上线时间')).toBeNull();
  });
});
