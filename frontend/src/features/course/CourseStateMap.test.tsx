import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from 'antd';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CourseStateMap } from './CourseStateMap';
import { useAuthStore } from '@/shared/store/authStore';
import type { AccountInfo } from '@/shared/api/types';
import type { Course } from '@/shared/api/courses';
import type { ObjectStateView } from '@/shared/api/transitions';

/**
 * P2-3 课程状态地图的拖动判定（需求 9.2）。
 *
 * <p>三个用例对应三种落点，它们的区别不是提示文案而是<b>会不会写库</b>：
 * <ul>
 *   <li>合法通路 → 弹确认框，确认后才调转换接口；
 *   <li>没有通路 → 什么都不做，明说「转换表里没有这条通路」；
 *   <li>录入结论类 → 什么都不做，引导到对应页签。<b>这一条最容易被做成「直接转状态」</b>，
 *       那样会留下一条没有结论的评审记录，而界面上看不出异常。
 * </ul>
 */

const transit = vi.fn();

vi.mock('@/shared/api/courses', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/shared/api/courses')>();
  return {
    ...actual,
    courseApi: {
      page: () => Promise.resolve({ records: courses, total: courses.length, pageNum: 1, pageSize: 200 }),
    },
  };
});

vi.mock('@/shared/api/transitions', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/shared/api/transitions')>();
  return {
    ...actual,
    transitionApi: {
      available: (_type: string, id: number) => Promise.resolve(availability(id)),
      transit: (...args: unknown[]) => {
        transit(...args);
        return Promise.resolve({
          stateField: '课程主状态',
          fromState: '立项',
          toState: '开发',
          action: 'START_DEVELOP',
          actionLabel: '开始开发',
        });
      },
    },
  };
});

vi.mock('./courseMeta', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./courseMeta')>();
  return {
    ...actual,
    useMachines: () => ({
      data: [
        {
          machineName: '课程主状态',
          objectType: 'COURSE',
          stateField: '课程主状态',
          states: ['立项', '开发', '自检', '评审决策', '试讲'],
          terminalStates: ['已关闭'],
          actions: [],
        },
      ],
      isLoading: false,
    }),
  };
});

const courses = [course()];

function course(): Course {
  return {
    id: 1,
    courseNo: 'KC2026080001',
    courseName: '大模型应用入门',
    reviewTrack: '内部端到端课程',
    domainCode: '客服中心',
    ownerNo: 'E001',
    ownerName: '张三',
    initiatedDate: '2026-08-01',
    expectPublishDate: '2026-09-01',
    summary: null,
    targetAudience: null,
    classHours: null,
    categoryCode: null,
    validityPeriod: '长期有效',
    validityEndDate: null,
    validityStatus: '未发布',
    expired: false,
    daysToExpiry: null,
    externalLink: null,
    mainState: '立项',
    devState: null,
    selfcheckState: null,
    trialState: null,
    publishState: null,
    firstPublishDate: null,
    qualityMarks: [],
    closeReason: null,
    currentMaterialVersion: null,
    reviewRound: null,
    hasDemand: false,
    lastStateChangedAt: '2026-08-01T10:00:00+08:00',
    updatedAt: '2026-08-01T10:00:00+08:00',
    updatedBy: 'operator',
    version: 0,
  };
}

/** 「立项」下只有「开始开发」与「关闭课程开发」可走；REVIEW_PASS 在表里但当前走不到。 */
function availability(objectId: number): ObjectStateView {
  return {
    objectType: 'COURSE',
    objectId,
    version: 0,
    fields: [
      {
        stateField: '课程主状态',
        machineName: '课程主状态',
        currentState: '立项',
        terminal: false,
        allowedActions: ['开始开发', '关闭课程开发'],
        blockedActions: [],
        actions: [
          { action: 'START_DEVELOP', label: '开始开发', toState: '开发' },
          { action: 'CLOSE_DEVELOPMENT', label: '关闭课程开发', toState: '已关闭' },
        ],
      },
    ],
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

function renderPage() {
  useAuthStore.setState({ account: operatorAccount(), resolved: true });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <App>
          <CourseStateMap filter={{}} onSelect={() => {}} activeId={null} />
        </App>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

async function dragTo(state: string) {
  const card = await screen.findByTestId('course-card');
  const column = document.querySelector(`[data-testid="state-column"][data-state="${state}"]`)!;
  fireEvent.dragStart(card);
  fireEvent.dragOver(column);
  fireEvent.drop(column);
}

describe('课程状态地图的拖动', () => {
  beforeEach(() => {
    transit.mockClear();
  });

  it('拖到合法的目标状态：先确认再执行，确认后才调转换接口', async () => {
    renderPage();
    await dragTo('开发');

    await screen.findByText('确认变更课程主状态');
    expect(transit).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: '确认变更' }));
    await waitFor(() => expect(transit).toHaveBeenCalledTimes(1));
    // 版本号必须原样带回（规则 K1）：共享账号下两名运营同时拖同一张卡片是常态
    expect(transit).toHaveBeenCalledWith(
      'courses',
      1,
      expect.objectContaining({ action: 'START_DEVELOP', version: 0, stateField: '课程主状态' }),
    );
  });

  it('拖到当前状态走不到的列：不调接口，明说转换表里没有这条通路', async () => {
    renderPage();
    await dragTo('自检');

    await screen.findByText('「立项」不能直接变为「自检」，转换表里没有这条通路。');
    expect(transit).not.toHaveBeenCalled();
  });
});
