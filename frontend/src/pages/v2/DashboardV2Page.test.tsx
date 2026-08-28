import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { cleanup, render, screen, within } from '@testing-library/react';
import { DashboardV2Page } from './DashboardV2Page';
import { resetRegressionModeCache } from '@/app/regressionMode';
import type { DashboardOverview, DashboardWorklistItem } from '@/shared/api/dashboard';

/**
 * P01 总看板的<b>产品模式</b>门禁。
 *
 * <p>视觉回归（`tests/visual/p01-dashboard.spec.ts`）跑的是回归模式：整页不发请求、
 * 九个区域读冻结数据。因此凡是「接口字段怎么落到界面上」的错，那套 spec 一条都抓不到 ——
 * 它看到的永远是 fixtures。这个文件补的正是那一半，也是这两条断言各自对应的故障现场：
 *
 * <ul>
 *   <li>入口卡按 {@code pageKey} 取数，而 pageKey 的权威定义在侧栏（讲师那项叫
 *       {@code instructor}），取数那侧写的是 {@code lecturer} —— 讲师卡永远落回冻结数据，
 *       上面的三个数看着很正常，只是与库里的讲师人数无关；</li>
 *   <li>待办清单把红灯成因一律写成「停滞」—— 真正逾期的对象被说成停滞，
 *       而两种成因的天数从不同时间点起算，读者无从发现这一行是错的。</li>
 * </ul>
 */

const overview = vi.fn<() => Promise<DashboardOverview>>();

vi.mock('@/shared/api/dashboard', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/shared/api/dashboard')>();
  return { ...actual, dashboardApi: { overview: () => overview() } };
});

/**
 * 五个分节的数字<b>两两不同</b>，且与另一节的任何字段都不撞。
 *
 * <p>这是这份载荷唯一的设计要点：取错分节（讲师卡读到课程那一节）或取错字段
 * （三数错位一格）都会让断言给出一个「本该是 31，实际是 22」的具体差值。
 * 若各节共用 1／2／3 这类小数字，错位后的每一对看着都合理，断言照样通过。
 */
function payload(worklist: DashboardWorklistItem[] = []): DashboardOverview {
  return {
    /* courseTotal 仍在载荷里但不再有卡片读它（V-70 撤掉了「课程总数」）。
       留着是因为后端接口没变——删掉就测不出「有人把这张卡加回来」 */
    quantity: {
      demandTotal: 11,
      courseTotal: 21,
      coursePublished: 27,
      lecturerPool: 39,
      trainingSession: 49,
      caseListed: 59,
    },
    cockpits: {
      demands: { total: 11, pending: 12, developing: 13 },
      courses: { total: 21, developed: 22, reviewed: 23, published: 24, developing: 25, quality: 26 },
      lecturers: { pool: 31, pendingTrial: 32, cultivating: 33, qualified: 34, attendees: 35 },
      trainings: { plans: 41, sessions: 43, attendees: 44 },
      cases: { total: 51, published: 52, views: 53 },
    },
    warnings: { healthy: 7, blue: 7, yellow: 5, red: 2 },
    worklist,
    efficiency: {
      demandReviewCycle: '5.6',
      courseDevCycle: '28.3',
      firstRoundPassRate: '71.2',
      reviewRounds: '1.8',
      casePublishCycle: '15.8',
    },
    efficiencyTrends: {
      months: ['2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08'],
      series: {
        demandReviewCycle: ['6.2', '5.9', '5.4', '4.2', null, '5.6'],
        courseDevCycle: ['31', '29', '28', '27', null, '28.3'],
        firstRoundPassRate: ['55', '62', '68', '70', null, '71.2'],
        casePublishCycle: ['18', '14', '12', '11', null, '15.8'],
      },
    },
    value: { year: 2026, efficiencyGainCount: 4, qualityGainCount: 3, costSavingByUnit: { 万元: '12.5' } },
    openTasks: [],
  };
}

function worklistItem(overrides: Partial<DashboardWorklistItem>): DashboardWorklistItem {
  return {
    objectType: 'DEMAND',
    objectId: 1,
    objectName: 'AI需求-0987',
    currentState: '评审中',
    ownerNo: 'E001',
    ownerName: '李明',
    expectFinishDate: '2026-08-20',
    remainingDays: 3,
    light: 'BLUE',
    lightDays: 3,
    lightReason: null,
    ...overrides,
  };
}

function renderDashboard() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <DashboardV2Page />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/** 产品模式 = 地址上没有 {@code ?fixture=1}。模式在首次调用时定格，必须连带清缓存 */
function setProductMode(): void {
  window.history.replaceState({}, '', '/');
  resetRegressionModeCache();
}

/**
 * 等接口那一帧落地。
 *
 * <p>锚点用「实时统计」：效率区只在 {@code data} 到位后才渲染这句。不能等某一行待办
 * 出现 —— 产品模式加载中待办是空表，回归模式才有冻结那五行。五张 KPI 的「月度环比」
 * 两种模式都有，不能当锚点。
 *
 * <p>用 {@code findAllByText}：这四个字在四条效率指标下各出现一次。
 */
async function waitForLiveData(): Promise<void> {
  await screen.findAllByText('实时统计');
}

/** 区域编号见文档 5「区域坐标」表：R4 入口卡、R6 待办清单 */
function region(id: 'R4' | 'R6'): HTMLElement {
  const element = document.querySelector<HTMLElement>(`[data-region='${id}']`);
  if (!element) throw new Error(`总看板缺少区域 ${id}`);
  return element;
}

