import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { App } from 'antd';
import { cleanup, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { resetRegressionModeCache } from '@/app/regressionMode';
import { TASK_ROWS } from '@/fixtures/task';
import { REVIEW_RECORDS } from '@/fixtures/review';
import { ESCALATION_RECORDS } from '@/fixtures/escalation';

/**
 * 三个中心在<b>产品模式且库为空</b>时不得渲染冻结数据。
 *
 * <p>这三页原先都写着同一段回退：{@code useMock = regression || isError || 行数 === 0}，
 * 取不到数就铺 fixtures，注释里的理由是「避免 KPI 全「—」、表格 0 条的空白页」。
 * 代价是<b>一屏认不出来的假数据</b>：
 *
 * <ul>
 *   <li>任务中心表头写「任务清单 1,268」，下面铺 8 条别人的任务——运营会把它当自己的待办去处理；</li>
 *   <li>评审记录中心的冻结记录带着课程名、评审人、评审结论与一致性判定，与真实台账无从区分，
 *       而评审记录是要被引用来回答「这门课谁评过、结论是什么」的；</li>
 *   <li>催办台账是「谁在什么时候催过谁」的凭据（需求 13.9）。假记录会让运营以为某条已经催过，
 *       而防重复窗口（{@code URGE_TOO_FREQUENT}）算的是真库里的记录，两边对不上。</li>
 * </ul>
 *
 * <p>更糟的是那个条件<b>把 isError 也算进回退</b>：接口 500 时界面显示得一切正常。
 *
 * <p>为什么这条必须在 vitest 里：视觉回归（{@code tests/visual/}）跑的是 {@code ?fixture=1}
 * 回归模式，那边<b>本来就该</b>渲染 fixtures，所以它永远抓不到产品模式的回退。而这三页
 * 在此之前没有任何 vitest 覆盖——回退被删掉后，也没有任何东西会在它被重新加回来时报错。
 */

const tasksPage = vi.fn();
const reviewPage = vi.fn();
const reviewKpis = vi.fn();
const escalationPage = vi.fn();
const escalationPending = vi.fn();

vi.mock('@/shared/api/tasks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/shared/api/tasks')>();
  return { ...actual, tasksApi: { ...actual.tasksApi, page: () => tasksPage() } };
});

vi.mock('@/shared/api/reviewRecords', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/shared/api/reviewRecords')>();
  return {
    ...actual,
    reviewRecordsApi: { ...actual.reviewRecordsApi, page: () => reviewPage(), kpis: () => reviewKpis() },
  };
});

vi.mock('@/shared/api/escalations', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/shared/api/escalations')>();
  return {
    ...actual,
    escalationsApi: {
      ...actual.escalationsApi,
      page: () => escalationPage(),
      pending: () => escalationPending(),
    },
  };
});

const { TaskV2Page } = await import('./TaskV2Page');
const { ReviewV2Page } = await import('./ReviewV2Page');
const { MessageV2Page } = await import('./MessageV2Page');

const EMPTY_PAGE = { records: [], total: 0, pageNum: 1, pageSize: 50 };

function renderPage(node: ReactNode) {
  // 产品模式：地址里不带 ?fixture=1
  window.history.replaceState({}, '', '/');
  resetRegressionModeCache();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <App>{node}</App>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('三个中心：产品模式空库不渲染冻结数据', () => {
  beforeEach(() => {
    resetRegressionModeCache();
    tasksPage.mockResolvedValue(EMPTY_PAGE);
    reviewPage.mockResolvedValue(EMPTY_PAGE);
    reviewKpis.mockResolvedValue({
      courseReviewMonth: 0,
      trialMonth: 0,
      demandReviewTotal: 0,
      pendingTotal: 0,
    });
    escalationPage.mockResolvedValue(EMPTY_PAGE);
    escalationPending.mockResolvedValue({
      groups: [],
      summary: { pendingCount: 0, urgedThisCycle: 0, redUnurgedOver7Days: 0 },
    });
  });

  afterEach(() => {
    cleanup();
    resetRegressionModeCache();
    vi.clearAllMocks();
  });

  it('任务中心空库显示空态，不铺冻结任务行', async () => {
    renderPage(<TaskV2Page />);

    expect(await screen.findByTestId('task-empty')).toBeTruthy();
    expect(screen.queryAllByTestId('task-row')).toHaveLength(0);
    // 冻结数据里第一条任务的标题一个字都不该出现
    expect(screen.queryByText(TASK_ROWS[0]!.title)).toBeNull();
    /*
     * 「1,268」是冻结数据里的任务总量。它出现在表头与分页条上，而分页条的文案是
     * 「共 1,268 条」——数字与行数不一致时，人相信的是那个更权威的总数。
     */
    expect(screen.queryByText(/1,268/)).toBeNull();
  });

  it('评审记录中心空库显示空态，不铺冻结评审记录', async () => {
    renderPage(<ReviewV2Page />);

    expect(await screen.findByTestId('review-empty')).toBeTruthy();
    expect(screen.queryAllByTestId('review-row')).toHaveLength(0);
    expect(screen.queryByText(REVIEW_RECORDS[0]!.name)).toBeNull();
  });

  it('催办台账空库显示空态，不铺冻结催办记录', async () => {
    renderPage(<MessageV2Page />);

    expect(await screen.findByTestId('escalation-empty')).toBeTruthy();
    expect(screen.queryAllByTestId('escalation-row')).toHaveLength(0);
    expect(screen.queryByText(ESCALATION_RECORDS[0]!.objectName)).toBeNull();
  });

  /**
   * 接口报错与「库里就是没有」必须说不同的话。
   *
   * <p>先前两者都走同一条回退，界面表现完全一样：铺满冻结数据。也就是说<b>后端挂了的时候，
   * 界面看起来最正常</b>——没有任何提示，运营会按屏幕上那批数据继续工作。
   */
  it('接口报错时说加载失败，不说「没有数据」', async () => {
    tasksPage.mockRejectedValue(new Error('boom'));
    renderPage(<TaskV2Page />);

    expect(await screen.findByText(/加载失败/)).toBeTruthy();
    expect(screen.queryAllByTestId('task-row')).toHaveLength(0);
    expect(screen.queryByText(TASK_ROWS[0]!.title)).toBeNull();
  });
});
