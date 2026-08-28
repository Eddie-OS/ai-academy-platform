import { describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from 'antd';
import { render, screen } from '@testing-library/react';
import { DemandTransitionPanel } from './DemandTransitionPanel';
import { useAuthStore } from '@/shared/store/authStore';
import type { AccountInfo } from '@/shared/api/types';
import type { Demand } from '@/shared/api/demands';
import type { ObjectStateView } from '@/shared/api/transitions';

/**
 * 需求详情状态区的两条纪律：
 * <ul>
 *   <li><b>录入类动作不在状态区执行。</b>「录入评审结论」在这里点一下，评审状态会推进而分流出口
 *       是空的——需求 5.2.1 要求两者必须同时录入，出口为空的需求此后没有任何动作能推进它。
 *       因此它渲染成引导标签而不是可点按钮。「标记交付使用」同理，但理由不同：它一次驱动两个
 *       状态机，统一转换接口只会推动其中一个。
 *   <li><b>后端没说可用的动作不渲染。</b>allowedActions 与 blockedActions 都没提到的动作，
 *       前端渲染出来就是在猜；猜错了运营点了会拿到 ILLEGAL_TRANSITION。
 * </ul>
 */

vi.mock('@/shared/api/transitions', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/shared/api/transitions')>();
  return {
    ...actual,
    transitionApi: {
      available: () => Promise.resolve(availability()),
      transit: () => Promise.resolve({}),
    },
  };
});

function availability(): ObjectStateView {
  return {
    objectType: 'DEMAND',
    objectId: 1,
    version: 0,
    fields: [
      {
        stateField: '需求评审状态',
        machineName: '需求评审状态',
        currentState: '评审中',
        terminal: false,
        allowedActions: ['录入评审结论', '退回待评审'],
        blockedActions: [],
        actions: [
          { action: 'RECORD_REVIEW_RESULT', label: '录入评审结论', toState: '已评审' },
          { action: 'RETURN_TO_PENDING_REVIEW', label: '退回待评审', toState: '待评审' },
          // 转换表里有但当前走不到，且后端没把它列进 blockedActions
          { action: 'REOPEN_REVIEW', label: '重新评审', toState: '评审中' },
        ],
      },
      {
        stateField: '需求交付标记',
        machineName: '需求交付标记',
        currentState: null,
        terminal: false,
        allowedActions: ['标记交付使用'],
        blockedActions: [],
        actions: [{ action: 'MARK_DELIVERED', label: '标记交付使用', toState: '已交付' }],
      },
    ],
  };
}

function demand(): Demand {
  return {
    id: 1,
    demandNo: 'XQ2026080001',
    demandName: '合同要素自动抽取',
    domainCode: '客服中心',
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
    lastStateChangedAt: '2026-08-01T10:00:00+08:00',
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

function renderPanel() {
  useAuthStore.setState({ account: operatorAccount(), resolved: true });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <App>
        <DemandTransitionPanel demand={demand()} />
      </App>
    </QueryClientProvider>,
  );
}

describe('需求详情的状态区', () => {
  it('录入类动作渲染成引导标签，不是可点按钮', async () => {
    renderPanel();

    const delegated = await screen.findAllByTestId('delegated-action');
    expect(delegated.map((tag) => tag.getAttribute('data-action')).sort()).toEqual([
      'MARK_DELIVERED',
      'RECORD_REVIEW_RESULT',
    ]);

    const buttons = screen.getAllByTestId('guarded-action');
    expect(buttons.map((button) => button.getAttribute('data-action'))).not.toContain('录入评审结论');
    expect(buttons.map((button) => button.getAttribute('data-action'))).not.toContain('标记交付使用');
  });

  it('后端两个列表都没提到的动作不渲染', async () => {
    renderPanel();
    await screen.findAllByTestId('delegated-action');

    expect(screen.queryByRole('button', { name: '重新评审' })).toBeNull();
  });
});