describe('P01 总看板 · 产品模式', () => {
  beforeEach(() => {
    setProductMode();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    resetRegressionModeCache();
  });

  it('加载中不回落冻结的需求总数 1,268', () => {
    overview.mockReturnValue(new Promise(() => undefined));
    renderDashboard();

    const demandKpi = document.querySelector('[data-kpi="demandTotal"]');
    expect(demandKpi).toBeTruthy();
    expect(demandKpi).toHaveTextContent('—');
    expect(demandKpi).not.toHaveTextContent('1,268');
    expect(region('R4')).not.toHaveTextContent('312');
  });

  it('五张入口卡各取自己那一节的真实数字', async () => {
    overview.mockResolvedValue(payload());
    renderDashboard();
    await waitForLiveData();

    const cards = within(region('R4')).getAllByTestId('dash-entry');
    expect(cards).toHaveLength(5);

    // 培训卡与案例卡是两个数（V-70），其余三张是三个
    const expected = [
      { title: 'AI需求图', stats: ['12', '13', '11'] },
      { title: '课程工作台', stats: ['22', '23', '24'] },
      { title: '讲师与能力地图', stats: ['32', '33', '34'] },
      { title: '培训运营地图', stats: ['43', '44'] },
      { title: '案例与组织覆盖图', stats: ['52', '53'] },
    ];

    for (const [index, card] of expected.entries()) {
      const element = cards[index]!;
      expect(within(element).getByText(card.title), `第 ${index + 1} 张卡的标题`).toBeTruthy();

      const values = within(element)
        .getAllByTestId('entry-stat')
        .map((stat) => stat.querySelector('.entry-stat-value')?.textContent);
      expect(values, `${card.title} 的底部数`).toEqual(card.stats);
    }
  });

  /*
   * 产品模式也要是五张 KPI。
   *
   * <p>回归模式那侧由视觉回归盯着，但这一行的张数来自 fixtures 而数值来自接口：
   * 只在回归模式断言时，「有人为了让 quantity.courseTotal 有地方显示而把卡加回来」
   * 这种改动会在产品模式下悄悄生效。
   */
  it('KPI 是五张，不含课程总数', async () => {
    overview.mockResolvedValue(payload());
    renderDashboard();
    await waitForLiveData();

    const kpis = screen.getAllByTestId('dash-kpi');
    expect(kpis).toHaveLength(5);
    expect(kpis.map((kpi) => kpi.dataset.kpi)).not.toContain('courseTotal');
  });

  /*
   * 冻结数据里的讲师三数是 102／327／689，与这里给的 32／33／34 没有一个重合。
   * 单独再断言一次，是因为「读错分节」这个错的表现不是数字变乱，
   * 而是这张卡安静地停在设计稿给的那三个数上 —— 而那三个数本身是合理的。
   */
  it('讲师卡不再落回冻结数据', async () => {
    overview.mockResolvedValue(payload());
    renderDashboard();
    await waitForLiveData();

    const lecturerCard = within(region('R4')).getAllByTestId('dash-entry')[2]!;
    for (const frozen of ['689', '327', '102']) {
      expect(within(lecturerCard).queryByText(frozen), `讲师卡仍在显示冻结值 ${frozen}`).toBeNull();
    }
  });

  it('待办清单的红灯按接口成因区分逾期与停滞', async () => {
    overview.mockResolvedValue(
      payload([
        worklistItem({
          objectId: 1,
          objectName: 'AI需求-0987',
          light: 'RED',
          lightReason: '已逾期',
          expectFinishDate: '2026-08-01',
          remainingDays: -9,
          lightDays: 9,
        }),
        worklistItem({
          objectId: 2,
          objectName: '课程-0456',
          light: 'RED',
          lightReason: '状态停滞',
          remainingDays: 2,
          lightDays: 7,
        }),
      ]),
    );
    renderDashboard();
    await waitForLiveData();

    // 限定在 R6：预警卡（R5）也会按灯色从同一份 worklist 里挑样例，那里没有灯徽章但有对象名。
    // 清单里用两字短标签（逾期／停滞），全称留给详情与预警卡
    const lights = within(region('R6')).getAllByTestId('warning-light');
    expect(lights[0]).toHaveTextContent('逾期');
    expect(lights[1]).toHaveTextContent('停滞');
  });

  /*
   * 反向断言：逾期那一行不得出现「停滞」。上一条只看第一个灯说了什么，
   * 而这个 Bug 的形态恰好是「两行都说停滞」—— 逐个 toHaveTextContent 时，
   * 第二行照样通过，只有第一行报错，很容易被读成「顺序错了」而不是「成因写死了」。
   */
  it('逾期的那一行不出现「停滞」', async () => {
    overview.mockResolvedValue(
      payload([
        worklistItem({
          light: 'RED',
          lightReason: '已逾期',
          expectFinishDate: '2026-08-01',
          remainingDays: -9,
          lightDays: 9,
        }),
      ]),
    );
    renderDashboard();
    await waitForLiveData();

    const rows = within(region('R6')).getAllByTestId('worklist-row');
    expect(rows).toHaveLength(1);
    expect(rows[0]).not.toHaveTextContent('停滞');
  });

  it('「去处理」链到对应对象的详情深链', async () => {
    overview.mockResolvedValue(
      payload([
        worklistItem({ objectType: 'COURSE', objectId: 456, objectName: '课程-0456' }),
        worklistItem({ objectType: 'TRAINING_PLAN', objectId: 88, objectName: '培训计划-0088' }),
      ]),
    );
    renderDashboard();
    await waitForLiveData();

    const actions = within(region('R6')).getAllByTestId('worklist-action');
    expect(actions[0]).toHaveAttribute('href', '/courses/456');
    expect(actions[1]).toHaveAttribute('href', '/training-plans/88');
  });
});
