import { describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from 'antd';
import { render, screen, waitFor } from '@testing-library/react';
import { DemandDistribution } from './DemandDistribution';
import type { Demand } from '@/shared/api/demands';

/**
 * P1-3 需求态势图的两件事（并页后它是需求驾驶舱底部分析区的三块，组件与断言不变）：
 * <ul>
 *   <li><b>统计的是全量而不是第一页。</b>只取第一页会让图变成「前 200 条的分布」，
 *       而图上看不出来——这类错误不会报错，只会让数字小一截。
 *   <li><b>漏斗的档位顺序取后端下发的状态机定义</b>，不在前端另排一遍（纪律 STK-1）。
 * </ul>
 */

const PAGE_SIZE = 200;

/** 201 条需求：足够跨过一次分页边界，能验证第二页有没有被拉下来 */
const rows: Demand[] = Array.from({ length: 201 }, (_, index) =>
  demand(index + 1, index < 120 ? 'CU-01' : 'CU-02', index < 60 ? '待评审' : '已评审'),
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
    useDicts: () => ({
      data: { 作战单元: [{ code: 'CU-01', name: '客服中心', parentCode: null }] },
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
      ],
      isLoading: false,
    }),
  };
});

function demand(id: number, domainCode: string, reviewState: string): Demand {
  return {
    id,
    demandNo: `XQ202608${String(id).padStart(4, '0')}`,
    demandName: `需求 ${id}`,
    domainCode,
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
    lastStateChangedAt: null,
    updatedAt: '2026-08-01T10:00:00+08:00',
    updatedBy: 'operator',
    version: 0,
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
  it('跨过分页边界后仍按全量统计，领域编码换成字典里的名称', async () => {
    renderPage();

    const bars = await screen.findAllByTestId('bar');
    const counts = Object.fromEntries(
      bars.map((bar) => [bar.getAttribute('data-label'), Number(bar.getAttribute('data-count'))]),
    );
    // 120 + 81 = 201：第二页没被拉下来时这里会是 120 + 80
    expect(counts['客服中心']).toBe(120);
    // 字典里没有的编码原样显示，不吞成空白
    expect(counts['CU-02']).toBe(81);
    expect(bars.length).toBeGreaterThan(0);
    expect(PAGE_SIZE).toBeLessThan(rows.length);
  });

  it('漏斗按状态机下发的顺序排档，空档照样画出来并显示 0', async () => {
    renderPage();

    // 档位来自状态机定义，数据到位前就已经画出来了；数字要等取数完成
    const stages = await screen.findAllByTestId('funnel-stage');
    expect(stages.map((stage) => stage.getAttribute('data-label'))).toEqual(['待评审', '评审中', '已评审']);

    await waitFor(() =>
      expect(
        screen.getAllByTestId('funnel-stage').map((stage) => Number(stage.getAttribute('data-count'))),
      ).toEqual([60, 0, 141]),
    );
  });
});
