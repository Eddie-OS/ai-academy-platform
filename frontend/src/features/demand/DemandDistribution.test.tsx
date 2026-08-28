import { describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from 'antd';
import { render, screen, waitFor } from '@testing-library/react';
import { DemandDistribution } from './DemandDistribution';
import type { Demand } from '@/shared/api/demands';

/**
 * P1-3 需求态势图拆成三张：评审 / 解决方案 / 开发。
 * 统计必须跨分页取全量；档位顺序取状态机（纪律 STK-1）。
 */

const PAGE_SIZE = 200;
const OUTLET_SOLUTION = '用现有工具输出解决方案';
const OUTLET_DEVELOP = '造工具需求开发';

const rows: Demand[] = Array.from({ length: 201 }, (_, index) =>
  demand(
    index + 1,
    index < 60 ? '待评审' : '已评审',
    index >= 160 && index < 180 ? OUTLET_SOLUTION : index >= 180 ? OUTLET_DEVELOP : null,
  ),
);

vi.mock('@/shared/api/demands', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/shared/api/demands')>();
  return {
    ...actual,
    demandApi: {
      page: (_filter: unknown, pageNum: number, pageSize: number) =>
        Promise.resolve({
          records: rows.slice((pageNum - 1) * pageSize, pageNum * pageSize),
          total: rows.length,
          pageNum,
          pageSize,
        }),
    },
  };
});

vi.mock('./demandMeta', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./demandMeta')>();
  return {
    ...actual,
    useOutlets: () => ({
      solution: OUTLET_SOLUTION,
      development: OUTLET_DEVELOP,
      reject: '需求驳回',
    }),
    useFieldEnums: () => ({
      data: { 解决方案待输出: ['待输出'] },
      isLoading: false,
    }),
    useMachines: () => ({
      data: [
        {
          machineName: '需求评审状态',
          objectType: 'DEMAND',
          stateField: '需求评审状态',
          states: ['待评审', '评审中', '已评审'],
          terminalStates: [],
          actions: [],
        },
        {
          machineName: '解决方案状态',
          objectType: 'DEMAND',
          stateField: '解决方案状态',
          states: ['已输出', '已发布'],
          terminalStates: [],
          actions: [],
        },
        {
          machineName: '需求开发状态',
          objectType: 'DEMAND',
          stateField: '需求开发状态',
          states: ['已立项', '待开发', '开发中', '已上线', '优化中'],
          terminalStates: [],
          actions: [],
        },
      ],
      isLoading: false,
    }),
  };
});

function demand(id: number, reviewState: string, outlet: string | null): Demand {
  const onSolution = outlet === OUTLET_SOLUTION;
  const onDev = outlet === OUTLET_DEVELOP;
  return {
    id,
    demandNo: `XQ202608${String(id).padStart(4, '0')}`,
    demandName: `需求 ${id}`,
    domainCode: 'CU-01',
    proposerNo: 'E001',
    proposerName: '张三',
    proposerDept: '客服中心',
    ownerNo: 'E002',
    ownerName: '李四',
    proposedDate: '2026-08-01',
    expectFinishDate: '2026-09-01',
    description: '—',
    demandSource: null,
    demandType: null,
    priority: null,
    reviewState,
    reviewDate: null,
    reviewConclusion: null,
    reviewOpinion: null,
    outlet,
    solutionState: onSolution ? (id % 2 === 0 ? '已发布' : '已输出') : null,
    solutionName: null,
    devName: null,
    devState: onDev ? (id % 2 === 0 ? '开发中' : '已立项') : null,
    currentProcessState: onSolution ? (id % 2 === 0 ? '已发布' : '已输出') : onDev ? (id % 2 === 0 ? '开发中' : '已立项') : null,
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

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <App>
        <DemandDistribution />
      </App>
    </QueryClientProvider>,
  );
}

describe('需求态势图', () => {
  it('三张图都按全量统计，评审漏斗跨过分页边界仍是 60 / 0 / 141', async () => {
    renderPage();

    await waitFor(() =>
      expect(
        screen.getAllByTestId('funnel-stage').filter((stage) =>
          ['待评审', '评审中', '已评审'].includes(stage.getAttribute('data-label') ?? ''),
        ).map((stage) => Number(stage.getAttribute('data-count'))),
      ).toEqual([60, 0, 141]),
    );
    expect(PAGE_SIZE).toBeLessThan(rows.length);
  });

  it('三张图档位取状态机顺序，并带数量与占比', async () => {
    renderPage();

    await waitFor(() => expect(screen.getAllByTestId('funnel-stage').length).toBeGreaterThan(8));

    const stages = screen.getAllByTestId('funnel-stage');
    const labels = stages.map((stage) => stage.getAttribute('data-label'));
    expect(labels).toEqual([
      '待评审',
      '评审中',
      '已评审',
      '待输出',
      '已输出',
      '已发布',
      '已立项',
      '待开发',
      '开发中',
      '已上线',
      '优化中',
    ]);
    expect(stages.every((stage) => stage.getAttribute('data-share')?.endsWith('%'))).toBe(true);
  });
});
