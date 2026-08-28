import { describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { changeText, DemandStateLogTab, operatorLabel } from './DemandStateLogTab';
import type { StateLogRow } from '@/shared/api/transitions';

const logs: StateLogRow[] = [
  {
    stateField: '需求评审状态',
    fromState: null,
    toState: '待评审',
    actionCode: 'REGISTER',
    accountType: 'SYSTEM',
    changedAt: '2026-08-01T09:00:00+08:00',
    remark: null,
  },
  {
    stateField: '需求评审状态',
    fromState: '待评审',
    toState: '评审中',
    actionCode: 'START_REVIEW',
    accountType: 'OPS',
    changedAt: '2026-08-10T14:30:00+08:00',
    remark: '线下会后开始',
  },
];

vi.mock('@/shared/api/transitions', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/shared/api/transitions')>();
  return {
    ...actual,
    transitionApi: {
      ...actual.transitionApi,
      stateLogs: () => Promise.resolve(logs),
    },
  };
});

describe('状态流转日志时间轴', () => {
  it('倒序展示流转时间、变更内容、操作人、关联备注', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <DemandStateLogTab demandId={1} />
      </QueryClientProvider>,
    );

    expect(await screen.findByText('2026-08-10 14:30')).toBeInTheDocument();
    expect(screen.getByText('待评审 → 评审中')).toBeInTheDocument();
    expect(screen.getByText('运营')).toBeInTheDocument();
    expect(screen.getByText('线下会后开始')).toBeInTheDocument();
    expect(screen.getByText('（空） → 待评审')).toBeInTheDocument();
    expect(screen.getByText('系统')).toBeInTheDocument();

    const times = screen.getAllByText(/2026-08-/);
    expect(times[0]).toHaveTextContent('2026-08-10 14:30');
  });

  it('变更内容与操作人口径', () => {
    expect(changeText({ fromState: null, toState: '待评审' })).toBe('（空） → 待评审');
    expect(operatorLabel('SYSTEM')).toBe('系统');
    expect(operatorLabel('OPS')).toBe('运营');
  });
});
